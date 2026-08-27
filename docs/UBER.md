# Integração experimental com a Uber Driver API

Não faz scraping e não guarda senha da Uber. O login do motorista continua sendo o do próprio app.

A **etapa 1** cobre a **conexão da conta** (OAuth 2.0). Importação de corridas e pagamentos fica para a etapa 2.

O padrão do app é **API real** (`UBER_MOCK=false`). MOCK só se você ligar de propósito.

## Variáveis de ambiente

No `backend/.env` e no Render (veja `backend/.env.example`):

```
FRONTEND_URL=https://seu-app.vercel.app
UBER_MOCK=false
UBER_CLIENT_ID=
UBER_CLIENT_SECRET=
UBER_REDIRECT_URI=https://seu-servico.onrender.com/api/uber/callback
UBER_SCOPES=partner.accounts offline_access
```

- `UBER_CLIENT_SECRET` fica só no backend.
- O frontend nunca recebe `access_token` nem `refresh_token`.
- `UBER_REDIRECT_URI` tem que ser **idêntico** ao cadastrado no dashboard da Uber.

Localmente, se for testar a Uber de verdade:

```
FRONTEND_URL=http://127.0.0.1:5173
UBER_REDIRECT_URI=http://127.0.0.1:8000/api/uber/callback
UBER_MOCK=false
```

## App na Uber

1. Crie o app em [developer.uber.com](https://developer.uber.com).
2. Na aba Auth: copie Client ID e Client Secret para o Render.
3. Cadastre o Redirect URI de produção (URL do Render + `/api/uber/callback`).
4. Scopes desta etapa: `partner.accounts` e `offline_access` (refresh token, conforme a documentação do POST `/token`).
5. Depois, para corridas e pagamentos: `partner.trips` e `partner.payments`.
6. A Driver API tem acesso limitado; em produção o app precisa de aprovação. Sem isso, a Uber pode responder 403.

Documentação oficial usada:

- OAuth: [Authentication](https://developer.uber.com/docs/drivers/guides/authentication)
- Token: `POST https://auth.uber.com/oauth/v2/token`
- Authorize: `GET https://auth.uber.com/oauth/v2/authorize`
- Perfil: `GET https://api.uber.com/v1/partners/me`
- Corridas (etapa 2): `GET https://api.uber.com/v1/partners/trips`
- Pagamentos (etapa 2): `GET https://api.uber.com/v1/partners/payments`

## MOCK (opcional, só para desenvolvimento)

```
UBER_MOCK=true
```

Simula o OAuth e usa o motorista fictício João da Silva, sem chamar a Uber.

## Endpoints do nosso backend

| Método | Caminho | Quem chama |
| --- | --- | --- |
| GET | `/api/uber/connect` | App logado; devolve `authorize_url` |
| GET | `/api/uber/callback` | Uber; troca o `code` e redireciona ao site |
| GET | `/api/uber/status` | App logado; status sem tokens |
| DELETE | `/api/uber/disconnect` | App logado; apaga a ligação |

## Limitações

- Sem aprovação da Uber, a API real pode recusar os scopes de motorista.
- A etapa 1 não importa corridas nem ganhos.
- Tokens são guardados criptografados com chave derivada de `SECRET_KEY`. Trocar `SECRET_KEY` invalida os tokens salvos.
