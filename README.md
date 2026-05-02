# LoRaWAN Monitor

Hệ thống giám sát môi trường qua LoRaWAN gồm backend FastAPI và app React Native (Expo).

## Cấu trúc project

```
lorawan_project/
├── backend/
│   ├── main.py              ← FastAPI server (port 8001)
│   └── requirements.txt
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── DeviceListScreen.js   ← Màn hình danh sách thiết bị
│   │   │   └── DeviceDetailScreen.js ← Màn hình chi tiết + biểu đồ
│   │   └── services/
│   │       └── api.js       ← Cấu hình URL gọi backend
│   ├── app.json
│   └── package.json
└── README.md
```

Database: `C:\Users\Admin\Downloads\measurements.db`

---

## BƯỚC 1 — Chạy backend FastAPI

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Kiểm tra tại: http://localhost:8001/docs

---

## BƯỚC 2 — Tìm IP máy tính trên LAN

```
ipconfig
```

Tìm dòng `IPv4 Address`, ví dụ: `192.168.1.12`

---

## BƯỚC 3 — Sửa IP trong app

Mở `mobile/src/services/api.js`, sửa dòng:

```js
const BASE_URL = "http://192.168.1.12:8001"; // ← IP máy tính của bạn
```

---

## BƯỚC 4 — Chạy app React Native

```bash
cd mobile
npm install       # chỉ lần đầu
npx expo start
```

Màn hình hiện QR code → mở **Expo Go** trên điện thoại → quét QR.

> Điện thoại và máy tính phải cùng WiFi.

---

## API endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | `/devices` | Danh sách thiết bị + thông số mới nhất |
| GET | `/devices/{devEui}/latest` | Thông số mới nhất của 1 thiết bị |
| GET | `/devices/{devEui}/history?limit=50` | N bản ghi gần nhất |
| GET | `/devices/{devEui}/history?limit=100&hours=6` | Bản ghi trong 6 giờ qua |
| GET | `/devices/{devEui}/stats?hours=24` | Thống kê TB/min/max theo giờ |
| GET | `/summary` | Tổng quan hệ thống |

---

## Ngưỡng cảnh báo

| Thông số | Cảnh báo | Nguy hiểm |
|----------|----------|-----------|
| Nhiệt độ | > 35°C   | > 40°C    |
| Độ ẩm    | > 80%    | > 90%     |
| eCO₂     | > 1000 ppm | > 2000 ppm |
| TVOC     | > 300 ppb  | > 500 ppb  |
| Pin      | < 3.3 V  | < 3.0 V   |

---

## Lỗi thường gặp

**App không kết nối được API**
- Kiểm tra IP trong `api.js` đúng chưa
- Máy tính và điện thoại cùng WiFi chưa
- Backend đang chạy chưa (`uvicorn main:app --port 8001`)

**Biểu đồ hiện dữ liệu cũ dù chọn "1 giờ" / "6 giờ"**
- Backend cần hỗ trợ tham số `hours` trong endpoint `/history`
- Xem phần API endpoints ở trên để kiểm tra backend đã được cập nhật chưa

**Database không tồn tại**
- Đảm bảo `lorawan_collector.py` đã chạy và ghi dữ liệu vào `measurements.db`
- Kiểm tra đường dẫn DB trong `backend/main.py`: `DB_PATH`
