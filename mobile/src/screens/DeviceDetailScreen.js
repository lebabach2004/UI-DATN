import React, { useEffect, useState, useCallback, useMemo, useLayoutEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
  Modal, TextInput, Alert,
} from "react-native";
import Svg, {
  Path, Defs, LinearGradient as SvgGrad, Stop,
  Line as SvgLine, Text as SvgText, Circle,
} from "react-native-svg";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useThreshold, DEFAULT_THRESHOLDS } from "../context/ThresholdContext";

const { width: SCREEN_W } = Dimensions.get("window");

const RANGES = [
  { key: "1h",  label: "1 giờ",  hours: 1   },
  { key: "6h",  label: "6 giờ",  hours: 6   },
  { key: "24h", label: "24 giờ", hours: 24  },
  { key: "7d",  label: "7 ngày", hours: 168 },
];

const FIELD_META = {
  temperature: { label: "Nhiệt độ", icon: "🌡️", unit: "°C",  color: "#f59e0b", precision: 2 },
  humidity:    { label: "Độ ẩm",    icon: "💧", unit: "%",    color: "#4f8ef7", precision: 2 },
  eco2:        { label: "eCO₂",     icon: "🌿", unit: " ppm", color: "#22c55e", precision: 0 },
  tvoc:        { label: "TVOC",     icon: "🧪", unit: " ppb", color: "#a855f7", precision: 0 },
  battery:     { label: "Pin",      icon: "🔋", unit: " V",   color: "#06b6d4", precision: 2 },
};

// Trường nào có ngưỡng cao / thấp
const HAS_HIGH = ["temperature", "humidity", "eco2", "tvoc"];
const HAS_LOW  = ["battery"];

function fmt(v, p) { return v.toFixed(p); }

function getStatus(value, cfg) {
  if (cfg.dangerHigh != null && value >= cfg.dangerHigh) return "danger";
  if (cfg.dangerLow  != null && value <= cfg.dangerLow)  return "danger";
  if (cfg.warnHigh   != null && value >= cfg.warnHigh)   return "warn";
  if (cfg.warnLow    != null && value <= cfg.warnLow)    return "warn";
  return "ok";
}
const STATUS_COLOR = { ok: null,        warn: "#f59e0b", danger: "#ef4444" };
const STATUS_LABEL = { ok: null, warn: "CẢNH BÁO", danger: "NGUY HIỂM" };

