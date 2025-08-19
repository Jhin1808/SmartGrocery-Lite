import os
import jwt
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher, exceptions as argon2_exc

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-dev")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

PH = PasswordHasher()  # Argon2id defaults

def hash_password(plain_password: str) -> str:
    return PH.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return PH.verify(hashed_password, plain_password)  # (hash, plain)
    except argon2_exc.VerifyMismatchError:
        return False

def create_access_token(subject: str | int, expires_minutes: int | None = None) -> str:
    exp = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode({"sub": str(subject), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    # raises jwt.ExpiredSignatureError / jwt.PyJWTError if invalid
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
