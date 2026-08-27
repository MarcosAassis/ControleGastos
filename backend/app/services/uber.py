from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..crypto import decrypt_secret, encrypt_secret
from ..models import UberConnection, UberOAuthState, User
from ..settings import FRONTEND_URL, UBER_MOCK, UBER_REDIRECT_URI
from . import uber_client, uber_mock

STATE_TTL_MINUTES = 10


def serialize_connection(row: UberConnection | None) -> dict:
    if not row or row.status != "connected":
        return {
            "connected": False,
            "mock": UBER_MOCK,
            "driver_name": None,
            "activation_status": None,
            "connected_at": None,
            "last_sync_at": None,
        }
    name = " ".join(part for part in [row.driver_first_name, row.driver_last_name] if part)
    return {
        "connected": True,
        "mock": bool(row.mock),
        "driver_name": name or None,
        "activation_status": row.activation_status,
        "connected_at": row.connected_at.isoformat() if row.connected_at else None,
        "last_sync_at": row.last_sync_at.isoformat() if row.last_sync_at else None,
        "status": row.status,
    }


def get_connection(db: Session, user_id: int) -> UberConnection | None:
    return db.query(UberConnection).filter(UberConnection.user_id == user_id).first()


def authenticate(db: Session, user: User) -> dict:
    state = secrets.token_urlsafe(32)
    db.add(
        UberOAuthState(
            state=state,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=STATE_TTL_MINUTES),
        )
    )
    db.commit()
    if UBER_MOCK:
        callback = f"{UBER_REDIRECT_URI}?{urlencode({'code': 'mock-code', 'state': state})}"
        return {"authorize_url": callback, "mock": True}
    return {"authorize_url": uber_client.build_authorize_url(state), "mock": False}


def _consume_state(db: Session, state: str | None) -> UberOAuthState:
    if not state:
        raise HTTPException(status_code=400, detail="Autorização Uber inválida.")
    row = db.query(UberOAuthState).filter(UberOAuthState.state == state).first()
    if not row or row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="A autorização expirou. Tente conectar de novo.")
    db.delete(row)
    db.commit()
    return row


def exchange_code_for_token(code: str) -> dict:
    if UBER_MOCK:
        return uber_mock.mock_token_payload()
    return uber_client.exchange_code_for_token(code)


def refresh_token(refresh_token_value: str) -> dict:
    if UBER_MOCK:
        return uber_mock.mock_token_payload()
    return uber_client.refresh_access_token(refresh_token_value)


def get_profile(access_token: str) -> dict:
    if UBER_MOCK:
        return uber_mock.mock_profile()
    return uber_client.get_profile(access_token)


def get_trips(access_token: str, params: dict | None = None) -> dict:
    if UBER_MOCK:
        return uber_mock.mock_trips()
    return uber_client.get_trips(access_token, params)


def get_payments(access_token: str, params: dict | None = None) -> dict:
    if UBER_MOCK:
        return uber_mock.mock_payments()
    return uber_client.get_payments(access_token, params)


def _apply_token_payload(row: UberConnection, payload: dict) -> None:
    access = payload.get("access_token")
    if not access:
        raise HTTPException(status_code=502, detail="A Uber não devolveu um token de acesso.")
    row.access_token_encrypted = encrypt_secret(access)
    refresh = payload.get("refresh_token")
    if refresh:
        row.refresh_token_encrypted = encrypt_secret(refresh)
    expires_in = int(payload.get("expires_in") or 0)
    row.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None


def _apply_profile(row: UberConnection, profile: dict) -> None:
    row.uber_driver_id = profile.get("driver_id")
    row.driver_first_name = profile.get("first_name")
    row.driver_last_name = profile.get("last_name")
    row.driver_email = profile.get("email")
    row.activation_status = profile.get("activation_status")
    row.profile_raw = json.dumps(profile, ensure_ascii=False)


def complete_oauth(db: Session, code: str | None, state: str | None) -> str:
    oauth = _consume_state(db, state)
    if not code:
        return f"{FRONTEND_URL}/uber?erro=sem_codigo"
    payload = exchange_code_for_token(code)
    access = payload.get("access_token")
    if not access:
        return f"{FRONTEND_URL}/uber?erro=falha"
    profile = get_profile(access)
    row = get_connection(db, oauth.user_id)
    if not row:
        row = UberConnection(user_id=oauth.user_id, access_token_encrypted="")
        db.add(row)
    _apply_token_payload(row, payload)
    _apply_profile(row, profile)
    row.status = "connected"
    row.mock = UBER_MOCK
    row.connected_at = datetime.utcnow()
    db.commit()
    return f"{FRONTEND_URL}/uber?ok=1"


def access_token_for(db: Session, row: UberConnection) -> str:
    expires = row.token_expires_at
    refresh_value = decrypt_secret(row.refresh_token_encrypted)
    if expires and expires <= datetime.utcnow() + timedelta(minutes=5) and refresh_value:
        payload = refresh_token(refresh_value)
        _apply_token_payload(row, payload)
        db.commit()
    token = decrypt_secret(row.access_token_encrypted)
    if not token:
        raise HTTPException(status_code=400, detail="Conecte a conta Uber novamente.")
    return token


def disconnect(db: Session, user_id: int) -> None:
    row = get_connection(db, user_id)
    if not row:
        return
    db.delete(row)
    db.commit()