function fmtTime(iso, hours) {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Threshold helpers ────────────────────────────────────────
function initEditVals(thresholds) {
  const result = {};
  for (const [field, vals] of Object.entries(thresholds)) {
    result[field] = {};
    for (const [key, val] of Object.entries(vals)) {
      result[field][key] = val != null ? String(val) : "";
    }
  }
  return result;
}

function parseEditVals(editVals) {
  const result = {};
  for (const [field, vals] of Object.entries(editVals)) {
    result[field] = {};
    for (const [key, val] of Object.entries(vals)) {
      const n = parseFloat(val);
      result[field][key] = val.trim() === "" || isNaN(n) ? null : n;
    }
  }
  return result;
}

// ─── Threshold edit modal ─────────────────────────────────────
function ThresholdModal({ visible, devEui, deviceName, onClose }) {
  const { C } = useTheme();
  const tm = useMemo(() => makeThresholdStyles(C), [C]);
  const { getThresholds, setThresholds, resetThresholds } = useThreshold();

  const [editVals, setEditVals] = useState({});

  useEffect(() => {
    if (visible) setEditVals(initEditVals(getThresholds(devEui)));
  }, [visible, devEui]);

  function setVal(field, key, text) {
    setEditVals((prev) => ({
      ...prev,
      [field]: { ...prev[field], [key]: text },
    }));
  }

  function handleSave() {
    setThresholds(devEui, parseEditVals(editVals));
    onClose();
  }

  function handleReset() {
    Alert.alert("Đặt lại ngưỡng", "Đặt lại về giá trị mặc định?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đặt lại", style: "destructive", onPress: () => { resetThresholds(devEui); onClose(); } },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tm.overlay}>
        <View style={tm.sheet}>
          <View style={tm.sheetHeader}>
            <Text style={tm.sheetTitle}>Ngưỡng cảnh báo</Text>
            <Text style={tm.sheetSub}>{deviceName}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(FIELD_META).map(([field, meta]) => (
              <View key={field} style={tm.fieldBlock}>
                <Text style={tm.fieldLabel}>{meta.icon} {meta.label} ({meta.unit.trim()})</Text>

                {HAS_HIGH.includes(field) && (
                  <View style={tm.inputRow}>
                    <View style={tm.inputGroup}>
                      <Text style={tm.inputLabel}>Cảnh báo cao</Text>
                      <TextInput
                        style={tm.input}
                        value={editVals[field]?.warnHigh ?? ""}
                        onChangeText={(v) => setVal(field, "warnHigh", v)}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={C.text3}
                      />
                    </View>
                    <View style={tm.inputGroup}>
                      <Text style={tm.inputLabel}>Nguy hiểm cao</Text>
                      <TextInput
                        style={[tm.input, { borderColor: C.red + "80" }]}
                        value={editVals[field]?.dangerHigh ?? ""}
                        onChangeText={(v) => setVal(field, "dangerHigh", v)}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={C.text3}
                      />
                    </View>
                  </View>
                )}

                {HAS_LOW.includes(field) && (
                  <View style={tm.inputRow}>
                    <View style={tm.inputGroup}>
                      <Text style={tm.inputLabel}>Cảnh báo thấp</Text>
                      <TextInput
                        style={tm.input}
                        value={editVals[field]?.warnLow ?? ""}
                        onChangeText={(v) => setVal(field, "warnLow", v)}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={C.text3}
                      />
                    </View>
                    <View style={tm.inputGroup}>
                      <Text style={tm.inputLabel}>Nguy hiểm thấp</Text>
                      <TextInput
                        style={[tm.input, { borderColor: C.red + "80" }]}
                        value={editVals[field]?.dangerLow ?? ""}
                        onChangeText={(v) => setVal(field, "dangerLow", v)}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={C.text3}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={tm.btnRow}>
            <TouchableOpacity style={tm.resetBtn} onPress={handleReset}>
              <Text style={tm.resetTxt}>Mặc định</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tm.cancelBtn} onPress={onClose}>
              <Text style={tm.cancelTxt}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tm.saveBtn} onPress={handleSave}>
              <Text style={tm.saveTxt}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeThresholdStyles(C) {
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end" },
    sheet:       { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%", borderTopWidth: 1, borderColor: C.border },
    sheetHeader: { marginBottom: 16 },
    sheetTitle:  { fontSize: 18, fontWeight: "800", color: C.text1 },
    sheetSub:    { fontSize: 12, color: C.text3, marginTop: 3 },
    fieldBlock:  { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
    fieldLabel:  { fontSize: 13, fontWeight: "700", color: C.text2, marginBottom: 10 },
    inputRow:    { flexDirection: "row", gap: 10 },
    inputGroup:  { flex: 1 },
    inputLabel:  { fontSize: 10, color: C.text3, marginBottom: 5, fontWeight: "600" },
    input:       { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text1, fontSize: 15, fontWeight: "700" },
    btnRow:      { flexDirection: "row", gap: 8, marginTop: 16 },
    resetBtn:    { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center" },
    resetTxt:    { color: C.text3, fontWeight: "600", fontSize: 13 },
    cancelBtn:   { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    cancelTxt:   { color: C.text2, fontWeight: "600" },
    saveBtn:     { flex: 1.5, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    saveTxt:     { color: "#fff", fontWeight: "700" },
  });
}

// ─── Area line chart ──────────────────────────────────────────
const CHART_H = 190;
const PAD = { top: 14, bottom: 38, left: 46, right: 12 };

function AreaChart({ data, field, rangeHours, thresholdCfg }) {
  const { C } = useTheme();
  const ch = useMemo(() => makeChartStyles(C), [C]);
  const meta  = FIELD_META[field];
  const [tip, setTip] = useState(null);
  const chartW = SCREEN_W - 32;
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const gradId = `g_${field}`;

  const sorted = [...(data || [])]
    .filter((d) => d[field] != null)
    .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));

  if (sorted.length < 2) {
    return (
      <View style={[ch.empty, { height: CHART_H }]}>
        <Text style={ch.emptyText}>Không có dữ liệu</Text>
      </View>
    );
  }

  const vals   = sorted.map((d) => d[field]);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const padY   = (rawMax - rawMin) * 0.18 || 1;
  const yMin   = rawMin - padY;
  const yMax   = rawMax + padY;
  const yRange = yMax - yMin;

  const toX = (i) => PAD.left + (i / (sorted.length - 1)) * innerW;
  const toY = (v) => PAD.top  + innerH - ((v - yMin) / yRange) * innerH;

  const pts  = sorted.map((d, i) => `${toX(i).toFixed(1)},${toY(d[field]).toFixed(1)}`);
  const line = "M " + pts.join(" L ");
  const area = `${line} L ${toX(sorted.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L ${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const yTicks  = [0, 0.25, 0.5, 0.75, 1].map((r) => yMin + r * yRange);
  const X_COUNT = 5;
  const xLabels = Array.from({ length: X_COUNT }, (_, i) => {
    const idx = Math.round((i / (X_COUNT - 1)) * (sorted.length - 1));
    return { x: toX(idx), text: fmtTime(sorted[idx].received_at, rangeHours) };
  });

  const cfg      = thresholdCfg;
  const warnHY   = cfg.warnHigh   != null ? toY(cfg.warnHigh)   : null;
  const dangerHY = cfg.dangerHigh != null ? toY(cfg.dangerHigh) : null;
  const warnLY   = cfg.warnLow    != null ? toY(cfg.warnLow)    : null;
  const dangerLY = cfg.dangerLow  != null ? toY(cfg.dangerLow)  : null;
  const inChart  = (y) => y != null && y > PAD.top && y < PAD.top + innerH;

  function onTouchX(touchX) {
    const ratio = (touchX - PAD.left) / innerW;
    const idx   = Math.max(0, Math.min(sorted.length - 1, Math.round(ratio * (sorted.length - 1))));
    const pt    = sorted[idx];
    const cx    = toX(idx);
    const cy    = toY(pt[field]);
    const tipL  = cx + 8 + 92 > chartW ? cx - 100 : cx + 8;
    setTip({ cx, cy, value: pt[field], time: fmtTime(pt.received_at, rangeHours), tipL });
  }

  return (
    <View style={ch.wrap}>
      <Svg width={chartW} height={CHART_H}>
        <Defs>
          <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={meta.color} stopOpacity="0.42" />
            <Stop offset="100%" stopColor={meta.color} stopOpacity="0.02" />
          </SvgGrad>
        </Defs>

        {yTicks.map((tick, i) => {
          const y = toY(tick);
          return (
            <React.Fragment key={i}>
              <SvgLine x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke={C.grid} strokeWidth="1" />
              <SvgText x={PAD.left - 5} y={y + 4} fontSize="9.5" fill={C.text3} textAnchor="end">
                {tick.toFixed(meta.precision > 0 ? 1 : 0)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {inChart(warnHY)   && <SvgLine x1={PAD.left} y1={warnHY}   x2={PAD.left + innerW} y2={warnHY}   stroke={C.yellow} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.8" />}
        {inChart(dangerHY) && <SvgLine x1={PAD.left} y1={dangerHY} x2={PAD.left + innerW} y2={dangerHY} stroke={C.red}    strokeWidth="1.4" strokeDasharray="5,4" opacity="0.85" />}
        {inChart(warnLY)   && <SvgLine x1={PAD.left} y1={warnLY}   x2={PAD.left + innerW} y2={warnLY}   stroke={C.yellow} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.8" />}
        {inChart(dangerLY) && <SvgLine x1={PAD.left} y1={dangerLY} x2={PAD.left + innerW} y2={dangerLY} stroke={C.red}    strokeWidth="1.4" strokeDasharray="5,4" opacity="0.85" />}

        <Path d={area} fill={`url(#${gradId})`} />
        <Path d={line} stroke={meta.color} strokeWidth="1.8" fill="none" />

        {tip && (
          <>
            <SvgLine x1={tip.cx} y1={PAD.top} x2={tip.cx} y2={PAD.top + innerH} stroke={C.text2} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <Circle cx={tip.cx} cy={tip.cy} r="5" fill={meta.color} stroke={C.bg} strokeWidth="2.5" />
          </>
        )}

        {xLabels.map((lbl, i) => (
          <SvgText key={i} x={lbl.x} y={CHART_H - 6} fontSize="9" fill={C.text3}
            textAnchor={i === 0 ? "start" : i === X_COUNT - 1 ? "end" : "middle"}>
            {lbl.text}
          </SvgText>
        ))}
      </Svg>

      <View style={[ch.touchLayer, { width: chartW, height: CHART_H }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => onTouchX(e.nativeEvent.locationX)}
        onResponderMove={(e)  => onTouchX(e.nativeEvent.locationX)}
        onResponderRelease={() => setTip(null)}
      />

      {tip && (
        <View style={[ch.tooltip, { left: tip.tipL, top: Math.max(PAD.top + 4, tip.cy - 48) }]}>
          <Text style={ch.tipTime}>{tip.time}</Text>
          <Text style={[ch.tipVal, { color: meta.color }]}>
            {fmt(tip.value, meta.precision)}{meta.unit}
          </Text>
        </View>
      )}

      <View style={ch.legend}>
        <View style={ch.lgItem}>
          <View style={[ch.lgSolid, { backgroundColor: meta.color }]} />
          <Text style={ch.lgTxt}>{meta.label}</Text>
        </View>
        {cfg.warnHigh   != null && <View style={ch.lgItem}><View style={[ch.lgDash, { borderColor: C.yellow }]} /><Text style={ch.lgTxt}>Cảnh báo ({cfg.warnHigh}{meta.unit})</Text></View>}
        {cfg.dangerHigh != null && <View style={ch.lgItem}><View style={[ch.lgDash, { borderColor: C.red    }]} /><Text style={ch.lgTxt}>Nguy hiểm ({cfg.dangerHigh}{meta.unit})</Text></View>}
        {cfg.warnLow    != null && <View style={ch.lgItem}><View style={[ch.lgDash, { borderColor: C.yellow }]} /><Text style={ch.lgTxt}>Cảnh báo (&lt;{cfg.warnLow}{meta.unit})</Text></View>}
        {cfg.dangerLow  != null && <View style={ch.lgItem}><View style={[ch.lgDash, { borderColor: C.red    }]} /><Text style={ch.lgTxt}>Nguy hiểm (&lt;{cfg.dangerLow}{meta.unit})</Text></View>}
      </View>
    </View>
  );
}

function makeChartStyles(C) {
  return StyleSheet.create({
    wrap:       { position: "relative", marginTop: 8 },
    touchLayer: { position: "absolute", top: 0, left: 0 },
    empty:      { alignItems: "center", justifyContent: "center" },
    emptyText:  { color: C.text3, fontSize: 13 },
    tooltip:    { position: "absolute", backgroundColor: C.isDark ? "#12152cef" : "#ffffffef", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border, minWidth: 88 },
    tipTime:    { fontSize: 11, color: C.text2, marginBottom: 2 },
    tipVal:     { fontSize: 18, fontWeight: "800" },
    legend:     { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4, marginTop: 6 },
    lgItem:     { flexDirection: "row", alignItems: "center", gap: 5 },
    lgSolid:    { width: 14, height: 2, borderRadius: 1 },
    lgDash:     { width: 14, height: 0, borderTopWidth: 2, borderStyle: "dashed" },
    lgTxt:      { fontSize: 10, color: C.text3 },
  });
}

// ─── Metric section ───────────────────────────────────────────
function MetricSection({ field, history, stats, rangeHours, thresholds }) {
  const { C } = useTheme();
  const ms = useMemo(() => makeMetricStyles(C), [C]);

  const meta    = FIELD_META[field];
  const cfg     = { ...meta, ...thresholds[field] };
  const latest  = history?.[0];
  const value   = latest?.[field] ?? 0;
  const hasData = latest != null && latest[field] != null;
  const st      = stats?.find((s) => s.field === field);

  const status      = hasData ? getStatus(value, cfg) : "ok";
  const statusColor = STATUS_COLOR[status];
  const statusLabel = STATUS_LABEL[status];

  let minPt = null, maxPt = null;
  (history || []).forEach((d) => {
    if (d[field] == null) return;
    if (!minPt || d[field] < minPt[field]) minPt = d;
    if (!maxPt || d[field] > maxPt[field]) maxPt = d;
  });

  const threshLabel = [
    cfg.warnHigh   != null ? `Cảnh báo: ${cfg.warnHigh}${meta.unit}`   : null,
    cfg.dangerHigh != null ? `Nguy hiểm: ${cfg.dangerHigh}${meta.unit}` : null,
    cfg.warnLow    != null ? `Cảnh báo: <${cfg.warnLow}${meta.unit}`   : null,
    cfg.dangerLow  != null ? `Nguy hiểm: <${cfg.dangerLow}${meta.unit}` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <View style={[ms.card, statusColor && { borderColor: statusColor + "55" }]}>
      <View style={ms.topRow}>
        <View style={ms.leftCol}>
          <View style={ms.labelRow}>
            <Text style={ms.icon}>{meta.icon}</Text>
            <Text style={ms.label}>{meta.label}</Text>
            {statusLabel && (
              <View style={[ms.badge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                <Text style={[ms.badgeTxt, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            )}
          </View>
          <Text style={[ms.bigVal, { color: statusColor ?? meta.color }]}>
            {fmt(value, meta.precision)}{meta.unit}
          </Text>
          {latest && (
            <Text style={ms.updAt}>Cập nhật: {fmtTime(latest.received_at, rangeHours)}</Text>
          )}
        </View>

        <View style={ms.statsGrid}>
          {minPt && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Thấp nhất</Text>
              <Text style={[ms.stVal, { color: C.primary }]}>{fmt(minPt[field], meta.precision)}{meta.unit}</Text>
              <Text style={ms.stTime}>{fmtTime(minPt.received_at, rangeHours)}</Text>
            </View>
          )}
          {maxPt && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Cao nhất</Text>
              <Text style={[ms.stVal, { color: C.red }]}>{fmt(maxPt[field], meta.precision)}{meta.unit}</Text>
              <Text style={ms.stTime}>{fmtTime(maxPt.received_at, rangeHours)}</Text>
            </View>
          )}
          {st && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Trung bình</Text>
              <Text style={[ms.stVal, { color: C.text1 }]}>{fmt(st.avg, meta.precision)}{meta.unit}</Text>
              <Text style={ms.stTime}>{rangeHours}h qua</Text>
            </View>
          )}
          {threshLabel.length > 0 && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Ngưỡng</Text>
              <Text style={[ms.stVal, { color: C.text2, fontSize: 12 }]}>{threshLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={ms.divider} />
      <AreaChart data={history} field={field} rangeHours={rangeHours} thresholdCfg={cfg} />
    </View>
  );
}

function makeMetricStyles(C) {
  return StyleSheet.create({
    card:      { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
    topRow:    { flexDirection: "row", gap: 10 },
    leftCol:   { flex: 1 },
    labelRow:  { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
    icon:      { fontSize: 20 },
    label:     { fontSize: 14, fontWeight: "700", color: C.text2 },
    bigVal:    { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
    updAt:     { fontSize: 11, color: C.text3, marginTop: 5 },
    badge:     { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
    badgeTxt:  { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
    divider:   { height: 1, backgroundColor: C.border, marginVertical: 14 },
    statsGrid: { flex: 1.1, flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: 4 },
    stItem:    { width: "48%" },
    stLbl:     { fontSize: 10, color: C.text3, marginBottom: 2 },
    stVal:     { fontSize: 14, fontWeight: "700" },
    stTime:    { fontSize: 10, color: C.text3, marginTop: 1 },
  });
}

// ─── Range selector ───────────────────────────────────────────
function RangeSelector({ selected, onSelect }) {
  const { C } = useTheme();
  const rs = useMemo(() => makeRangeStyles(C), [C]);
  return (
    <View style={rs.wrap}>
      {RANGES.map((r) => {
        const active = selected === r.key;
        return (
          <TouchableOpacity key={r.key} activeOpacity={0.75}
            style={[rs.btn, active && rs.activeBtn]} onPress={() => onSelect(r)}>
            <Text style={[rs.lbl, active && rs.activeLbl]}>{r.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
function makeRangeStyles(C) {
  return StyleSheet.create({
    wrap:      { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
    btn:       { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
    activeBtn: { backgroundColor: C.primary + "22" },
    lbl:       { fontSize: 12, fontWeight: "600", color: C.text3 },
    activeLbl: { color: C.primary, fontWeight: "700" },
  });
}

// ─── Radio card ───────────────────────────────────────────────
function RadioCard({ data }) {
  const { C } = useTheme();
  const rd = useMemo(() => makeRadioStyles(C), [C]);
  const d = data?.[0];
  if (!d) return null;
  const rssiC = d.rssi > -80 ? C.green : d.rssi > -100 ? C.yellow : C.red;
  const snrC  = d.snr  >  5  ? C.green : d.snr   >  0  ? C.yellow : C.red;
  const items = [
    { label: "RSSI",    val: `${d.rssi}`,                  unit: "dBm", color: rssiC  },
    { label: "SNR",     val: d.snr?.toFixed(1),             unit: "dB",  color: snrC   },
    { label: "Gateway", val: `…${d.gateway_id?.slice(-8)}`, unit: "",    color: C.text1 },
  ];
  return (
    <View style={rd.card}>
      <Text style={rd.title}>KẾT NỐI RADIO</Text>
      <View style={rd.row}>
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            <View style={rd.item}>
              <Text style={[rd.val, { color: item.color }]} numberOfLines={1}>{item.val}</Text>
              <Text style={rd.unit}>{item.unit}</Text>
              <Text style={rd.lbl}>{item.label}</Text>
            </View>
            {i < items.length - 1 && <View style={rd.sep} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
function makeRadioStyles(C) {
  return StyleSheet.create({
    card:  { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
    title: { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 1.2, marginBottom: 14 },
    row:   { flexDirection: "row", alignItems: "center" },
    sep:   { width: 1, height: 44, backgroundColor: C.border },
    item:  { flex: 1, alignItems: "center" },
    val:   { fontSize: 20, fontWeight: "800" },
    unit:  { fontSize: 11, color: C.text3, marginTop: 1 },
    lbl:   { fontSize: 11, color: C.text2, fontWeight: "600", marginTop: 3 },
  });
}

// ─── Main screen ──────────────────────────────────────────────
export default function DeviceDetailScreen({ route, navigation }) {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { getThresholds } = useThreshold();

  const { device, isAdmin = false } = route.params;
  const thresholds = getThresholds(device.dev_eui);

  const [range,              setRange]              = useState(RANGES[2]);
  const [history,            setHistory]            = useState([]);
  const [stats,              setStats]              = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [showThresholdModal, setShowThresholdModal] = useState(false);

  // Nút ⚙️ chỉ hiện cho admin
  useLayoutEffect(() => {
    if (!isAdmin) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowThresholdModal(true)}
          style={{ backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
        >
          <Text style={{ color: C.text2, fontSize: 13, fontWeight: "600" }}>⚙️ Ngưỡng</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, C, isAdmin]);

  const load = useCallback(async () => {
    try {
      const limit = Math.min(range.hours * 12, 500);
      const [hist, st] = await Promise.all([
        api.getHistory(device.dev_eui, limit, range.hours),
        api.getStats(device.dev_eui, range.hours),
      ]);
      setHistory(hist);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [device.dev_eui, range]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingTxt}>Đang tải dữ liệu…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errIcon}>⚠️</Text>
        <Text style={s.errMsg}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryTxt}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ThresholdModal
        visible={showThresholdModal}
        devEui={device.dev_eui}
        deviceName={device.device_name}
        onClose={() => setShowThresholdModal(false)}
      />

      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.name}>{device.device_name}</Text>
          <Text style={s.eui}>{device.dev_eui}</Text>
        </View>

        <RangeSelector selected={range.key} onSelect={(r) => setRange(r)} />

        {Object.keys(FIELD_META).map((field) => (
          <MetricSection
            key={field}
            field={field}
            history={history}
            stats={stats}
            rangeHours={range.hours}
            thresholds={thresholds}
          />
        ))}

        <RadioCard data={history} />
      </ScrollView>
    </>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    content:    { paddingBottom: 52 },
    center:     { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
    header:     { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
    name:       { fontSize: 24, fontWeight: "800", color: C.text1, letterSpacing: -0.5 },
    eui:        { fontSize: 11, color: C.text3, fontFamily: "monospace", marginTop: 4 },
    loadingTxt: { color: C.text3, marginTop: 12, fontSize: 14 },
    errIcon:    { fontSize: 40, marginBottom: 16 },
    errMsg:     { color: C.text2, textAlign: "center", marginBottom: 20, paddingHorizontal: 32, lineHeight: 22 },
    retryBtn:   { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
    retryTxt:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
}
