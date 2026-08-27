from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..services import uber as uber_service

router = APIRouter()


@router.get("/status")
def uber_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return uber_service.serialize_connection(uber_service.get_connection(db, user.id))


@router.get("/connect")
def uber_connect(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return uber_service.authenticate(db, user)


@router.get("/callback")
def uber_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if error:
        from ..settings import FRONTEND_URL

        return RedirectResponse(f"{FRONTEND_URL}/uber?erro=negado", status_code=302)
    try:
        destination = uber_service.complete_oauth(db, code, state)
    except HTTPException:
        from ..settings import FRONTEND_URL

        return RedirectResponse(f"{FRONTEND_URL}/uber?erro=falha", status_code=302)
    return RedirectResponse(destination, status_code=302)


@router.delete("/disconnect")
def uber_disconnect(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    uber_service.disconnect(db, user.id)
    return {"connected": False}
