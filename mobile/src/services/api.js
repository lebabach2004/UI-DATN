import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL  = "http://localhost:8001";
const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

async function fetchJSON(path, options = {}) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Lỗi ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────
  login: async (username, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Đăng nhập thất bại");
    }
    const data = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ role: data.role, dev_eui: data.dev_eui, username: data.username }));
    return data;
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  },

  getStoredUser: async () => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  changePassword: (current_password, new_password) =>
    fetchJSON("/auth/password", { method: "PUT", body: JSON.stringify({ current_password, new_password }) }),

  // ── Users (admin) ────────────────────────────────────────────
  getUsers:   ()            => fetchJSON("/auth/users"),
  createUser: (body)        => fetchJSON("/auth/users", { method: "POST", body: JSON.stringify(body) }),
  deleteUser: (id)          => fetchJSON(`/auth/users/${id}`, { method: "DELETE" }),

  // ── Devices ─────────────────────────────────────────────────
  getDevices: ()            => fetchJSON("/devices"),
  getLatest:  (devEui)      => fetchJSON(`/devices/${devEui}/latest`),

  getHistory: (devEui, limit = 50, hours = null) =>
    fetchJSON(`/devices/${devEui}/history?limit=${limit}${hours ? `&hours=${hours}` : ""}`),

  getStats: (devEui, hours = 24) =>
    fetchJSON(`/devices/${devEui}/stats?hours=${hours}`),

  getSummary: () => fetchJSON("/summary"),
};
