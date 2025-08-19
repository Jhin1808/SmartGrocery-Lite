import os
from datatime import datatime,timedelta, time zone

import jwt
from argon2 import PasswordHasher, exception as argon2_exc

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

PH = PasswordHasher()

def hash_password(p: str) -> str: 
    return PH.hash(p)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return PH.verify(hashed_password, plain_password)  # (hash, plain)
    except argon2_exc.VerifyMismatchError:
        return False
    
def create_access_token(subject: str | int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN)
    return jwt.encode({"sub": str(subject), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

