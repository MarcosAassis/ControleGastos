import os

from dotenv import load_dotenv

load_dotenv()


def _split_origins(raw: str) -> list[str]:
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./uber_financas.db")

CORS_ORIGINS = _split_origins(
    os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
)

CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-local-mude-no-render-32chars")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = os.getenv(
    "RESEND_FROM",
    "Gestão Financeira <onboarding@resend.dev>",
).strip()
EMAIL_CODE_TTL_MINUTES = int(os.getenv("EMAIL_CODE_TTL_MINUTES", "10"))
EMAIL_CODE_RESEND_SECONDS = int(os.getenv("EMAIL_CODE_RESEND_SECONDS", "60"))
EMAIL_CODE_MAX_ATTEMPTS = int(os.getenv("EMAIL_CODE_MAX_ATTEMPTS", "5"))

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")

UBER_MOCK = os.getenv("UBER_MOCK", "false").strip().lower() in {"1", "true", "yes"}
UBER_CLIENT_ID = os.getenv("UBER_CLIENT_ID", "").strip()
UBER_CLIENT_SECRET = os.getenv("UBER_CLIENT_SECRET", "").strip()
UBER_REDIRECT_URI = os.getenv(
    "UBER_REDIRECT_URI",
    "http://127.0.0.1:8000/api/uber/callback",
).strip()
UBER_SCOPES = os.getenv("UBER_SCOPES", "partner.accounts offline_access").strip()
UBER_AUTH_URL = "https://auth.uber.com/oauth/v2/authorize"
UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token"
UBER_API_BASE = os.getenv("UBER_API_BASE", "https://api.uber.com").rstrip("/")
