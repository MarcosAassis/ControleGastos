# Gestão Financeira para Motorista da Uber

Sistema web para o motorista definir a rotina de trabalho, cadastrar gastos, calcular metas de faturamento e acompanhar o lucro do mês.

## Estrutura

- `backend`: FastAPI + SQLAlchemy (SQLite local / PostgreSQL na nuvem)
- `frontend`: React (Vite) + Tailwind CSS, layout focado em celular

## Como rodar localmente

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

No computador, deixe `VITE_API_URL` vazio (ou não crie o arquivo). O Vite encaminha `/api` para o backend local.

## Publicar (Render + Vercel)

Ordem: primeiro a API no Render, depois o site na Vercel.

### 1. Render (API + PostgreSQL)

1. Crie um **PostgreSQL** no Render e copie a **Internal Database URL** (ou External, se precisar).
2. Crie um **Web Service** ligado ao GitHub `MarcosAassis/ControleGastos`:
   - **Root Directory:** `backend`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Variáveis de ambiente:
   - `DATABASE_URL` = URL do Postgres do Render
   - `CORS_ORIGINS` = URL da Vercel, sem barra no final
   - `CORS_ORIGIN_REGEX` = `https://.*\.vercel\.app`
   - `SECRET_KEY` = uma frase longa e aleatória (obrigatória com o login)
   - `RESEND_API_KEY` = chave da Resend (cadastro e recuperação de senha)
   - `RESEND_FROM` = remetente verificado, por exemplo `Gestão Financeira <noreply@seudominio.com>`
4. Health check: `/api/health`

Se o plano gratuito de Postgres não aparecer, use o plano mais barato. O Web Service gratuito do Render pode “dormir”; a primeira abertura do app demora alguns segundos.

### 2. Vercel (frontend)

1. Importe o mesmo repositório.
2. **Root Directory:** `frontend`
3. Build: `npm run build` · Output: `dist`
4. Variável de ambiente:
   - `VITE_API_URL` = URL do Web Service no Render, **sem barra no final**, por exemplo `https://controle-gastos-api.onrender.com`

Essa variável entra no **build**. Se mudar a URL da API, faça um novo deploy na Vercel.

### 3. Fechar o CORS

Quando a Vercel gerar a URL definitiva, coloque-a em `CORS_ORIGINS` no Render e faça **Manual Deploy** da API.

## Cálculo das metas

```
Total necessário = Gastos fixos + Lucro líquido desejado + Reserva de imprevistos
Meta diária     = Total necessário / Dias trabalhados no mês
Meta semanal    = Meta diária × Dias por semana
Meta por hora   = Meta diária / Horas trabalhadas por dia
```

O custo fixo diário usa a mesma divisão, considerando apenas as contas fixas.

## E-mail (Resend)

No cadastro e na recuperação de senha a API envia um código de 6 dígitos, válido por 10 minutos.

No `backend/.env`:

```
RESEND_API_KEY=re_...
RESEND_FROM=Gestão Financeira <onboarding@resend.dev>
```

No plano gratuito da Resend, `onboarding@resend.dev` só entrega para o e-mail da sua conta. Em produção, verifique um domínio e use um remetente desse domínio.
