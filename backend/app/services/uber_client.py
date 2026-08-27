from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from ..settings import (
    UBER_API_BASE,
    UBER_AUTH_URL,
    UBER_CLIENT_ID,
    UBER_CLIENT_SECRET,
    UBER_REDIRECT_URI,
    UBER_SCOPES,
    UBER_TOKEN_URL,
)

TIMEOUT = httpx.Timeout(15.0)


def _require_credentials() -> None:
    if not UBER_CLIENT_ID or not UBER_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configure UBER_CLIENT_ID e UBER_CLIENT_SECRET para usar a API real.",
        )


def build_authorize_url(oauth_state: str) -> str:
    _require_credentials()
    params = {
        "response_type": "code",
        "client_id": UBER_CLIENT_ID,
        "scope": UBER_SCOPES,
        "redirect_uri": UBER_REDIRECT_URI,
        "state": oauth_state,
    }
    return f"{UBER_AUTH_URL}?{urlencode(params)}"


def _token_request(data: dict) -> dict:
    _require_credentials()
    payload = {
        "client_id": UBER_CLIENT_ID,
        "client_secret": UBER_CLIENT_SECRET,
        **data,
    }
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.post(UBER_TOKEN_URL, data=payload)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="A Uber não respondeu a tempo. Tente de novo.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível falar com a Uber agora.",
        ) from exc
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A Uber recusou a autorização. Confira o app no dashboard de desenvolvedor.",
        )
    return response.json()


def exchange_code_for_token(code: str) -> dict:
    return _token_request(
        {
            "grant_type": "authorization_code",
            "redirect_uri": UBER_REDIRECT_URI,
            "code": code,
        }
    )


def refresh_access_token(refresh_token: str) -> dict:
    return _token_request(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
    )


def _authorized_get(path: str, access_token: str, params: dict | None = None) -> dict:
    url = f"{UBER_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept-Language": "pt_BR",
    }
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.get(url, headers=headers, params=params or {})
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="A Uber não respondeu a tempo. Tente de novo.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível falar com a Uber agora.",
        ) from exc
    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão Uber expirada. Conecte a conta de novo.",
        )
    if response.status_code == 403:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este app ainda não tem permissão para esse dado na Uber.",
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A Uber não encontrou um motorista nessa conta.",
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A Uber devolveu um erro ao consultar os dados.",
        )
    return response.json()


def get_profile(access_token: str) -> dict:
    return _authorized_get("/v1/partners/me", access_token)


def get_trips(access_token: str, params: dict | None = None) -> dict:
    return _authorized_get("/v1/partners/trips", access_token, params)


def get_payments(access_token: str, params: dict | None = None) -> dict:
    return _authorized_get("/v1/partners/payments", access_token, params)
