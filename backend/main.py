"""
LoRaWAN FastAPI Backend
Chạy: uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

import sqlite3
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

# ─── Config ────────────────────────────────────────────────────
DB_PATH    = Path(__file__).parent.parent / "data" / "measurements.db"
SECRET_KEY = "lorawan-secret-key-change-in-production"
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 ngày

# ─── App ───────────────────────────────────────────────────────
app = FastAPI(title="LoRaWAN API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth utilities ────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer      = HTTPBearer()

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")

def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "building_admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền này")
    return user

def check_device_access(dev_eui: str, user: dict):
    if user.get("role") == "building_admin":
        return
    if user.get("dev_eui") != dev_eui:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập thiết bị này")


# ─── DB helpers ────────────────────────────────────────────────
def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=503, detail=f"Database không tồn tại tại {DB_PATH}.")
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Tạo bảng users và tạo tài khoản admin mặc định nếu chưa có."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'user',
            dev_eui    TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    # Tạo admin mặc định
    exists = conn.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
    if not exists:
        conn.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            ("admin", hash_password("admin"), "building_admin")
        )
        conn.commit()
    conn.close()

@app.on_event("startup")
def on_startup():
    init_db()


# ─── Pydantic models ───────────────────────────────────────────
class Measurement(BaseModel):
    id: int
    received_at: str
    dev_eui: str
    device_name: str
    temperature: float
    humidity: float
    battery: float
    eco2: float
    tvoc: float
    rssi: int
    snr: float
    gateway_id: str

class Device(BaseModel):
    dev_eui: str
    device_name: str
    last_seen: str
    temperature: float
    humidity: float
    battery: float
    eco2: float
    tvoc: float

class Stats(BaseModel):
    dev_eui: str
    device_name: str
    field: str
    avg: float
    min: float
    max: float
    count: int

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"
    dev_eui: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    dev_eui: Optional[str]
    created_at: str


# ─── Row helpers ───────────────────────────────────────────────
def row_to_measurement(row) -> dict:
    return {
        "id":          row["id"],
        "received_at": row["received_at"],
        "dev_eui":     row["dev_eui"],
        "device_name": row["device_name"],
        "temperature": row["temperature"] or 0.0,
        "humidity":    row["humidity"]    or 0.0,
        "battery":     row["battery"]     or 0.0,
        "eco2":        row["eco2"]        or 0.0,
        "tvoc":        row["tvoc"]        or 0.0,
        "rssi":        row["rssi"]        or 0,
        "snr":         row["snr"]         or 0.0,
        "gateway_id":  row["gateway_id"]  or "",
    }


# ─── Auth routes ───────────────────────────────────────────────
@app.post("/auth/login")
def login(body: LoginRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    finally:
        conn.close()

    if not row or not verify_password(body.password, row["password"]):
        raise HTTPException(status_code=401, detail="Sai tên đăng nhập hoặc mật khẩu")

    token = create_token({
        "sub":     row["username"],
        "role":    row["role"],
        "dev_eui": row["dev_eui"],
        "user_id": row["id"],
    })
    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         row["role"],
        "dev_eui":      row["dev_eui"],
        "username":     row["username"],
    }


@app.get("/auth/users", response_model=list[UserOut])
def list_users(admin: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, username, role, dev_eui, created_at FROM users ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.post("/auth/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, admin: dict = Depends(require_admin)):
    if body.role not in ("user", "building_admin"):
        raise HTTPException(status_code=400, detail="Role không hợp lệ")
    if body.role == "user" and not body.dev_eui:
        raise HTTPException(status_code=400, detail="User phải được gán một node (dev_eui)")

    conn = get_conn()
    try:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password, role, dev_eui) VALUES (?, ?, ?, ?)",
                (body.username, hash_password(body.password), body.role, body.dev_eui)
            )
            conn.commit()
            row = conn.execute(
                "SELECT id, username, role, dev_eui, created_at FROM users WHERE id = ?",
                (cur.lastrowid,)
            ).fetchone()
            return dict(row)
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Tên đăng nhập đã tồn tại")
    finally:
        conn.close()


@app.put("/auth/password")
def change_password(body: PasswordChange, user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["user_id"],)).fetchone()
        if not row or not verify_password(body.current_password, row["password"]):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
        if len(body.new_password) < 4:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 4 ký tự")
        conn.execute("UPDATE users SET password = ? WHERE id = ?",
                     (hash_password(body.new_password), user["user_id"]))
        conn.commit()
        return {"message": "Đổi mật khẩu thành công"}
    finally:
        conn.close()


@app.delete("/auth/users/{user_id}", status_code=204)
def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User không tồn tại")
        if row["username"] == "admin":
            raise HTTPException(status_code=400, detail="Không thể xóa tài khoản admin gốc")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


# ─── Device routes ─────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "LoRaWAN API v2", "docs": "/docs"}


@app.get("/devices", response_model=list[Device])
def get_devices(user: dict = Depends(get_current_user)):
    conn = get_conn()
    try:
        if user.get("role") == "building_admin":
            rows = conn.execute("""
                SELECT dev_eui, device_name, MAX(received_at) as last_seen,
                       temperature, humidity, battery, eco2, tvoc
                FROM measurements
                GROUP BY dev_eui
                ORDER BY last_seen DESC
            """).fetchall()
        else:
            rows = conn.execute("""
                SELECT dev_eui, device_name, MAX(received_at) as last_seen,
                       temperature, humidity, battery, eco2, tvoc
                FROM measurements
                WHERE dev_eui = ?
                GROUP BY dev_eui
            """, (user.get("dev_eui"),)).fetchall()

        return [
            {
                "dev_eui":     r["dev_eui"],
                "device_name": r["device_name"],
                "last_seen":   r["last_seen"],
                "temperature": r["temperature"] or 0.0,
                "humidity":    r["humidity"]    or 0.0,
                "battery":     r["battery"]     or 0.0,
                "eco2":        r["eco2"]        or 0.0,
                "tvoc":        r["tvoc"]        or 0.0,
            }
            for r in rows
        ]
    finally:
        conn.close()


@app.get("/devices/{dev_eui}/latest", response_model=Measurement)
def get_latest(dev_eui: str, user: dict = Depends(get_current_user)):
    check_device_access(dev_eui, user)
    conn = get_conn()
    try:
        row = conn.execute("""
            SELECT * FROM measurements
            WHERE dev_eui = ?
            ORDER BY id DESC LIMIT 1
        """, (dev_eui,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")
        return row_to_measurement(row)
    finally:
        conn.close()


@app.get("/devices/{dev_eui}/history", response_model=list[Measurement])
def get_history(
    dev_eui: str,
    limit: int = Query(default=50, ge=1, le=500),
    hours: Optional[int] = Query(default=None, ge=1, le=720),
    user: dict = Depends(get_current_user),
):
    check_device_access(dev_eui, user)
    conn = get_conn()
    try:
        if hours is not None:
            rows = conn.execute("""
                SELECT * FROM measurements
                WHERE dev_eui = ?
                  AND received_at >= datetime('now', ?)
                ORDER BY received_at DESC LIMIT ?
            """, (dev_eui, f"-{hours} hours", limit)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM measurements
                WHERE dev_eui = ?
                ORDER BY received_at DESC LIMIT ?
            """, (dev_eui, limit)).fetchall()
        return [row_to_measurement(r) for r in rows]
    finally:
        conn.close()


