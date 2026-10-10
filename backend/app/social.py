"""Social authentication. Provider tokens are never persisted or sent to the browser."""

import secrets
import time
from typing import Literal
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .config import settings
from .db import get_db
from .models import Membership, OAuthState, Organization, SocialIdentity, User
from .security import hasher, limit, principal, token_hash

router = APIRouter(prefix="/api/auth")
Provider = Literal["google", "github"]


def credentials(provider):
    if provider == "google":
        return settings.google_client_id, settings.google_client_secret
    return settings.github_login_client_id, settings.github_login_client_secret


@router.get("/capabilities")
def capabilities():
    return {
        "google": all(credentials("google")),
        "github": all(credentials("github")),
        "password_recovery": False,
        "email_verification": False,
        "notice": "Personal email is welcome. Social login requires owner-configured OAuth credentials; repository access uses a separate GitHub App.",
    }


@router.get("/oauth/{provider}")
def start(provider: Provider, request: Request, origin: str | None = None, link: bool = False, db=Depends(get_db)):
    limit("oauth:" + request.client.host, 15, 300)
    client_id, secret = credentials(provider)
    if not client_id or not secret:
        raise HTTPException(503, f"{provider.title()} sign-in is not configured. See the OAuth setup guide.")
    origin = origin or settings.app_origin
    if origin not in settings.origins:
        raise HTTPException(403, "Callback origin is not allowed.")
    user_id = principal(request, db)[0].id if link else None
    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(
        OAuthState(
            id=token_hash(state),
            provider=provider,
            nonce=nonce,
            origin=origin,
            link_user_id=user_id,
            expires=time.time() + 600,
        )
    )
    db.commit()
    params = {
        "client_id": client_id,
        "redirect_uri": f"{origin}/api/auth/oauth/{provider}/callback",
        "state": state,
        "scope": "openid email profile" if provider == "google" else "read:user user:email",
    }
    if provider == "google":
        params.update(response_type="code", nonce=nonce)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        if provider == "google"
        else "https://github.com/login/oauth/authorize"
    )
    response = RedirectResponse(url + "?" + urlencode(params), 302)
    response.set_cookie(
        "intervexa_oauth",
        state,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=600,
        path="/api/auth/oauth",
    )
    return response


async def verified_identity(provider, code, state):
    client_id, secret = credentials(provider)
    async with httpx.AsyncClient(timeout=25, follow_redirects=False) as client:
        endpoint = (
            "https://oauth2.googleapis.com/token"
            if provider == "google"
            else "https://github.com/login/oauth/access_token"
        )
        response = await client.post(
            endpoint,
            data={
                "client_id": client_id,
                "client_secret": secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{state.origin}/api/auth/oauth/{provider}/callback",
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        if provider == "google":
            encoded = data["id_token"]
            header = jwt.get_unverified_header(encoded)
            keys = (await client.get("https://www.googleapis.com/oauth2/v3/certs")).json()["keys"]
            key = next((k for k in keys if k["kid"] == header["kid"]), None)
            if key is None:
                raise ValueError("Unknown signing key")
            claims = jwt.decode(
                encoded,
                jwt.PyJWK.from_dict(key).key,
                algorithms=["RS256"],
                audience=client_id,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
            if (
                claims["iss"] not in {"https://accounts.google.com", "accounts.google.com"}
                or claims.get("email_verified") is not True
                or not secrets.compare_digest(claims.get("nonce", ""), state.nonce)
            ):
                raise ValueError("Invalid identity claims")
            return str(claims["sub"]), claims["email"].lower(), claims.get("name", "Developer")[:100]
        headers = {"Authorization": "Bearer " + data["access_token"], "Accept": "application/vnd.github+json"}
        user_response = await client.get("https://api.github.com/user", headers=headers)
        user_response.raise_for_status()
        email_response = await client.get("https://api.github.com/user/emails", headers=headers)
        email_response.raise_for_status()
        user = user_response.json()
        email = next((e["email"] for e in email_response.json() if e.get("primary") and e.get("verified")), None)
        if not email:
            raise ValueError("No verified primary email")
        return str(user["id"]), email.lower(), (user.get("name") or user["login"])[:100]


def resolve_identity(db, provider, subject, email, name, link_user_id=None):
    identity = db.scalar(
        select(SocialIdentity).where(SocialIdentity.provider == provider, SocialIdentity.subject == subject)
    )
    if identity:
        if link_user_id and identity.user_id != link_user_id:
            raise HTTPException(409, "This social identity is already linked to another account.")
        return db.get(User, identity.user_id)
    existing = db.scalar(select(User).where(User.email == email))
    if link_user_id:
        user = db.get(User, link_user_id)
        if existing and existing.id != user.id:
            raise HTTPException(409, "This email belongs to another account.")
    elif existing:
        raise HTTPException(
            409,
            "An account already uses this email. Sign in with your password, then link this provider from account settings.",
        )
    else:
        user = User(email=email, name=name, password=hasher.hash(secrets.token_urlsafe(64)))
        org = Organization(name=name[:80] + " workspace")
        db.add_all([user, org])
        db.flush()
        db.add(Membership(user_id=user.id, org_id=org.id, role="owner"))
    db.add(SocialIdentity(user_id=user.id, provider=provider, subject=subject))
    db.flush()
    return user


@router.get("/oauth/{provider}/callback")
async def callback(provider: Provider, request: Request, code: str = "", state: str = "", db=Depends(get_db)):
    saved = db.get(OAuthState, token_hash(state))
    if (
        not state
        or not code
        or not saved
        or saved.provider != provider
        or saved.expires < time.time()
        or not secrets.compare_digest(request.cookies.get("intervexa_oauth", ""), state)
    ):
        raise HTTPException(403, "OAuth verification expired or failed. Start sign-in again.")
    if saved.link_user_id and principal(request, db)[0].id != saved.link_user_id:
        raise HTTPException(403, "Sign in again before linking this identity.")
    db.delete(saved)
    db.commit()  # Consume state before contacting the provider; callbacks cannot be replayed.
    try:
        subject, email, name = await verified_identity(provider, code, saved)
        if len(subject) > 254 or len(email) > 254 or "@" not in email:
            raise ValueError("Invalid identity")
    except (httpx.HTTPError, ValueError, KeyError, TypeError, StopIteration, jwt.PyJWTError):
        raise HTTPException(502, "Provider identity could not be verified. Retry social sign-in.") from None
    try:
        user = resolve_identity(db, provider, subject, email, name, saved.link_user_id)
        from .main import login_response

        response = RedirectResponse(
            saved.origin + "/app/settings/account" if saved.link_user_id else saved.origin + "/app", 302
        )
        login_response(db, user, response)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Account linking changed. Sign in again and retry.") from None
    response.delete_cookie("intervexa_oauth", path="/api/auth/oauth")
    return response
