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