@app.get("/devices/{dev_eui}/stats", response_model=list[Stats])
def get_stats(
    dev_eui: str,
    hours: int = Query(default=24, ge=1, le=168),
    user: dict = Depends(get_current_user),
):
    check_device_access(dev_eui, user)
    conn = get_conn()
    try:
        exists = conn.execute(
            "SELECT 1 FROM measurements WHERE dev_eui = ? LIMIT 1", (dev_eui,)
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")

        device_name = conn.execute(
            "SELECT device_name FROM measurements WHERE dev_eui = ? LIMIT 1", (dev_eui,)
        ).fetchone()["device_name"]

        result = []
        for field in ["temperature", "humidity", "battery", "eco2", "tvoc"]:
            row = conn.execute(f"""
                SELECT AVG({field}) as avg, MIN({field}) as min,
                       MAX({field}) as max, COUNT(*) as count
                FROM measurements
                WHERE dev_eui = ?
                  AND received_at >= datetime('now', '-{hours} hours')
            """, (dev_eui,)).fetchone()
            result.append({
                "dev_eui":     dev_eui,
                "device_name": device_name,
                "field":       field,
                "avg":         round(row["avg"] or 0.0, 2),
                "min":         round(row["min"] or 0.0, 2),
                "max":         round(row["max"] or 0.0, 2),
                "count":       row["count"] or 0,
            })
        return result
    finally:
        conn.close()


@app.get("/summary")
def get_summary(admin: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        total   = conn.execute("SELECT COUNT(*) as c FROM measurements").fetchone()["c"]
        devices = conn.execute("SELECT COUNT(DISTINCT dev_eui) as c FROM measurements").fetchone()["c"]
        latest  = conn.execute(
            "SELECT received_at FROM measurements ORDER BY received_at DESC LIMIT 1"
        ).fetchone()
        return {
            "total_records": total,
            "total_devices": devices,
            "latest_record": latest["received_at"] if latest else None,
            "db_path":       str(DB_PATH),
        }
    finally:
        conn.close()
