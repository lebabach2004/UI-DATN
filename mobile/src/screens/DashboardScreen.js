import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useThreshold, DEFAULT_THRESHOLDS } from "../context/ThresholdContext";

// ─── Helpers ──────────────────────────────────────────────────
const FIELD_META = {
  temperature: { label: "Nhiệt độ", icon: "🌡️", unit: "°C",  precision: 1 },
  humidity:    { label: "Độ ẩm",    icon: "💧", unit: "%",    precision: 1 },
  eco2:        { label: "eCO₂",     icon: "🌿", unit: " ppm", precision: 0 },
  tvoc:        { label: "TVOC",     icon: "🧪", unit: " ppb", precision: 0 },
  battery:     { label: "Pin",      icon: "🔋", unit: " V",   precision: 2 },
};

const STATUS_COLOR = { ok: null, warn: "#f59e0b", danger: "#ef4444" };
const STATUS_LABEL = { ok: "Bình thường", warn: "Cảnh báo", danger: "Nguy hiểm" };

function isOnline(lastSeen, minutes = 10) {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < minutes * 60 * 1000;
}

function getStatus(value, cfg) {
  if (cfg.dangerHigh != null && value >= cfg.dangerHigh) return "danger";
  if (cfg.dangerLow  != null && value <= cfg.dangerLow)  return "danger";
  if (cfg.warnHigh   != null && value >= cfg.warnHigh)   return "warn";
  if (cfg.warnLow    != null && value <= cfg.warnLow)    return "warn";
  return "ok";
}

function getDeviceAlerts(device, thresholds) {
  const alerts = [];
  let maxLevel = "ok";
  for (const field of Object.keys(FIELD_META)) {
    const value = device[field];
    if (value == null) continue;
    const cfg = { ...DEFAULT_THRESHOLDS[field], ...(thresholds[field] || {}) };
    const status = getStatus(value, cfg);
    if (status !== "ok") {
      alerts.push({ field, status, value });
      if (status === "danger") maxLevel = "danger";
      else if (status === "warn" && maxLevel !== "danger") maxLevel = "warn";
    }
  }
  return { maxLevel, alerts };
}

// ─── Summary card ─────────────────────────────────────────────
function SummaryCard({ value, label, color, s }) {
  return (
    <View style={[s.sumCard, color && { borderColor: color + "55" }]}>
      <Text style={[s.sumVal, { color: color || s._C.text1 }]}>{value}</Text>
      <Text style={s.sumLbl}>{label}</Text>
    </View>
  );
}

