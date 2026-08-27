from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, migrate_schema
from .routers import dashboard, ganhos, gastos_fixos, gastos_variaveis, metas, rotina
from .services import ensure_defaults
from .settings import CORS_ORIGIN_REGEX, CORS_ORIGINS

Base.metadata.create_all(bind=engine)
migrate_schema()
ensure_defaults()

app = FastAPI(
    title="Gestão Financeira para Motorista da Uber",
    description="Controle de rotina, gastos, metas e ganhos diários.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rotina.router, prefix="/api/rotina", tags=["Rotina"])
app.include_router(gastos_fixos.router, prefix="/api/gastos-fixos", tags=["Gastos Fixos"])
app.include_router(
    gastos_variaveis.router, prefix="/api/gastos-variaveis", tags=["Gastos Variáveis"]
)
app.include_router(metas.router, prefix="/api/metas", tags=["Metas"])
app.include_router(ganhos.router, prefix="/api/ganhos", tags=["Ganhos"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
