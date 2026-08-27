# Gestão Financeira para Motorista da Uber

Sistema web para o motorista definir a rotina de trabalho, cadastrar gastos, calcular metas de faturamento e acompanhar o lucro do mês.

## Estrutura

- `backend`: FastAPI + SQLAlchemy + SQLite
- `frontend`: React (Vite) + Tailwind CSS, layout focado em celular

## Como rodar

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API em `http://127.0.0.1:8000` e documentação em `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface em `http://127.0.0.1:5173`.

## Cálculo das metas

```
Total necessário = Gastos fixos + Lucro líquido desejado + Reserva de imprevistos
Meta diária     = Total necessário / Dias trabalhados no mês
Meta semanal    = Meta diária × Dias por semana
Meta por hora   = Meta diária / Horas trabalhadas por dia
```

O custo fixo diário usa a mesma divisão, considerando apenas as contas fixas.
