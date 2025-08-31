# app/routers/auth.py
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, UserRead, TokenResponse
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_reset_token,
    decode_reset_token,
)
from app.security_cookies import set_login_cookie, clear_login_cookie
from app.rate_limit import allow as allow_rate
from app.deps import get_current_user_any as get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(u); db.commit(); db.refresh(u)
    return UserRead(id=u.id, email=u.email)

@router.post("/token", response_model=TokenResponse)
def token(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # OAuth2 spec calls it "username" — we use email as username
    u = db.query(User).filter(User.email == form.username).first()
    if not u or not u.password_hash or not verify_password(form.password, u.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password")
    jwt = create_access_token(u.id)
    # Set HttpOnly cookie and also return token for Safari/iOS fallback
    set_login_cookie(response, jwt)
    return TokenResponse(access_token=jwt)

@router.post("/logout", status_code=204)
def logout():
    resp = Response(status_code=204)
    clear_login_cookie(resp)
    return resp

class ChangePassword(BaseModel):
    current_password: str | None = None
    new_password: str

@router.post("/change-password", status_code=204)
def change_password(payload: ChangePassword,
                    db: Session = Depends(get_db),
                    current: User = Depends(get_current_user)):
    # If user already has a password, require current_password
    if current.password_hash:
        if not payload.current_password or not verify_password(payload.current_password, current.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Current password is incorrect")
    # Set/replace new password
    current.password_hash = hash_password(payload.new_password)
    db.commit()
    return


class ForgotPassword(BaseModel):
    email: EmailStr
    captcha_token: str | None = None


class ResetPassword(BaseModel):
    token: str
    new_password: str


def _frontend_url() -> str:
    import os
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


@router.post("/forgot-password")
def forgot_password(payload: ForgotPassword, request: Request, db: Session = Depends(get_db)):
    # Always respond OK to avoid user enumeration; include reset_url for dev convenience if user exists.
    import os
    import httpx

    # Rate limit by IP and by email (process-local; for multi-instance use a shared store like Redis)
    ip = request.headers.get("x-forwarded-for") or request.client.host or "?"
    ip = (ip.split(",")[0]).strip()
    if not allow_rate(ip, "forgot-ip", max_requests=int(os.getenv("FORGOT_LIMIT_PER_IP", "5")), window_seconds=3600):
        # 429 to indicate throttling without leaking whether email exists
        raise HTTPException(status_code=429, detail="Too many requests, try again later")

    # Optional CAPTCHA (Cloudflare Turnstile)
    secret = os.getenv("TURNSTILE_SECRET")
    if secret:
        token = (payload.captcha_token or "").strip()
        if not token:
            raise HTTPException(status_code=400, detail="Captcha required")
        try:
            r = httpx.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={"secret": secret, "response": token, "remoteip": ip},
                timeout=10.0,
            )
            data = r.json()
            if not data.get("success"):
                raise HTTPException(status_code=400, detail="Captcha invalid")
        except HTTPException:
            raise
        except Exception:
            # Fail closed if verification endpoint is unreachable
            raise HTTPException(status_code=400, detail="Captcha check failed")

    user = db.query(User).filter(User.email == payload.email).first()
    out = {"ok": True}
    if user:
        # per-email limit
        if not allow_rate(user.email.lower(), "forgot-email", max_requests=int(os.getenv("FORGOT_LIMIT_PER_EMAIL", "3")), window_seconds=3600):
            return out
        tok = create_reset_token(user.id, expires_minutes=30)
        reset_url = f"{_frontend_url()}/reset?token={tok}"
        # Optionally include reset_url in API response for local/dev only when explicitly enabled
        if (os.getenv("EXPOSE_RESET_URL", "").lower() in ("1", "true", "yes", "dev")):
            out["reset_url"] = reset_url
        # Send email via provider if configured
        try:
            _send_reset_email(to=user.email, url=reset_url, token=tok)
        except Exception:
            # Don't leak errors
            pass
    return out


@router.post("/reset-password", status_code=204)
def reset_password(payload: ResetPassword, db: Session = Depends(get_db)):
    try:
        data = decode_reset_token(payload.token)
        sub = int(data.get("sub"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user = db.get(User, sub)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
    # Set/replace password without needing the old one
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return Response(status_code=204)


def _send_reset_email(to: str, url: str, token: str) -> None:
    """Send a password reset email via configured provider.

    Supported:
    - Resend API (RESEND_API_KEY, EMAIL_FROM)
    - SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM)
    If no provider configured, this is a no-op (dev fallback returns URL in API).
    """
    import os
    from email.message import EmailMessage

    frm = os.getenv("EMAIL_FROM") or "SmartGrocery <no-reply@smartgrocery.online>"

    # Try Resend first
    rk = os.getenv("RESEND_API_KEY")
    if rk:
        import httpx

        html = f"""
        <p>Hello,</p>
        <p>We received a request to reset your SmartGrocery password.</p>
        <p><a href=\"{url}\">Click here to reset your password</a>. This link expires in 30 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <hr />
        <p>If the link above does not work, copy this reset code and use it in the app:</p>
        <pre style=\"background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;\">{token}</pre>
        """
        text = (
            "Hello,\n\n"
            "We received a request to reset your SmartGrocery password.\n"
            f"Reset link: {url}\n"
            "This link expires in 30 minutes. If you did not request this, you can ignore this email.\n\n"
            "If the link doesn't work, copy this reset code and use it in the app:\n"
            f"{token}\n"
        )
        payload = {"from": frm, "to": [to], "subject": "SmartGrocery: Reset your password", "html": html, "text": text}
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {rk}", "Content-Type": "application/json"},
            json=payload,
            timeout=10.0,
        )
        r.raise_for_status()
        return

    # Fallback to SMTP if configured
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASS")
    if host and user and pwd:
        import smtplib

        msg = EmailMessage()
        msg["Subject"] = "SmartGrocery: Reset your password"
        msg["From"] = frm
        msg["To"] = to
        msg.set_content(
            f"Hello,\n\n"
            f"We received a request to reset your SmartGrocery password.\n"
            f"Reset link: {url}\n"
            f"This link expires in 30 minutes. If you did not request this, you can ignore this email.\n\n"
            f"If the link doesn't work, copy this reset code and use it in the app:\n{token}\n"
        )
        msg.add_alternative(
            f"""
            <p>Hello,</p>
            <p>We received a request to reset your SmartGrocery password.</p>
            <p><a href=\"{url}\">Click here to reset your password</a>. This link expires in 30 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
            <hr />
            <p>If the link above does not work, copy this reset code and use it in the app:</p>
            <pre style=\"background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;\">{token}</pre>
            """,
            subtype="html",
        )

        with smtplib.SMTP(host, port) as s:
            s.starttls()
            s.login(user, pwd)
            s.send_message(msg)
        return
    # Otherwise, no provider configured → do nothing


# # app/routers/auth.py
# from fastapi import APIRouter, Depends, HTTPException, status, Response
# from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import hash_password, verify_password, create_access_token
# from app.schemas import RegisterRequest, UserRead
# from app.security_cookies import set_access_cookie, clear_access_cookie

# router = APIRouter(prefix="/auth", tags=["auth"])

# @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# def register(payload: RegisterRequest, db: Session = Depends(get_db)):
#     if db.query(User).filter(User.email == payload.email).first():
#         raise HTTPException(status_code=400, detail="Email already registered")
#     u = User(email=payload.email, password_hash=hash_password(payload.password))
#     db.add(u); db.commit(); db.refresh(u)
#     return UserRead(id=u.id, email=u.email)

# @router.post("/token", status_code=204)
# def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
#     u = db.query(User).filter(User.email == form.username).first()
#     if not u or not verify_password(form.password, u.password_hash or ""):
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
#     jwt = create_access_token(u.id)
#     resp = Response(status_code=204)
#     set_access_cookie(resp, jwt)
#     return resp

# @router.post("/logout", status_code=204)
# def logout():
#     resp = Response(status_code=204)
#     clear_access_cookie(resp)
#     return resp


# # app/routers/auth.py
# from fastapi import APIRouter, Depends, HTTPException, status, Response
# from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import hash_password, verify_password, create_access_token
# from app.schemas import RegisterRequest, UserRead, TokenResponse
# from fastapi import Response
# from app.security_cookies import cookie_settings, set_access_cookie, clear_access_cookie


# router = APIRouter(prefix="/auth", tags=["auth"])

# @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# def register(payload: RegisterRequest, db: Session = Depends(get_db)):
#     if db.query(User).filter(User.email == payload.email).first():
#         raise HTTPException(status_code=400, detail="Email already registered")
#     u = User(email=payload.email, password_hash=hash_password(payload.password))
#     db.add(u); db.commit(); db.refresh(u)
#     return UserRead(id=u.id, email=u.email)

# @router.post("/token", response_model=TokenResponse)
# def token(response: Response, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
#     u = db.query(User).filter(User.email == form.username).first()
#     if not u or not verify_password(form.password, u.password_hash):
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
#     jwt = create_access_token(u.id)
#     set_access_cookie(response, jwt)              # <-- set HttpOnly cookie
#     return TokenResponse(access_token=jwt)        # optional to also return JSON

# # @router.post("/token", response_model=TokenResponse)
# # def token(response: Response,
# #           form: OAuth2PasswordRequestForm = Depends(),
# #           db: Session = Depends(get_db)):
# #     # OAuth2 form uses "username" — you’re using email as the username
# #     u = db.query(User).filter(User.email == form.username).first()
# #     # NOTE: u.password_hash may be NULL for Google-only accounts → treat as invalid for password flow
# #     if not u or not u.password_hash or not verify_password(form.password, u.password_hash):
# #         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

# #     jwt = create_access_token(u.id)

# #     # Set HttpOnly auth cookie (browser sends it automatically on same-origin requests)
# #     response.set_cookie("access_token", jwt, **cookie_settings())

# #     # Optional: still return the token in the JSON body for old code paths
# #     return TokenResponse(access_token=jwt)
# @router.post("/logout", status_code=204)
# def logout(response: Response):
#     clear_access_cookie(response)
# # @router.post("/logout", status_code=204)
# # def logout(response: Response):
# #     # Delete the auth cookie
# #     response.delete_cookie("access_token", path="/")
# #     return Response(status_code=204)

# # from fastapi import APIRouter, Depends, HTTPException, status
# # from fastapi.security import OAuth2PasswordRequestForm
# # from sqlalchemy.orm import Session

# # from app.database import get_db
# # from app.models import User
# # from app.security import hash_password, verify_password, create_access_token
# # from app.schemas import RegisterRequest, UserRead, TokenResponse

# # from fastapi import Response
# # from app.security_cookies import cookie_settings
# # from app.security import create_access_token

# # router = APIRouter(prefix="/auth", tags=["auth"])

# # @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# # def register(payload: RegisterRequest, db: Session = Depends(get_db)):
# #     if db.query(User).filter(User.email == payload.email).first():
# #         raise HTTPException(status_code=400, detail="Email already registered")
# #     u = User(email=payload.email, password_hash=hash_password(payload.password))
# #     db.add(u); db.commit(); db.refresh(u)
# #     return UserRead(id=u.id, email=u.email)

# # @router.post("/token", response_model=TokenResponse)
# # def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
# #     # OAuth2 spec calls it "username"; we use email as the username
# #     u = db.query(User).filter(User.email == form.username).first()
# #     if not u or not verify_password(form.password, u.password_hash):
# #         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
# #     return TokenResponse(access_token=create_access_token(u.id))
