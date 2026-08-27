from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import (
    create_reset_token,
    create_token,
    get_current_user,
    hash_password,
    user_from_reset_token,
    verify_password,
)
from ..database import get_db
from ..models import User
from ..schemas import (
    EmailIn,
    MessageOut,
    RegisterConfirmIn,
    ResetPasswordIn,
    ResetTokenOut,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
)
from ..services import get_or_create_goals, get_or_create_routine
from ..services.codes import (
    PURPOSE_REGISTER,
    PURPOSE_RESET,
    consume_code,
    issue_code,
    require_pending,
)

router = APIRouter()


def _session_for(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=MessageOut)
def register_request(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado.")
    issue_code(
        db,
        email,
        PURPOSE_REGISTER,
        {
            "name": payload.name.strip(),
            "password_hash": hash_password(payload.password),
        },
    )
    return MessageOut(
        message="Enviamos um código de 6 dígitos para o seu e-mail.",
        email=email,
    )


@router.post("/register/resend", response_model=MessageOut)
def register_resend(payload: EmailIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    require_pending(db, email, PURPOSE_REGISTER)
    return MessageOut(
        message="Enviamos um novo código para o seu e-mail.",
        email=email,
    )


@router.post("/register/confirm", response_model=TokenOut)
def register_confirm(payload: RegisterConfirmIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado.")
    data = consume_code(db, email, PURPOSE_REGISTER, payload.code)
    if not data or "name" not in data or "password_hash" not in data:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado. Peça um novo.")
    user = User(name=data["name"], email=email, password_hash=data["password_hash"])
    db.add(user)
    db.commit()
    db.refresh(user)
    get_or_create_routine(db, user.id)
    get_or_create_goals(db, user.id)
    return _session_for(user)


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    get_or_create_routine(db, user.id)
    get_or_create_goals(db, user.id)
    return _session_for(user)


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(payload: EmailIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        issue_code(db, email, PURPOSE_RESET)
    return MessageOut(
        message="Se este e-mail estiver cadastrado, enviamos um código para redefinir a senha.",
        email=email,
    )


@router.post("/reset-password/verify", response_model=ResetTokenOut)
def reset_password_verify(payload: RegisterConfirmIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado. Peça um novo.",
        )
    consume_code(db, email, PURPOSE_RESET, payload.code)
    return ResetTokenOut(
        reset_token=create_reset_token(user.id),
        message="Código confirmado. Defina a nova senha.",
        email=email,
    )


@router.post("/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    if payload.password != payload.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="As senhas não coincidem.",
        )
    user = user_from_reset_token(payload.reset_token, db)
    user.password_hash = hash_password(payload.password)
    db.commit()
    return MessageOut(message="Senha atualizada. Entre com a nova senha.", email=user.email)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
