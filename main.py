import json
import logging
import os
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
 
import paho.mqtt.client as mqtt
# ─────────────────────────── Paths ────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DB_PATH  = DATA_DIR / "measurements.db"
CSV_PATH = DATA_DIR / "measurements.csv"
LOG_PATH = BASE_DIR / "lorawan_collector.log"

# ─────────────────────────── MQTT ─────────────────────────────
SERVER_ADDRESS = "localhost"
SERVER_PORT    = 1883
CLIENT_ID      = "lorawan_collector_python"
TOPIC          = "application/+/device/+/event/up"
MQTT_USERNAME  = ""
MQTT_PASSWORD  = ""

# ─────────────────────────── Logging ───────────────────────────
log_lock = threading.Lock()
 
def setup_logger() -> logging.Logger:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("lorawan")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s",
                            datefmt="%Y-%m-%d %H:%M:%S")
    fh = logging.FileHandler(LOG_PATH)
    fh.setFormatter(fmt)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger
 
logger = setup_logger()
 
# ──────────────────────────────────────────────────────────────
#  Data model
# ──────────────────────────────────────────────────────────────
@dataclass
class Measurement:
    received_at: str    = ""
    dev_eui: str        = ""
    device_name: str    = ""
    application_id: str = ""
    f_port: int         = 0
    f_cnt: int          = 0
 
    temperature: float  = 0.0
    humidity: float     = 0.0
    battery: float      = 0.0
 
    eco2: float         = 0.0   
    tvoc: float         = 0.0   
 
    rssi: int           = 0
    snr: float          = 0.0
    gateway_id: str     = ""
    raw_json: str       = ""
 
 
# ──────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────
def _str(obj: dict, key: str, default: str = "") -> str:
    v = obj.get(key, default)
    return v if isinstance(v, str) else default
 
def _int(obj: dict, key: str, default: int = 0) -> int:
    v = obj.get(key)
    if v is None:
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default
 
def _float(obj: dict, key: str, default: float = 0.0) -> float:
    v = obj.get(key)
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default
 
 
# ──────────────────────────────────────────────────────────────
#  JSON → Measurement
# ──────────────────────────────────────────────────────────────
def parse_uplink(payload: str) -> Optional[Measurement]:
    try:
        j = json.loads(payload)
    except json.JSONDecodeError as e:
        logger.error("JSON parse error: %s", e)
        return None
 
    try:
        m = Measurement(raw_json=payload)
        m.received_at = _str(j, "time")
 
        di = j.get("deviceInfo", {})
        if isinstance(di, dict):
            m.dev_eui        = _str(di, "devEui")
            m.device_name    = _str(di, "deviceName")
            m.application_id = _str(di, "applicationId")
 
        m.f_port = _int(j, "fPort")
        m.f_cnt  = _int(j, "fCnt")
 
        rx_info = j.get("rxInfo", [])
        if isinstance(rx_info, list) and rx_info:
            rx0 = rx_info[0]
            m.rssi       = _int(rx0, "rssi")
            m.snr        = _float(rx0, "snr")
            m.gateway_id = _str(rx0, "gatewayId")
 
        def fill_metrics(obj: dict):
            m.temperature = _float(obj, "temperature")
            m.humidity    = _float(obj, "humidity")
            m.battery     = _float(obj, "battery")
            m.eco2        = _float(obj, "eco2")
            m.tvoc        = _float(obj, "tvoc")
 
        if "objectJSON" in j and isinstance(j["objectJSON"], str):
            try:
                obj = json.loads(j["objectJSON"])
                if isinstance(obj, dict):
                    fill_metrics(obj)
            except json.JSONDecodeError:
                logger.warning("Failed to parse objectJSON")
        elif "object" in j and isinstance(j["object"], dict):
            fill_metrics(j["object"])
        else:
            logger.warning("No object/objectJSON in uplink payload")
 
        if not m.dev_eui or not m.received_at:
            logger.warning("Skip uplink (missing dev_eui or time)")
            return None
 
        return m
 
    except Exception as e:
        logger.error("parse_uplink error: %s", e)
        return None
 
 
# ──────────────────────────────────────────────────────────────
#  Database
# ──────────────────────────────────────────────────────────────
class Database:
    _REQUIRED_COLUMNS = {
        "battery": "REAL",
        "eco2": "REAL",
        "tvoc": "REAL",
    }
 
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._conn: Optional[sqlite3.Connection] = None
 
    def open(self) -> bool:
        try:
            self._conn = sqlite3.connect(str(self._path), check_same_thread=False)
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._conn.execute("PRAGMA synchronous=NORMAL;")
            logger.info("Opened DB at %s", self._path)
            return self._init()
        except sqlite3.Error as e:
            logger.error("Cannot open DB: %s", e)
            return False
 
    def insert(self, m: Measurement) -> bool:
        sql = """
            INSERT INTO measurements (
                received_at, dev_eui, device_name, application_id,
                f_port, f_cnt, temperature, humidity, battery,
                eco2,tvoc,
                rssi, snr, gateway_id, raw_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """
        params = (
            m.received_at, m.dev_eui, m.device_name, m.application_id,
            m.f_port, m.f_cnt, m.temperature, m.humidity, m.battery, m.eco2, m.tvoc,
            m.rssi, m.snr, m.gateway_id, m.raw_json,
        )
        with self._lock:
            try:
                self._conn.execute(sql, params)
                self._conn.commit()
                return True
            except sqlite3.Error as e:
                logger.error("DB insert error: %s", e)
                return False
 
    # ── private ──────────────────────────────────────────────
    def _init(self) -> bool:
        create_sql = """
            CREATE TABLE IF NOT EXISTS measurements (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at    TEXT,
                dev_eui        TEXT,
                device_name    TEXT,
                application_id TEXT,
                f_port         INTEGER,
                f_cnt          INTEGER,
                temperature    REAL,
                humidity       REAL,
                battery        REAL,
                eco2           REAL,
                tvoc           REAL,
                rssi           INTEGER,
                snr            REAL,
                gateway_id     TEXT,
                raw_json       TEXT
            );
        """
        try:
            self._conn.execute(create_sql)
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_measurements_received_at "
                "ON measurements(received_at);"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_measurements_dev_eui "
                "ON measurements(dev_eui);"
            )
            self._conn.commit()
            logger.info("Ensured measurements table exists")
            return self._ensure_columns()
        except sqlite3.Error as e:
            logger.error("DB init error: %s", e)
            return False
 
    def _ensure_columns(self) -> bool:
        try:
            cur = self._conn.execute("PRAGMA table_info(measurements);")
            existing = {row[1] for row in cur.fetchall()}
 
            for col, col_type in self._REQUIRED_COLUMNS.items():
                if col not in existing:
                    self._conn.execute(
                        f"ALTER TABLE measurements ADD COLUMN {col} {col_type};"
                    )
                    logger.info("Added column: %s %s", col, col_type)
 
            self._conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error("ensure_columns error: %s", e)
            return False
 
 
