"""Auth routes: register / login / me."""
import json

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import StudentProfile, User
from app.schemas.schemas import AuthResponse, LoginRequest, RegisterRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> AuthResponse:
    token = create_access_token(subject=str(user.id))
    return AuthResponse(access_token=token, token_type="bearer",
                        user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: DbSession):
    existing = db.query(User).filter(
        func.lower(User.email) == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(full_name=payload.full_name.strip(), email=payload.email.strip(),
                hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(StudentProfile(
        user_id=user.id, college=payload.college, degree=payload.degree,
        branch=payload.branch, graduation_year=payload.graduation_year,
        current_year=payload.current_year,
    ))
    if payload.career_interests:
        profile = db.query(StudentProfile).filter(
            StudentProfile.user_id == user.id).first()
        if profile:
            profile.interests = json.dumps(payload.career_interests)
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbSession):
    user = db.query(User).filter(
        func.lower(User.email) == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return UserOut.model_validate(user)
