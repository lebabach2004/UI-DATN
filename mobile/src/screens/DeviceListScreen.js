import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";

function isOnline(lastSeen, minutes = 10) {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < minutes * 60 * 1000;
}

function batteryColor(v, C) {
  if (v >= 3.6) return C.green;
  if (v >= 3.2) return C.yellow;
  return C.red;
}

function timeSince(isoStr) {
  if (!isoStr) return "—";
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 120)   return "vừa xong";
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function DeviceCard({ device, onPress }) {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const online = isOnline(device.last_seen);

  return (
    <TouchableOpacity
      style={[s.card, !online && { borderColor: C.red + "55" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Header */}
      <View style={s.cardHeader}>
        <View style={[s.dot, { backgroundColor: online ? C.green : C.red }]} />
        <Text style={s.deviceName}>{device.device_name}</Text>
        {!online
          ? <View style={s.offlineBadge}>
              <Text style={s.offlineTxt}>Mất kết nối</Text>
            </View>
          : <Text style={s.lastSeen}>{timeSince(device.last_seen)}</Text>
        }
      </View>

      {online ? (
        <>
          {/* 4 thông số chính */}
          <View style={s.metricsRow}>
            <MetricBadge label="Nhiệt độ" value={`${device.temperature.toFixed(1)}°C`} color={C.yellow} s={s} />
            <MetricBadge label="Độ ẩm"    value={`${device.humidity.toFixed(1)}%`}     color={C.primary} s={s} />
            <MetricBadge label="eCO2"     value={`${device.eco2.toFixed(0)}`}           color={C.green}   unit="ppm" s={s} />
            <MetricBadge label="TVOC"     value={`${device.tvoc.toFixed(0)}`}           color="#a855f7"   unit="ppb" s={s} />
          </View>

          {/* Pin */}
          <View style={s.batteryRow}>
            <Text style={[s.batteryText, { color: batteryColor(device.battery, C) }]}>
              🔋 {device.battery.toFixed(2)}V
            </Text>
            <Text style={s.devEui}>{device.dev_eui.slice(-8)}</Text>
          </View>
        </>
      ) : (
        <View style={s.offlineBody}>
          <Text style={s.offlineMsg}>
            Lần cuối nhận dữ liệu: {timeSince(device.last_seen)}
          </Text>
          <Text style={s.devEui}>{device.dev_eui.slice(-8)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MetricBadge({ label, value, color, unit, s }) {
  return (
    <View style={s.badge}>
      <Text style={[s.badgeValue, { color }]}>{value}</Text>
      {unit && <Text style={[s.badgeUnit, { color }]}> {unit}</Text>}
      <Text style={s.badgeLabel}>{label}</Text>
    </View>
  );
}

export default function DeviceListScreen({ navigation }) {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);

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

  const onlineCount  = devices.filter((d) => isOnline(d.last_seen)).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <View style={s.container}>
      <Text style={s.screenTitle}>Thiết bị LoRaWAN</Text>
      <View style={s.subtitleRow}>
        <Text style={s.screenSub}>
          <Text style={{ color: C.green }}>● {onlineCount} online</Text>
          {offlineCount > 0 && (
            <Text style={{ color: C.red }}>  ● {offlineCount} offline</Text>
          )}
        </Text>
      </View>

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
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <Text style={s.empty}>Chưa có dữ liệu nào. Hãy chạy collector.</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 56 },
    center:      { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
    screenTitle: { fontSize: 26, fontWeight: "700", color: C.text1, marginBottom: 2 },
    subtitleRow: { marginBottom: 18 },
    screenSub:   { fontSize: 13 },

    card:        { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    cardHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    dot:         { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    deviceName:  { flex: 1, fontSize: 16, fontWeight: "600", color: C.text1 },
    lastSeen:    { fontSize: 12, color: C.text2 },
    offlineBadge: { backgroundColor: C.red + "18", borderWidth: 1, borderColor: C.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    offlineTxt:  { fontSize: 11, color: C.red, fontWeight: "700" },

    metricsRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    badge:       { alignItems: "center", flex: 1 },
    badgeValue:  { fontSize: 18, fontWeight: "700" },
    badgeUnit:   { fontSize: 11, fontWeight: "600", marginTop: -2 },
    badgeLabel:  { fontSize: 11, color: C.text2, marginTop: 2 },

    batteryRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
    batteryText: { fontSize: 13, fontWeight: "600" },
    devEui:      { fontSize: 11, color: C.text3, fontFamily: "monospace" },

    offlineBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    offlineMsg:  { fontSize: 13, color: C.text3 },

    loadingText: { color: C.text2, marginTop: 12 },
    errorIcon:   { fontSize: 40, marginBottom: 12 },
    errorTitle:  { fontSize: 18, fontWeight: "700", color: C.text1, marginBottom: 8 },
    errorMsg:    { fontSize: 13, color: C.text2, textAlign: "center", marginBottom: 20 },
    retryBtn:    { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
    retryText:   { color: "#fff", fontWeight: "600" },
    empty:       { color: C.text2, textAlign: "center", marginTop: 60, fontSize: 14 },
  });
}