# ──────────────────────────────────────────────────────────────
#  CSV Writer
# ──────────────────────────────────────────────────────────────
CSV_HEADER = (
    "received_at,dev_eui,device_name,application_id,f_port,f_cnt,"
    "temperature,humidity,battery,eco2,tvoc,rssi,snr,gateway_id"
)
 
 
class CsvWriter:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._file = None
        self._fix_header()
        self._open()
 
    def good(self) -> bool:
        return self._file is not None
 
    def write(self, m: Measurement):
        if not self._file:
            return
        row = (
            f"{m.received_at},{m.dev_eui},{m.device_name},{m.application_id},"
            f"{m.f_port},{m.f_cnt},{m.temperature},{m.humidity},{m.battery},"
            f"{m.eco2},{m.tvoc},{m.rssi},{m.snr},{m.gateway_id}\n"
        )
        with self._lock:
            self._file.write(row)
            self._file.flush()
 
    # ── private ──────────────────────────────────────────────
    def _fix_header(self):
        """Remove duplicate/wrong headers and ensure exactly one correct header."""
        if not self._path.exists():
            return
        try:
            lines = self._path.read_text(encoding="utf-8").splitlines()
            data_lines = [l for l in lines if l.strip() != CSV_HEADER]
            self._path.write_text(
                CSV_HEADER + "\n" + "\n".join(data_lines) + ("\n" if data_lines else ""),
                encoding="utf-8",
            )
        except OSError as e:
            logger.warning("CSV header fix failed: %s", e)
 
    def _open(self):
        try:
            write_header = not self._path.exists()
            self._file = open(self._path, "a", encoding="utf-8", buffering=1)
            if write_header:
                self._file.write(CSV_HEADER + "\n")
                self._file.flush()
            logger.info("CSV writer initialized at %s", self._path)
        except OSError as e:
            logger.error("Cannot open CSV file: %s — %s", self._path, e)
            self._file = None
 
 
# ──────────────────────────────────────────────────────────────
#  MQTT Collector
# ──────────────────────────────────────────────────────────────
class LoRaWANCollector:
    def __init__(self, db: Database, csv: CsvWriter):
        self._db  = db
        self._csv = csv
        self._client = mqtt.Client(client_id=CLIENT_ID, protocol=mqtt.MQTTv311)
 
        if MQTT_USERNAME:
            self._client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
 
        self._client.on_connect     = self._on_connect
        self._client.on_disconnect  = self._on_disconnect
        self._client.on_message     = self._on_message
 
    def start(self):
        logger.info("Connecting to MQTT %s:%d …", SERVER_ADDRESS, SERVER_PORT)
        self._connect()
        self._client.loop_forever()   # blocking; handles reconnect internally
 
    # ── MQTT callbacks ────────────────────────────────────────
    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("MQTT connected. Subscribing to: %s", TOPIC)
            client.subscribe(TOPIC, qos=0)
        else:
            logger.error("MQTT connection failed, rc=%d", rc)
 
    def _on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning("MQTT connection lost (rc=%d). Will auto-reconnect …", rc)
 
    def _on_message(self, client, userdata, msg):
        logger.debug("Message arrived on topic %s", msg.topic)
        m = parse_uplink(msg.payload.decode("utf-8", errors="replace"))
        if m is None:
            return
 
        if not self._db.insert(m):
            logger.error("DB insert failed")
        else:
            logger.info("DB insert OK for devEUI=%s", m.dev_eui)
 
        if self._csv.good():
            self._csv.write(m)
 
    # ── connection ───────────────────────────────────────────
    def _connect(self):
        self._client.reconnect_delay_set(min_delay=2, max_delay=30)
        self._client.connect(SERVER_ADDRESS, SERVER_PORT, keepalive=60)
 
 
# ──────────────────────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────────────────────
def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("=== LoRaWAN Collector v2 (Python) starting ===")
 
    db = Database(DB_PATH)
    if not db.open():
        logger.error("Cannot open DB. Exit.")
        return 1
 
    csv = CsvWriter(CSV_PATH)
    if not csv.good():
        logger.warning("CSV writer not ready. Continuing without CSV.")
 
    collector = LoRaWANCollector(db, csv)
    collector.start()   # blocks forever
    return 0
 
 
if __name__ == "__main__":
    raise SystemExit(main())
 