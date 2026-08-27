import resend
from fastapi import HTTPException, status

from ..settings import RESEND_API_KEY, RESEND_FROM

APP_NAME = "Gestão Financeira"


def _html_code(title: str, intro: str, code: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0b1f16;font-family:Arial,sans-serif;color:#ecfdf5;">
    <div style="max-width:480px;margin:0 auto;background:#123126;border-radius:16px;padding:28px;border:1px solid #1f4a38;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#86efac;">Motorista Uber</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#ecfdf5;">{title}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#d1fae5;">{intro}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#86efac;">Seu código:</p>
      <p style="margin:0 0 20px;font-size:32px;letter-spacing:0.28em;font-weight:bold;color:#bbf7d0;">{code}</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#a7f3d0;">
        Ele vale por 10 minutos. Se você não pediu este código, ignore este e-mail.
      </p>
    </div>
  </body>
</html>
"""


def send_code_email(to_email: str, code: str, purpose: str) -> None:
    if not RESEND_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O envio de e-mail ainda não está configurado. Peça para definir RESEND_API_KEY.",
        )

    if purpose == "register":
        subject = f"Seu código de cadastro — {APP_NAME}"
        title = "Confirme seu cadastro"
        intro = "Use o código abaixo para criar sua conta e começar a acompanhar metas, gastos e ganhos."
    elif purpose == "login":
        subject = f"Seu código de acesso — {APP_NAME}"
        title = "Entrar na conta"
        intro = "Use o código abaixo para entrar no app, sem precisar da senha."
    else:
        subject = f"Seu código de recuperação — {APP_NAME}"
        title = "Redefinir senha"
        intro = "Use o código abaixo para criar uma nova senha da sua conta."

    resend.api_key = RESEND_API_KEY
    try:
        result = resend.Emails.send(
            {
                "from": RESEND_FROM,
                "to": [to_email],
                "subject": subject,
                "html": _html_code(title, intro, code),
                "text": f"{intro}\n\nCódigo: {code}\nVálido por 10 minutos.",
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível enviar o e-mail agora. Tente de novo em instantes.",
        ) from exc

    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível enviar o e-mail agora. Confira o remetente na Resend.",
        )
