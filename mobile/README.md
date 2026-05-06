# Mobile App — LoRaWAN Monitor

App React Native (Expo) hiển thị dữ liệu cảm biến từ thiết bị LoRaWAN.

## Chạy app

```bash
npm install
npx expo start
```

## Cấu hình

Sửa IP backend trong `src/services/api.js`:

```js
const BASE_URL = "http://<IP_MÁY_TÍNH>:8001";
```

## Thư viện chính

| Thư viện | Dùng để |
|----------|---------|
| `react-native-svg` | Vẽ biểu đồ line chart |
| `expo-linear-gradient` | Gradient UI |
| `@react-navigation/native-stack` | Điều hướng màn hình |

## Màn hình

- **DeviceListScreen** — Danh sách thiết bị, trạng thái online/offline
- **DeviceDetailScreen** — Biểu đồ từng chỉ số, chọn khoảng thời gian (1h/6h/24h/7 ngày), chạm vào biểu đồ để xem giá trị tại thời điểm đó
