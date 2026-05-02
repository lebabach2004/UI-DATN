// app/screens/DeviceListScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { api } from "../services/api";

// ─── Màu sắc ──────────────────────────────────────────────────
const C = {
  bg:       "#0f1117",
  card:     "#1c1f2e",
  border:   "#2a2d3e",
  primary:  "#4f8ef7",
  green:    "#3ecf8e",
  yellow:   "#f5a623",
  red:      "#e55353",
  textPri:  "#ffffff",
  textSec:  "#8b8fa8",
};

// ─── Helper ────────────────────────────────────────────────────
function batteryColor(v) {
  if (v >= 3.6) return C.green;
  if (v >= 3.2) return C.yellow;
  return C.red;
}

function timeSince(isoStr) {
  if (!isoStr) return "—";
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
  return `${Math.floor(diff / 3600)}h trước`;
}

// ─── Card thiết bị ────────────────────────────────────────────
function DeviceCard({ device, onPress }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {/* Header */}
      <View style={s.cardHeader}>
        <View style={s.dot} />
        <Text style={s.deviceName}>{device.device_name}</Text>
        <Text style={s.lastSeen}>{timeSince(device.last_seen)}</Text>
      </View>

      {/* 4 thông số chính */}
      <View style={s.metricsRow}>
        <MetricBadge label="Nhiệt độ" value={`${device.temperature.toFixed(1)}°C`} color={C.yellow} />
        <MetricBadge label="Độ ẩm"    value={`${device.humidity.toFixed(1)}%`}     color={C.primary} />
        <MetricBadge label="eCO2"     value={`${device.eco2.toFixed(0)}`}           color={C.green}   unit="ppm" />
        <MetricBadge label="TVOC"     value={`${device.tvoc.toFixed(0)}`}           color="#c77dff"   unit="ppb" />
      </View>

      {/* Pin */}
      <View style={s.batteryRow}>
        <Text style={[s.batteryText, { color: batteryColor(device.battery) }]}>
          🔋 {device.battery.toFixed(2)}V
        </Text>
        <Text style={s.devEui}>{device.dev_eui.slice(-8)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MetricBadge({ label, value, color, unit }) {
  return (
    <View style={s.badge}>
      <Text style={[s.badgeValue, { color }]}>{value}</Text>
      {unit && <Text style={[s.badgeUnit, { color }]}> {unit}</Text>}
      <Text style={s.badgeLabel}>{label}</Text>
    </View>
  );
}

// ─── Màn hình chính ───────────────────────────────────────────
export default function DeviceListScreen({ navigation }) {
  const [devices, setDevices]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await api.getDevices();
      setDevices(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Tự làm mới mỗi 30 giây
    const timer = setInterval(() => load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorTitle}>Không kết nối được</Text>
        <Text style={s.errorMsg}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
          <Text style={s.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.screenTitle}>Thiết bị LoRaWAN</Text>
      <Text style={s.screenSub}>{devices.length} thiết bị đang hoạt động</Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.dev_eui}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            onPress={() => navigation.navigate("Detail", { device: item })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.primary}
          />
        }
        ListEmptyComponent={
          <Text style={s.empty}>Chưa có dữ liệu nào. Hãy chạy collector.</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 56 },
  center:      { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  screenTitle: { fontSize: 26, fontWeight: "700", color: C.textPri, marginBottom: 4 },
  screenSub:   { fontSize: 13, color: C.textSec, marginBottom: 20 },

  card:       { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 8 },
  deviceName: { flex: 1, fontSize: 16, fontWeight: "600", color: C.textPri },
  lastSeen:   { fontSize: 12, color: C.textSec },

  metricsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  badge:      { alignItems: "center", flex: 1 },
  badgeValue: { fontSize: 18, fontWeight: "700" },
  badgeUnit:  { fontSize: 11, fontWeight: "600", marginTop: -2 },
  badgeLabel: { fontSize: 11, color: C.textSec, marginTop: 2 },

  batteryRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  batteryText: { fontSize: 13, fontWeight: "600" },
  devEui:      { fontSize: 11, color: C.textSec, fontFamily: "monospace" },

  loadingText: { color: C.textSec, marginTop: 12 },
  errorIcon:   { fontSize: 40, marginBottom: 12 },
  errorTitle:  { fontSize: 18, fontWeight: "700", color: C.textPri, marginBottom: 8 },
  errorMsg:    { fontSize: 13, color: C.textSec, textAlign: "center", marginBottom: 20 },
  retryBtn:    { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:   { color: "#fff", fontWeight: "600" },
  empty:       { color: C.textSec, textAlign: "center", marginTop: 60, fontSize: 14 },
});
