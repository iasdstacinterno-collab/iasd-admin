"""ChurchFlow - Sistema de Gestao de Igrejas - Backend FastAPI."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import asyncio
import uuid
import bcrypt
import jwt
import httpx
import resend
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Config ---
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALG = os.environ.get('JWT_ALGORITHM', 'HS256')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'iasdstacinterno@gmail.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@2026')
ADMIN_NAME = os.environ.get('ADMIN_NAME', 'Administrador Global')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
GCAL_CLIENT_ID = os.environ.get('GOOGLE_CALENDAR_CLIENT_ID', '')
GCAL_CLIENT_SECRET = os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET', '')
APP_BASE_URL = os.environ.get('APP_BASE_URL', '').rstrip('/')
GCAL_REDIRECT_URI = f"{APP_BASE_URL}/api/oauth/calendar/callback" if APP_BASE_URL else ''
GCAL_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email", "openid"]

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("churchflow")

app = FastAPI(title="ChurchFlow API")
api = APIRouter(prefix="/api")

# ================= Models =================
Role = Literal["ADMIN_GLOBAL", "GERENTE_IGREJA", "PARTICIPANTE"]
AssignStatus = Literal["pendente", "confirmado", "recusado"]

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    role: Role = "PARTICIPANTE"
    church_id: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str = "password"  # password | google
    created_at: datetime

class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    church_id: Optional[str] = None

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class SessionReq(BaseModel):
    session_id: str

class ChurchCreate(BaseModel):
    name: str
    city: Optional[str] = ""
    timezone: str = "America/Sao_Paulo"

class Church(ChurchCreate):
    church_id: str
    created_at: datetime

class MemberCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = ""
    roles: List[str] = []  # cargo/funcao: pregador, musico, diacono etc

class Member(MemberCreate):
    member_id: str
    church_id: str
    user_id: Optional[str] = None
    created_at: datetime

class StepIn(BaseModel):
    id: Optional[str] = None
    name: str
    duration_min: int = 5
    notes: Optional[str] = ""
    suggested_role: Optional[str] = ""

class TemplateCreate(BaseModel):
    name: str
    steps: List[StepIn] = []

class Template(BaseModel):
    template_id: str
    church_id: str
    name: str
    steps: List[StepIn]
    created_at: datetime

class ServiceCreate(BaseModel):
    name: str
    date: datetime
    template_id: Optional[str] = None
    steps: Optional[List[StepIn]] = None

class Service(BaseModel):
    service_id: str
    church_id: str
    name: str
    date: datetime
    steps: List[StepIn]
    created_at: datetime

class AssignmentCreate(BaseModel):
    step_id: str
    member_id: str

class Assignment(BaseModel):
    assignment_id: str
    service_id: str
    step_id: str
    member_id: str
    status: AssignStatus = "pendente"
    created_at: datetime

class ElectionCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    candidates: List[str]  # names or member ids
    ends_at: datetime

class Election(BaseModel):
    election_id: str
    church_id: str
    title: str
    description: str
    candidates: List[str]
    ends_at: datetime
    created_at: datetime
    status: str = "open"  # open | closed

class VoteReq(BaseModel):
    candidate: str

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[List[str]] = None

class DepartmentScheduleEntry(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    member_id: str
    role: Optional[str] = ""
    notes: Optional[str] = ""

class DepartmentScheduleSet(BaseModel):
    year: int
    month: int  # 1-12
    entries: List[DepartmentScheduleEntry]

# ================= Utils =================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_jwt(user_id: str, days: int = 7) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=days), "iat": now_utc()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_jwt(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data.get("sub")
    except Exception:
        return None

async def get_user_by_email(email: str):
    return await db.users.find_one({"email": email}, {"_id": 0})

async def get_user_by_id(user_id: str):
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

async def current_user(request: Request) -> User:
    """Prioriza session_token (cookie/bearer) - Google Auth, depois JWT bearer."""
    token = request.cookies.get("session_token")
    auth = request.headers.get("Authorization", "")
    bearer = auth.split(" ", 1)[1] if auth.startswith("Bearer ") else None
    # Try session_token first (cookie), then bearer as session_token or JWT
    for candidate in [token, bearer]:
        if not candidate:
            continue
        # session_token lookup
        sess = await db.user_sessions.find_one({"session_token": candidate}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp < now_utc():
                continue
            u = await get_user_by_id(sess["user_id"])
            if u:
                return User(**u)
        # JWT fallback
        uid = decode_jwt(candidate)
        if uid:
            u = await get_user_by_id(uid)
            if u:
                return User(**u)
    raise HTTPException(status_code=401, detail="Nao autenticado")

def require_role(*roles: str):
    async def dep(user: User = Depends(current_user)):
        if user.role not in roles and user.role != "ADMIN_GLOBAL":
            raise HTTPException(status_code=403, detail="Permissao negada")
        return user
    return dep

async def send_email_bg(to: str, subject: str, html: str):
    if not RESEND_API_KEY:
        logger.info(f"[email mock] to={to} subject={subject}")
        return
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html
        })
    except Exception as e:
        logger.warning(f"resend fail: {e}")

# ================= Google Calendar =================
async def _gcal_token_exchange(code: str) -> dict:
    """Trocar code por tokens diretamente (evita scope mismatch)."""
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GCAL_CLIENT_ID, "client_secret": GCAL_CLIENT_SECRET,
            "redirect_uri": GCAL_REDIRECT_URI, "grant_type": "authorization_code",
        })
    if r.status_code != 200:
        logger.warning(f"google token exchange failed: {r.text}")
        raise HTTPException(400, "Falha ao trocar codigo por tokens")
    return r.json()

async def _gcal_refresh(refresh_token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.post("https://oauth2.googleapis.com/token", data={
            "refresh_token": refresh_token, "client_id": GCAL_CLIENT_ID,
            "client_secret": GCAL_CLIENT_SECRET, "grant_type": "refresh_token",
        })
    if r.status_code != 200:
        raise HTTPException(401, "Falha ao renovar token Google")
    return r.json()

async def _get_gcal_access_token(user_id: str) -> Optional[str]:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u or not u.get("gcal_tokens"):
        return None
    tokens = u["gcal_tokens"]
    expires_at = tokens.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at - timedelta(minutes=2) < now_utc():
        rt = tokens.get("refresh_token")
        if not rt:
            return None
        try:
            new_t = await _gcal_refresh(rt)
            tokens["access_token"] = new_t["access_token"]
            tokens["expires_at"] = (now_utc() + timedelta(seconds=new_t.get("expires_in", 3600))).isoformat()
            await db.users.update_one({"user_id": user_id}, {"$set": {"gcal_tokens": tokens}})
        except Exception as e:
            logger.warning(f"gcal refresh fail: {e}")
            return None
    return tokens.get("access_token")

async def create_calendar_event(user_id: str, *, summary: str, description: str, start_iso: str, end_iso: str) -> Optional[str]:
    """Cria evento no calendar do usuario com lembretes 24h e 1h. Retorna event_id ou None."""
    access = await _get_gcal_access_token(user_id)
    if not access:
        return None
    body = {
        "summary": summary, "description": description,
        "start": {"dateTime": start_iso}, "end": {"dateTime": end_iso},
        "reminders": {"useDefault": False, "overrides": [
            {"method": "popup", "minutes": 24 * 60},
            {"method": "popup", "minutes": 60},
            {"method": "email", "minutes": 24 * 60},
        ]},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as cli:
            r = await cli.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {access}"}, json=body,
            )
        if r.status_code in (200, 201):
            return r.json().get("id")
        logger.warning(f"gcal create event fail: {r.status_code} {r.text}")
    except Exception as e:
        logger.warning(f"gcal create event exception: {e}")
    return None

async def delete_calendar_event(user_id: str, event_id: str) -> bool:
    access = await _get_gcal_access_token(user_id)
    if not access or not event_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as cli:
            r = await cli.delete(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
                headers={"Authorization": f"Bearer {access}"},
            )
        return r.status_code in (200, 204, 410)
    except Exception:
        return False

# ================= Auth =================
@api.post("/auth/register")
async def register(req: RegisterReq):
    if await get_user_by_email(req.email):
        raise HTTPException(400, "Email ja cadastrado")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": uid, "email": req.email, "name": req.name,
        "password_hash": hash_password(req.password),
        "role": "PARTICIPANTE", "church_id": req.church_id,
        "auth_provider": "password", "picture": None,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(uid)
    return {"token": token, "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}}

@api.post("/auth/login")
async def login(req: LoginReq):
    u = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not u or not u.get("password_hash") or not verify_password(req.password, u["password_hash"]):
        raise HTTPException(401, "Credenciais invalidas")
    token = create_jwt(u["user_id"])
    u.pop("password_hash", None)
    return {"token": token, "user": u}

@api.post("/auth/session")
async def create_session(req: SessionReq, response: Response):
    """Troca session_id do Emergent Google Auth por session_token persistido."""
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(url, headers={"X-Session-ID": req.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Falha ao validar sessao Google")
    data = r.json()
    email = data["email"]
    existing = await get_user_by_email(email)
    if existing:
        uid = existing["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        role = "ADMIN_GLOBAL" if email == ADMIN_EMAIL else "PARTICIPANTE"
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "role": role, "church_id": None,
            "auth_provider": "google", "created_at": now_utc().isoformat(),
        })
    session_token = data["session_token"]
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": uid, "session_token": session_token,
        "expires_at": expires.isoformat(), "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=True, samesite="none", path="/", max_age=7 * 24 * 3600,
    )
    u = await get_user_by_id(uid)
    u.pop("password_hash", None) if u else None
    return {"user": u, "token": session_token}

@api.get("/auth/me")
async def me(user: User = Depends(current_user)):
    return user.model_dump()

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    tok = request.cookies.get("session_token") or ""
    await db.user_sessions.delete_one({"session_token": tok})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ================= Churches =================
@api.get("/churches")
async def list_churches(user: User = Depends(current_user)):
    q = {} if user.role == "ADMIN_GLOBAL" else ({"church_id": user.church_id} if user.church_id else {})
    rows = await db.churches.find(q, {"_id": 0}).to_list(500)
    return rows

@api.post("/churches")
async def create_church(req: ChurchCreate, user: User = Depends(current_user)):
    if user.role != "ADMIN_GLOBAL":
        raise HTTPException(403, "Apenas ADMIN_GLOBAL pode criar igrejas")
    cid = f"ch_{uuid.uuid4().hex[:12]}"
    doc = {"church_id": cid, **req.model_dump(), "created_at": now_utc().isoformat()}
    await db.churches.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.delete("/churches/{church_id}")
async def delete_church(church_id: str, user: User = Depends(current_user)):
    if user.role != "ADMIN_GLOBAL":
        raise HTTPException(403, "Permissao negada")
    await db.churches.delete_one({"church_id": church_id})
    return {"ok": True}

# ================= Members =================
def _church_access(user: User, church_id: str):
    if user.role == "ADMIN_GLOBAL":
        return True
    if user.role == "GERENTE_IGREJA" and user.church_id == church_id:
        return True
    return False

@api.get("/churches/{church_id}/members")
async def list_members(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    rows = await db.members.find({"church_id": church_id}, {"_id": 0}).to_list(1000)
    return rows

@api.post("/churches/{church_id}/members")
async def create_member(church_id: str, req: MemberCreate, user: User = Depends(current_user)):
    if not _church_access(user, church_id):
        raise HTTPException(403, "Permissao negada")
    mid = f"mem_{uuid.uuid4().hex[:12]}"
    doc = {"member_id": mid, "church_id": church_id, **req.model_dump(), "user_id": None, "created_at": now_utc().isoformat()}
    await db.members.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.delete("/members/{member_id}")
async def delete_member(member_id: str, user: User = Depends(current_user)):
    m = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, m["church_id"]):
        raise HTTPException(403, "Permissao negada")
    await db.members.delete_one({"member_id": member_id})
    return {"ok": True}

# ================= Templates =================
@api.get("/churches/{church_id}/templates")
async def list_templates(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    return await db.templates.find({"church_id": church_id}, {"_id": 0}).to_list(500)

@api.post("/churches/{church_id}/templates")
async def create_template(church_id: str, req: TemplateCreate, user: User = Depends(current_user)):
    if not _church_access(user, church_id):
        raise HTTPException(403, "Permissao negada")
    tid = f"tpl_{uuid.uuid4().hex[:12]}"
    steps = [{**s.model_dump(), "id": s.id or f"st_{uuid.uuid4().hex[:8]}"} for s in req.steps]
    doc = {"template_id": tid, "church_id": church_id, "name": req.name, "steps": steps, "created_at": now_utc().isoformat()}
    await db.templates.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.post("/templates/{template_id}/clone")
async def clone_template(template_id: str, user: User = Depends(current_user)):
    t = await db.templates.find_one({"template_id": template_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Template nao encontrado")
    if not _church_access(user, t["church_id"]):
        raise HTTPException(403, "Permissao negada")
    new_id = f"tpl_{uuid.uuid4().hex[:12]}"
    new_doc = {**t, "template_id": new_id, "name": t["name"] + " (copia)", "created_at": now_utc().isoformat()}
    await db.templates.insert_one(new_doc)
    return {k: v for k, v in new_doc.items() if k != "_id"}

# ================= Services =================
@api.get("/churches/{church_id}/services")
async def list_services(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    rows = await db.services.find({"church_id": church_id}, {"_id": 0}).sort("date", -1).to_list(500)
    for r in rows:
        if isinstance(r.get("date"), str):
            r["date"] = r["date"]
    return rows

@api.post("/churches/{church_id}/services")
async def create_service(church_id: str, req: ServiceCreate, user: User = Depends(current_user)):
    if not _church_access(user, church_id):
        raise HTTPException(403, "Permissao negada")
    sid = f"svc_{uuid.uuid4().hex[:12]}"
    steps = []
    if req.template_id:
        t = await db.templates.find_one({"template_id": req.template_id}, {"_id": 0})
        if t:
            steps = [{**s, "id": f"st_{uuid.uuid4().hex[:8]}"} for s in t["steps"]]
    if req.steps:
        steps = [{**s.model_dump(), "id": s.id or f"st_{uuid.uuid4().hex[:8]}"} for s in req.steps]
    if not steps:
        steps = [{"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Abertura", "duration_min": 5, "notes": "", "suggested_role": ""}]
    doc = {
        "service_id": sid, "church_id": church_id, "name": req.name,
        "date": req.date.isoformat() if isinstance(req.date, datetime) else req.date,
        "steps": steps, "created_at": now_utc().isoformat(),
    }
    await db.services.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/services/{service_id}")
async def get_service(service_id: str, user: User = Depends(current_user)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Culto nao encontrado")
    if not _church_access(user, s["church_id"]) and user.church_id != s["church_id"]:
        raise HTTPException(403, "Permissao negada")
    return s

@api.put("/services/{service_id}/steps")
async def update_steps(service_id: str, steps: List[StepIn], user: User = Depends(current_user)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Culto nao encontrado")
    if not _church_access(user, s["church_id"]):
        raise HTTPException(403, "Permissao negada")
    new_steps = [{**st.model_dump(), "id": st.id or f"st_{uuid.uuid4().hex[:8]}"} for st in steps]
    await db.services.update_one({"service_id": service_id}, {"$set": {"steps": new_steps}})
    return {"ok": True, "steps": new_steps}

@api.delete("/services/{service_id}")
async def delete_service(service_id: str, user: User = Depends(current_user)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, s["church_id"]):
        raise HTTPException(403, "Permissao negada")
    await db.services.delete_one({"service_id": service_id})
    await db.assignments.delete_many({"service_id": service_id})
    return {"ok": True}

# ================= Assignments =================
@api.get("/services/{service_id}/assignments")
async def list_assignments(service_id: str, user: User = Depends(current_user)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Culto nao encontrado")
    if not _church_access(user, s["church_id"]) and user.church_id != s["church_id"]:
        raise HTTPException(403, "Permissao negada")
    return await db.assignments.find({"service_id": service_id}, {"_id": 0}).to_list(500)

@api.post("/services/{service_id}/assignments")
async def create_assignment(service_id: str, req: AssignmentCreate, user: User = Depends(current_user)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Culto nao encontrado")
    if not _church_access(user, s["church_id"]):
        raise HTTPException(403, "Permissao negada")
    member = await db.members.find_one({"member_id": req.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Membro nao encontrado")
    aid = f"asg_{uuid.uuid4().hex[:12]}"
    doc = {
        "assignment_id": aid, "service_id": service_id,
        "step_id": req.step_id, "member_id": req.member_id,
        "status": "pendente", "created_at": now_utc().isoformat(),
    }
    await db.assignments.insert_one(doc)
    # Mock Google Calendar log + email
    logger.info(f"[google_calendar mock] evento criado para membro={member['name']} culto={s['name']}")
    await db.notifications.insert_one({
        "notification_id": f"ntf_{uuid.uuid4().hex[:10]}",
        "user_email": member.get("email"), "member_id": req.member_id,
        "title": f"Nova atribuicao: {s['name']}",
        "body": f"Voce foi escalado para o culto '{s['name']}'.",
        "created_at": now_utc().isoformat(), "read": False,
    })
    if member.get("email"):
        asyncio.create_task(send_email_bg(
            member["email"], f"Escalacao: {s['name']}",
            f"<h2>Ola {member['name']}!</h2><p>Voce foi escalado para o culto <b>{s['name']}</b>.</p><p>Acesse o sistema para confirmar.</p>"
        ))
    return {k: v for k, v in doc.items() if k != "_id"}

@api.post("/services/{service_id}/suggest")
async def suggest_assignments(service_id: str, user: User = Depends(current_user)):
    """Sugestao inteligente: para cada etapa com suggested_role, pega membro com esse cargo e menos atribuicoes recentes."""
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Culto nao encontrado")
    if not _church_access(user, s["church_id"]):
        raise HTTPException(403, "Permissao negada")
    church_id = s["church_id"]
    members = await db.members.find({"church_id": church_id}, {"_id": 0}).to_list(1000)
    # Count recent assignments per member (last 30 services)
    recent_services = await db.services.find({"church_id": church_id}, {"_id": 0, "service_id": 1}).sort("date", -1).to_list(30)
    recent_ids = [r["service_id"] for r in recent_services]
    counts = {}
    if recent_ids:
        async for a in db.assignments.find({"service_id": {"$in": recent_ids}}, {"_id": 0}):
            counts[a["member_id"]] = counts.get(a["member_id"], 0) + 1
    suggestions = []
    used = set()
    for step in s["steps"]:
        role = (step.get("suggested_role") or "").strip().lower()
        pool = [m for m in members if (not role or role in [r.lower() for r in (m.get("roles") or [])]) and m["member_id"] not in used]
        if not pool:
            pool = [m for m in members if m["member_id"] not in used]
        if not pool:
            continue
        pool.sort(key=lambda m: counts.get(m["member_id"], 0))
        chosen = pool[0]
        used.add(chosen["member_id"])
        suggestions.append({"step_id": step["id"], "step_name": step["name"], "member_id": chosen["member_id"], "member_name": chosen["name"]})
    return {"suggestions": suggestions}

@api.patch("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, status: str, user: User = Depends(current_user)):
    if status not in ("pendente", "confirmado", "recusado"):
        raise HTTPException(400, "Status invalido")
    a = await db.assignments.find_one({"assignment_id": assignment_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Nao encontrado")
    update = {"status": status}
    # If confirming, try to create calendar event for the user (if they connected Google Calendar)
    if status == "confirmado":
        # Find member -> linked user (by email)
        m = await db.members.find_one({"member_id": a["member_id"]}, {"_id": 0})
        s = await db.services.find_one({"service_id": a["service_id"]}, {"_id": 0})
        target_user = None
        if m and m.get("email"):
            target_user = await db.users.find_one({"email": m["email"]}, {"_id": 0})
        # Or current user themself if they're confirming for themselves
        if not target_user and user.email and m and (not m.get("email") or m["email"].lower() == user.email.lower()):
            target_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        if target_user and s:
            step = next((st for st in s.get("steps", []) if st["id"] == a["step_id"]), {})
            try:
                start = datetime.fromisoformat(s["date"]) if isinstance(s["date"], str) else s["date"]
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                end = start + timedelta(minutes=int(step.get("duration_min", 30)) or 30)
                ev_id = await create_calendar_event(
                    target_user["user_id"],
                    summary=f"{s['name']} - {step.get('name','Etapa')}",
                    description=f"ChurchFlow: voce esta escalado para {step.get('name','etapa')} no culto {s['name']}.",
                    start_iso=start.isoformat(), end_iso=end.isoformat(),
                )
                if ev_id:
                    update["gcal_event_id"] = ev_id
            except Exception as e:
                logger.warning(f"calendar event create skipped: {e}")
    # If refusing and there was a calendar event, delete it
    if status == "recusado" and a.get("gcal_event_id"):
        m = await db.members.find_one({"member_id": a["member_id"]}, {"_id": 0})
        if m and m.get("email"):
            tu = await db.users.find_one({"email": m["email"]}, {"_id": 0})
            if tu:
                await delete_calendar_event(tu["user_id"], a["gcal_event_id"])
        update["gcal_event_id"] = None
    await db.assignments.update_one({"assignment_id": assignment_id}, {"$set": update})
    return {"ok": True, "status": status, "gcal_event_id": update.get("gcal_event_id")}

@api.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, user: User = Depends(current_user)):
    await db.assignments.delete_one({"assignment_id": assignment_id})
    return {"ok": True}

# ================= Elections =================
@api.get("/churches/{church_id}/elections")
async def list_elections(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    rows = await db.elections.find({"church_id": church_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in rows:
        counts = {}
        async for v in db.votes.find({"election_id": r["election_id"]}, {"_id": 0}):
            counts[v["candidate"]] = counts.get(v["candidate"], 0) + 1
        r["results"] = counts
        r["total_votes"] = sum(counts.values())
    return rows

@api.post("/churches/{church_id}/elections")
async def create_election(church_id: str, req: ElectionCreate, user: User = Depends(current_user)):
    if not _church_access(user, church_id):
        raise HTTPException(403, "Permissao negada")
    eid = f"elc_{uuid.uuid4().hex[:12]}"
    doc = {
        "election_id": eid, "church_id": church_id, "title": req.title,
        "description": req.description or "", "candidates": req.candidates,
        "ends_at": req.ends_at.isoformat() if isinstance(req.ends_at, datetime) else req.ends_at,
        "created_at": now_utc().isoformat(), "status": "open",
    }
    await db.elections.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.post("/elections/{election_id}/vote")
async def vote(election_id: str, req: VoteReq, user: User = Depends(current_user)):
    e = await db.elections.find_one({"election_id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Eleicao nao encontrada")
    if req.candidate not in e["candidates"]:
        raise HTTPException(400, "Candidato invalido")
    existing = await db.votes.find_one({"election_id": election_id, "user_id": user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Voto ja registrado")
    await db.votes.insert_one({
        "vote_id": f"vot_{uuid.uuid4().hex[:10]}", "election_id": election_id,
        "user_id": user.user_id, "candidate": req.candidate, "created_at": now_utc().isoformat(),
    })
    return {"ok": True}

@api.post("/elections/{election_id}/close")
async def close_election(election_id: str, user: User = Depends(current_user)):
    e = await db.elections.find_one({"election_id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Nao encontrada")
    if not _church_access(user, e["church_id"]):
        raise HTTPException(403, "Permissao negada")
    await db.elections.update_one({"election_id": election_id}, {"$set": {"status": "closed"}})
    return {"ok": True}

# ================= Notifications =================
@api.get("/notifications")
async def my_notifications(user: User = Depends(current_user)):
    rows = await db.notifications.find(
        {"$or": [{"user_email": user.email}, {"user_id": user.user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return rows

# ================= Departments =================
@api.get("/churches/{church_id}/departments")
async def list_departments(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    rows = await db.departments.find({"church_id": church_id}, {"_id": 0}).to_list(500)
    return rows

@api.post("/churches/{church_id}/departments")
async def create_department(church_id: str, req: DepartmentCreate, user: User = Depends(current_user)):
    if not _church_access(user, church_id):
        raise HTTPException(403, "Permissao negada")
    did = f"dep_{uuid.uuid4().hex[:12]}"
    doc = {
        "department_id": did, "church_id": church_id, "name": req.name,
        "description": req.description or "", "member_ids": [],
        "created_at": now_utc().isoformat(),
    }
    await db.departments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.patch("/departments/{department_id}")
async def update_department(department_id: str, req: DepartmentUpdate, user: User = Depends(current_user)):
    d = await db.departments.find_one({"department_id": department_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, d["church_id"]):
        raise HTTPException(403, "Permissao negada")
    upd = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.departments.update_one({"department_id": department_id}, {"$set": upd})
    return {"ok": True}

@api.delete("/departments/{department_id}")
async def delete_department(department_id: str, user: User = Depends(current_user)):
    d = await db.departments.find_one({"department_id": department_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, d["church_id"]):
        raise HTTPException(403, "Permissao negada")
    await db.departments.delete_one({"department_id": department_id})
    await db.department_schedules.delete_many({"department_id": department_id})
    return {"ok": True}

@api.get("/departments/{department_id}/schedule")
async def get_dep_schedule(department_id: str, year: int, month: int, user: User = Depends(current_user)):
    d = await db.departments.find_one({"department_id": department_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, d["church_id"]) and user.church_id != d["church_id"]:
        raise HTTPException(403, "Permissao negada")
    s = await db.department_schedules.find_one(
        {"department_id": department_id, "year": year, "month": month}, {"_id": 0}
    )
    return s or {"department_id": department_id, "year": year, "month": month, "entries": []}

@api.put("/departments/{department_id}/schedule")
async def set_dep_schedule(department_id: str, req: DepartmentScheduleSet, user: User = Depends(current_user)):
    d = await db.departments.find_one({"department_id": department_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Nao encontrado")
    if not _church_access(user, d["church_id"]):
        raise HTTPException(403, "Permissao negada")
    entries = [e.model_dump() for e in req.entries]
    await db.department_schedules.update_one(
        {"department_id": department_id, "year": req.year, "month": req.month},
        {"$set": {
            "department_id": department_id, "church_id": d["church_id"],
            "year": req.year, "month": req.month, "entries": entries,
            "updated_at": now_utc().isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True, "count": len(entries)}

# ================= Google Calendar OAuth =================
@api.get("/oauth/calendar/login")
async def gcal_login(user: User = Depends(current_user)):
    if not GCAL_CLIENT_ID:
        raise HTTPException(503, "Google Calendar nao configurado")
    state = create_jwt(user.user_id, days=1)
    from urllib.parse import urlencode
    params = {
        "client_id": GCAL_CLIENT_ID, "redirect_uri": GCAL_REDIRECT_URI,
        "response_type": "code", "scope": " ".join(GCAL_SCOPES),
        "access_type": "offline", "prompt": "consent", "state": state,
        "include_granted_scopes": "true",
    }
    return {"authorization_url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"}

@api.get("/oauth/calendar/callback")
async def gcal_callback(code: str, state: str):
    from fastapi.responses import RedirectResponse
    uid = decode_jwt(state)
    if not uid:
        return RedirectResponse(f"{APP_BASE_URL}/dashboard?gcal=erro_state")
    try:
        tokens = await _gcal_token_exchange(code)
    except Exception:
        return RedirectResponse(f"{APP_BASE_URL}/dashboard?gcal=erro_token")
    expires_in = tokens.get("expires_in", 3600)
    saved = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "expires_at": (now_utc() + timedelta(seconds=expires_in)).isoformat(),
        "scope": tokens.get("scope", ""),
        "connected_at": now_utc().isoformat(),
    }
    # Preserve existing refresh_token if Google didn't return a new one
    cur = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if cur and cur.get("gcal_tokens", {}).get("refresh_token") and not saved["refresh_token"]:
        saved["refresh_token"] = cur["gcal_tokens"]["refresh_token"]
    await db.users.update_one({"user_id": uid}, {"$set": {"gcal_tokens": saved}})
    return RedirectResponse(f"{APP_BASE_URL}/dashboard?gcal=ok")

@api.get("/oauth/calendar/status")
async def gcal_status(user: User = Depends(current_user)):
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    tokens = (u or {}).get("gcal_tokens") or {}
    connected = bool(tokens.get("access_token") or tokens.get("refresh_token"))
    return {"connected": connected, "connected_at": tokens.get("connected_at")}

@api.post("/oauth/calendar/disconnect")
async def gcal_disconnect(user: User = Depends(current_user)):
    await db.users.update_one({"user_id": user.user_id}, {"$unset": {"gcal_tokens": ""}})
    return {"ok": True}

# ================= Reports =================
@api.get("/churches/{church_id}/reports")
async def reports(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    members = await db.members.find({"church_id": church_id}, {"_id": 0}).to_list(2000)
    services = await db.services.find({"church_id": church_id}, {"_id": 0}).to_list(500)
    svc_ids = [s["service_id"] for s in services]
    assignments = []
    if svc_ids:
        assignments = await db.assignments.find({"service_id": {"$in": svc_ids}}, {"_id": 0}).to_list(5000)
    by_member = {}
    for a in assignments:
        by_member[a["member_id"]] = by_member.get(a["member_id"], 0) + 1
    member_stats = [
        {"member_id": m["member_id"], "name": m["name"], "roles": m.get("roles", []), "assignments": by_member.get(m["member_id"], 0)}
        for m in members
    ]
    member_stats.sort(key=lambda x: -x["assignments"])
    # Frequency by role
    role_counts = {}
    member_map = {m["member_id"]: m for m in members}
    for a in assignments:
        m = member_map.get(a["member_id"])
        if not m:
            continue
        for r in (m.get("roles") or ["(sem cargo)"]):
            role_counts[r] = role_counts.get(r, 0) + 1
    return {
        "total_members": len(members), "total_services": len(services),
        "total_assignments": len(assignments),
        "member_stats": member_stats, "role_counts": role_counts,
    }

@api.get("/churches/{church_id}/reports/export")
async def export_csv(church_id: str, user: User = Depends(current_user)):
    if not _church_access(user, church_id) and user.church_id != church_id:
        raise HTTPException(403, "Permissao negada")
    members = await db.members.find({"church_id": church_id}, {"_id": 0}).to_list(2000)
    services = await db.services.find({"church_id": church_id}, {"_id": 0}).to_list(500)
    svc_map = {s["service_id"]: s for s in services}
    svc_ids = list(svc_map.keys())
    assignments = await db.assignments.find({"service_id": {"$in": svc_ids}}, {"_id": 0}).to_list(5000) if svc_ids else []
    m_map = {m["member_id"]: m for m in members}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["culto", "data", "etapa", "membro", "cargos", "status"])
    for a in assignments:
        s = svc_map.get(a["service_id"], {})
        step = next((st for st in s.get("steps", []) if st["id"] == a["step_id"]), {})
        m = m_map.get(a["member_id"], {})
        w.writerow([s.get("name", ""), s.get("date", ""), step.get("name", ""), m.get("name", ""), "|".join(m.get("roles", [])), a.get("status", "")])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=relatorio_{church_id}.csv"}
    )

# ================= Seed =================
async def seed_admin():
    admin = await get_user_by_email(ADMIN_EMAIL)
    if admin:
        # ensure role is ADMIN_GLOBAL
        if admin.get("role") != "ADMIN_GLOBAL":
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"role": "ADMIN_GLOBAL"}})
        logger.info(f"Admin ja existe: {ADMIN_EMAIL}")
        return
    uid = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": uid, "email": ADMIN_EMAIL, "name": ADMIN_NAME,
        "password_hash": hash_password(ADMIN_PASSWORD),
        "role": "ADMIN_GLOBAL", "church_id": None,
        "auth_provider": "password", "picture": None,
        "created_at": now_utc().isoformat(),
    })
    logger.info(f"Admin seed criado: {ADMIN_EMAIL}")
    # Seed demo church + members + template
    if await db.churches.count_documents({}) == 0:
        cid = f"ch_{uuid.uuid4().hex[:12]}"
        await db.churches.insert_one({
            "church_id": cid, "name": "IASD Central", "city": "Sao Paulo",
            "timezone": "America/Sao_Paulo", "created_at": now_utc().isoformat(),
        })
        demo_members = [
            ("Pr. Joao Silva", "joao@exemplo.com", ["pregador", "ancestao"]),
            ("Maria Santos", "maria@exemplo.com", ["musico", "louvor"]),
            ("Pedro Alves", "pedro@exemplo.com", ["diacono"]),
            ("Ana Lima", "ana@exemplo.com", ["recepcionista", "louvor"]),
            ("Carlos Souza", "carlos@exemplo.com", ["musico"]),
            ("Beatriz Costa", "bia@exemplo.com", ["licao_sabado"]),
        ]
        for n, e, roles in demo_members:
            await db.members.insert_one({
                "member_id": f"mem_{uuid.uuid4().hex[:12]}", "church_id": cid,
                "name": n, "email": e, "phone": "", "roles": roles,
                "user_id": None, "created_at": now_utc().isoformat(),
            })
        # Demo template
        await db.templates.insert_one({
            "template_id": f"tpl_{uuid.uuid4().hex[:12]}", "church_id": cid,
            "name": "Culto Divino Padrao",
            "steps": [
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Boas-vindas", "duration_min": 5, "notes": "", "suggested_role": "recepcionista"},
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Louvor", "duration_min": 15, "notes": "", "suggested_role": "musico"},
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Oracao Inicial", "duration_min": 5, "notes": "", "suggested_role": "ancestao"},
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Licao da Escola Sabatina", "duration_min": 30, "notes": "", "suggested_role": "licao_sabado"},
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Pregacao", "duration_min": 40, "notes": "", "suggested_role": "pregador"},
                {"id": f"st_{uuid.uuid4().hex[:8]}", "name": "Oracao Final", "duration_min": 5, "notes": "", "suggested_role": "ancestao"},
            ],
            "created_at": now_utc().isoformat(),
        })
        logger.info(f"Igreja demo criada com {len(demo_members)} membros e 1 template")

@app.on_event("startup")
async def on_startup():
    await seed_admin()

@api.get("/")
async def root():
    return {"message": "ChurchFlow API", "version": "1.0"}

app.include_router(api)

_cors_env = os.environ.get('CORS_ORIGINS', '*')
if _cors_env.strip() == '*':
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=[o.strip() for o in _cors_env.split(',')],
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
