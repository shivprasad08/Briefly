"""
JWT and password authentication utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext
import os
import secrets

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Short-lived access token

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a plain password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import hashlib

def create_refresh_token() -> str:
    """Generate a secure random string for a refresh token."""
    return secrets.token_urlsafe(32)

def hash_refresh_token(token: str) -> str:
    """Hash a refresh token deterministically using SHA256 for DB lookup."""
    return hashlib.sha256(token.encode()).hexdigest()

def verify_refresh_token(token: str, hashed_token: str) -> bool:
    """Verify a refresh token against its SHA256 hash."""
    if not hashed_token:
        return False
    return hash_refresh_token(token) == hashed_token

def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token.
    Raises ExpiredSignatureError if expired, JWTError for other invalid issues.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    email: str = payload.get("sub")
    if email is None:
        raise JWTError("Token missing 'sub' claim")
    return {"email": email}
