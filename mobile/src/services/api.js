// app/services/api.js
// Đổi IP này thành IP máy tính của bạn trên LAN
// Ví dụ: 192.168.1.100:8000
// Không dùng localhost vì điện thoại và máy tính khác nhau

const BASE_URL = "http://192.168.1.12:8001"; // ← ĐỔI IP NÀY

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Lỗi ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Lấy danh sách thiết bị + thông số mới nhất
  getDevices: () => fetchJSON("/devices"),

  // Thông số mới nhất của 1 thiết bị
  getLatest: (devEui) => fetchJSON(`/devices/${devEui}/latest`),

  // Lịch sử bản ghi gần nhất, lọc theo số giờ nếu có
  getHistory: (devEui, limit = 50, hours = null) =>
    fetchJSON(`/devices/${devEui}/history?limit=${limit}${hours ? `&hours=${hours}` : ""}`),

  // Thống kê 24h
  getStats: (devEui, hours = 24) =>
    fetchJSON(`/devices/${devEui}/stats?hours=${hours}`),

  // Tổng quan hệ thống
  getSummary: () => fetchJSON("/summary"),
};
