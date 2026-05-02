"""
LoRaWAN FastAPI Backend
Đọc dữ liệu từ SQLite và expose qua REST API.

Chạy:
    pip install fastapi uvicorn
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import sqlite3
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Đường dẫn DB (khớp với lorawan_collector.py) ─────────────
DB_PATH = Path(r"C:\\Users\\Admin\\Downloads\\measurements.db")

app = FastAPI(
    title="LoRaWAN API",
    description="API đọc dữ liệu cảm biến từ LoRaWAN gateway",
    version="1.0.0",
)

# Cho phép React Native gọi API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ────────────────────────────────────────────────────
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


# ─── Helper ────────────────────────────────────────────────────
def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Database không tồn tại tại {DB_PATH}. Hãy chạy lorawan_collector.py trước."
        )
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


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


# ─── Routes ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "LoRaWAN API đang chạy", "docs": "/docs"}


@app.get("/devices", response_model=list[Device])
def get_devices():
    """Danh sách thiết bị + thông số mới nhất của mỗi thiết bị."""
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT
                dev_eui, device_name,
                MAX(received_at) as last_seen,
                temperature, humidity, battery, eco2, tvoc
            FROM measurements
            GROUP BY dev_eui
            ORDER BY last_seen DESC
        """).fetchall()
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
def get_latest(dev_eui: str):
    """Thông số mới nhất của 1 thiết bị."""
    print("DEV_EUI RAW:", repr(dev_eui))
    print("DB_PATH:", DB_PATH)
    conn = get_conn()
    try:
        # row = conn.execute("""
        #     SELECT * FROM measurements
        #     WHERE dev_eui = ?
        #     ORDER BY received_at DESC
        #     LIMIT 1
        # """, (dev_eui,)).fetchone()

        total = conn.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
        print("TOTAL ROWS IN DB:", total)
        
        row = conn.execute("""
            SELECT *
            FROM measurements
            WHERE dev_eui = ?
            ORDER BY id DESC
            LIMIT 1
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
    field: Optional[str] = None,
):
    """Lịch sử đo của 1 thiết bị (mặc định 50 bản ghi gần nhất)."""
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT * FROM measurements
            WHERE dev_eui = ?
            ORDER BY received_at DESC
            LIMIT ?
        """, (dev_eui, limit)).fetchall()

        return [row_to_measurement(r) for r in rows]
    finally:
        conn.close()


@app.get("/devices/{dev_eui}/stats", response_model=list[Stats])
def get_stats(dev_eui: str, hours: int = Query(default=24, ge=1, le=168)):
    """Thống kê trung bình / min / max trong N giờ gần nhất."""
    conn = get_conn()
    try:
        # Kiểm tra thiết bị tồn tại
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
                SELECT
                    AVG({field}) as avg,
                    MIN({field}) as min,
                    MAX({field}) as max,
                    COUNT(*) as count
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
def get_summary():
    """Tổng quan hệ thống: số thiết bị, tổng bản ghi, bản ghi mới nhất."""
    conn = get_conn()
    try:
        total = conn.execute("SELECT COUNT(*) as c FROM measurements").fetchone()["c"]
        devices = conn.execute("SELECT COUNT(DISTINCT dev_eui) as c FROM measurements").fetchone()["c"]
        latest = conn.execute(
            "SELECT received_at FROM measurements ORDER BY received_at DESC LIMIT 1"
        ).fetchone()

        return {
            "total_records": total,
            "total_devices": devices,
            "latest_record": latest["received_at"] if latest else None,
            "db_path": str(DB_PATH),
        }
    finally:
        conn.close()
