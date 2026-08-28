from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .settings import (
    EMAIL_CODE_TTL_MINUTES,
    JWT_EXPIRE_DAYS,
    JWT_SHORT_EXPIRE_HOURS,
    SECRET_KEY,
)

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: int, remember_me: bool = True) -> str:
    expires_delta = (
        timedelta(days=JWT_EXPIRE_DAYS)
        if remember_me
        else timedelta(hours=JWT_SHORT_EXPIRE_HOURS)
    )
    payload = {
        "sub": str(user_id),
        "typ": "access",
        "exp": datetime.utcnow() + expires_delta,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def create_reset_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "typ": "reset",
        "exp": datetime.utcnow() + timedelta(minutes=EMAIL_CODE_TTL_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def user_from_reset_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("typ") != "reset":
            raise ValueError("tipo inválido")
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado. Peça um novo.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado. Peça um novo.",
        )
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faça login para continuar.",
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        if payload.get("typ", "access") != "access":
            raise ValueError("tipo inválido")
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida. Entre novamente.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    return user