// ─── Node status row ──────────────────────────────────────────
function NodeRow({ device, onPress, s, C }) {
  const { getThresholds } = useThreshold();
  const thresholds = getThresholds(device.dev_eui);
  const online = isOnline(device.last_seen);
  const { maxLevel, alerts } = getDeviceAlerts(device, thresholds);
  const alertColor = STATUS_COLOR[maxLevel];

  return (
    <TouchableOpacity style={[s.nodeRow, alertColor && { borderColor: alertColor + "55" }]}
      onPress={onPress} activeOpacity={0.75}>
      <View style={s.nodeLeft}>
        {/* Trạng thái online */}
        <View style={[s.statusDot, { backgroundColor: online ? C.green : C.red }]} />
        <View style={s.nodeInfo}>
          <View style={s.nameRow}>
            <Text style={s.nodeName}>{device.device_name}</Text>
            {!online && (
              <View style={[s.pill, { borderColor: C.red, backgroundColor: C.red + "18" }]}>
                <Text style={[s.pillTxt, { color: C.red }]}>Mất kết nối</Text>
              </View>
            )}
            {online && maxLevel !== "ok" && (
              <View style={[s.pill, { borderColor: alertColor, backgroundColor: alertColor + "18" }]}>
                <Text style={[s.pillTxt, { color: alertColor }]}>{STATUS_LABEL[maxLevel]}</Text>
              </View>
            )}
          </View>

          {online ? (
            <View style={s.metricsLine}>
              {["temperature", "humidity", "eco2"].map((f) => (
                <Text key={f} style={s.metricChip}>
                  {FIELD_META[f].icon} {device[f]?.toFixed(FIELD_META[f].precision)}{FIELD_META[f].unit}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={s.lastSeenTxt}>
              Lần cuối: {device.last_seen
                ? new Date(device.last_seen).toLocaleString("vi-VN")
                : "Không rõ"}
            </Text>
          )}

          {/* Danh sách cảnh báo đang kích hoạt */}
          {online && alerts.length > 0 && (
            <View style={s.alertLine}>
              {alerts.map(({ field, status, value }) => (
                <Text key={field} style={[s.alertChip, { color: STATUS_COLOR[status] }]}>
                  {FIELD_META[field].icon} {value.toFixed(FIELD_META[field].precision)}{FIELD_META[field].unit}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { getThresholds } = useThreshold();

  const [devices,    setDevices]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

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
    const t = setInterval(() => load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const totalCount   = devices.length;
    const onlineCount  = devices.filter((d) => isOnline(d.last_seen)).length;
    const offlineCount = totalCount - onlineCount;
    let warnCount = 0, dangerCount = 0;
    for (const d of devices) {
      if (!isOnline(d.last_seen)) continue;
      const { maxLevel } = getDeviceAlerts(d, getThresholds(d.dev_eui));
      if (maxLevel === "danger") dangerCount++;
      else if (maxLevel === "warn") warnCount++;
    }
    const normalCount = onlineCount - warnCount - dangerCount;
    return { totalCount, onlineCount, offlineCount, warnCount, dangerCount, normalCount };
  }, [devices, getThresholds]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errTxt}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
          <Text style={s.retryTxt}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.primary} />}
    >
      {/* Summary */}
      <Text style={s.sectionTitle}>TỔNG QUAN</Text>
      <View style={s.sumRow}>
        <SummaryCard value={stats.totalCount}  label="Tổng node"  color={C.primary} s={{ ...s, _C: C }} />
        <SummaryCard value={stats.onlineCount} label="Online"     color={C.green}   s={{ ...s, _C: C }} />
        <SummaryCard value={stats.offlineCount} label="Offline"   color={stats.offlineCount > 0 ? C.red : C.text3} s={{ ...s, _C: C }} />
      </View>
      <View style={[s.sumRow, { marginTop: 8 }]}>
        <SummaryCard value={stats.warnCount}   label="Cảnh báo"   color={stats.warnCount   > 0 ? C.yellow : C.text3} s={{ ...s, _C: C }} />
        <SummaryCard value={stats.dangerCount} label="Nguy hiểm"  color={stats.dangerCount > 0 ? C.red    : C.text3} s={{ ...s, _C: C }} />
        <SummaryCard value={stats.normalCount} label="Bình thường" color={C.text3} s={{ ...s, _C: C }} />
      </View>

      {/* Node list */}
      <Text style={s.sectionTitle}>TRẠNG THÁI NODE</Text>
      {devices.map((d) => (
        <NodeRow
          key={d.dev_eui}
          device={d}
          s={s}
          C={C}
          onPress={() => navigation.navigate("Detail", { device: d })}
        />
      ))}
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 1.2, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },

    sumRow:  { flexDirection: "row", marginHorizontal: 16, gap: 8 },
    sumCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border },
    sumVal:  { fontSize: 28, fontWeight: "800" },
    sumLbl:  { fontSize: 11, color: C.text3, marginTop: 3, textAlign: "center" },

    nodeRow:    { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center" },
    nodeLeft:   { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
    statusDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    nodeInfo:   { flex: 1 },
    nameRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" },
    nodeName:   { fontSize: 15, fontWeight: "700", color: C.text1 },
    pill:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    pillTxt:    { fontSize: 10, fontWeight: "700" },

    metricsLine: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    metricChip:  { fontSize: 12, color: C.text2 },

    alertLine:   { flexDirection: "row", gap: 8, marginTop: 5, flexWrap: "wrap" },
    alertChip:   { fontSize: 12, fontWeight: "700" },

    lastSeenTxt: { fontSize: 12, color: C.text3 },
    chevron:     { fontSize: 22, color: C.text3, marginLeft: 4 },

    errTxt:   { color: C.text2, marginBottom: 16, textAlign: "center" },
    retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
    retryTxt: { color: "#fff", fontWeight: "600" },
  });
}
