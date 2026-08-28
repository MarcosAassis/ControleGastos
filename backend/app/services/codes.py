from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import EmailCode
from ..settings import (
    EMAIL_CODE_MAX_ATTEMPTS,
    EMAIL_CODE_RESEND_SECONDS,
    EMAIL_CODE_TTL_MINUTES,
    SECRET_KEY,
)
from .email import send_code_email

PURPOSE_REGISTER = "register"
PURPOSE_RESET = "reset"
PURPOSE_LOGIN = "login"


def _hash_code(email: str, purpose: str, code: str) -> str:
    raw = f"{SECRET_KEY}:{email}:{purpose}:{code}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _active_code(db: Session, email: str, purpose: str) -> EmailCode | None:
    now = datetime.utcnow()
    return (
        db.query(EmailCode)
        .filter(
            EmailCode.email == email,
            EmailCode.purpose == purpose,
            EmailCode.consumed_at.is_(None),
            EmailCode.expires_at > now,
        )
        .order_by(EmailCode.created_at.desc())
        .first()
    )


def issue_code(
    db: Session,
    email: str,
    purpose: str,
    payload: dict | None = None,
) -> None:
    now = datetime.utcnow()
    latest = (
        db.query(EmailCode)
        .filter(EmailCode.email == email, EmailCode.purpose == purpose)
        .order_by(EmailCode.created_at.desc())
        .first()
    )
    if latest and (now - latest.created_at).total_seconds() < EMAIL_CODE_RESEND_SECONDS:
        wait = EMAIL_CODE_RESEND_SECONDS - int((now - latest.created_at).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Aguarde {wait}s para pedir um novo código.",
        )

    db.query(EmailCode).filter(
        EmailCode.email == email,
        EmailCode.purpose == purpose,
        EmailCode.consumed_at.is_(None),
    ).update({"consumed_at": now})

    code = f"{secrets.randbelow(1_000_000):06d}"
    row = EmailCode(
        email=email,
        purpose=purpose,
        code_hash=_hash_code(email, purpose, code),
        payload=json.dumps(payload) if payload is not None else None,
        attempts=0,
        expires_at=now + timedelta(minutes=EMAIL_CODE_TTL_MINUTES),
        created_at=now,
    )
    db.add(row)
    db.commit()
    try:
        send_code_email(email, code, purpose)
    except Exception:
        row.consumed_at = datetime.utcnow()
        db.commit()
        raise


def consume_code(db: Session, email: str, purpose: str, code: str) -> dict | None:
    row = _active_code(db, email, purpose)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado. Peça um novo.",
        )
    if row.attempts >= EMAIL_CODE_MAX_ATTEMPTS:
        row.consumed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Muitas tentativas. Peça um novo código.",
        )

    row.attempts += 1
    if row.code_hash != _hash_code(email, purpose, code.strip()):
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado. Peça um novo.",
        )

    row.consumed_at = datetime.utcnow()
    db.commit()
    if not row.payload:
        return None
    return json.loads(row.payload)


def require_pending(db: Session, email: str, purpose: str) -> EmailCode:
    row = _active_code(db, email, purpose)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não há código pendente. Preencha o formulário novamente.",
        )
    payload = json.loads(row.payload) if row.payload else None
    issue_code(db, email, purpose, payload)
    return row
