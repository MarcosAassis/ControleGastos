from datetime import datetime, timedelta

MOCK_PROFILE = {
    "driver_id": "mock-driver-joao-da-silva",
    "first_name": "João",
    "last_name": "da Silva",
    "email": "joao.motorista.mock@example.com",
    "activation_status": "active",
    "partner_role": "driver",
}

MOCK_TRIPS = [
    {
        "trip_id": "mock-trip-2026-08-20-a",
        "status": "completed",
        "start_time": 1755648000,
        "end_time": 1755649200,
        "fare": 3250,
        "currency_code": "BRL",
    },
    {
        "trip_id": "mock-trip-2026-08-20-b",
        "status": "completed",
        "start_time": 1755652800,
        "end_time": 1755654000,
        "fare": 1890,
        "currency_code": "BRL",
    },
    {
        "trip_id": "mock-trip-2026-08-21-a",
        "status": "completed",
        "start_time": 1755734400,
        "end_time": 1755736200,
        "fare": 4520,
        "currency_code": "BRL",
    },
]


def mock_token_payload() -> dict:
    return {
        "access_token": "mock-access-token",
        "refresh_token": "mock-refresh-token",
        "token_type": "Bearer",
        "expires_in": 2592000,
        "scope": "partner.accounts",
    }


def mock_profile() -> dict:
    return dict(MOCK_PROFILE)


def mock_trips() -> dict:
    return {"count": len(MOCK_TRIPS), "limit": 50, "offset": 0, "trips": MOCK_TRIPS}


def mock_payments() -> dict:
    payments = []
    for trip in MOCK_TRIPS:
        payments.append(
            {
                "payment_id": f"pay-{trip['trip_id']}",
                "trip_id": trip["trip_id"],
                "amount": trip["fare"],
                "currency_code": trip["currency_code"],
                "event_time": trip["end_time"],
            }
        )
    return {"count": len(payments), "limit": 50, "offset": 0, "payments": payments}


def mock_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=30)
