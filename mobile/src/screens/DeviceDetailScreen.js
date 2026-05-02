import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from "react-native";
import Svg, {
  Path, Defs, LinearGradient as SvgGrad, Stop,
  Line as SvgLine, Text as SvgText, Circle,
} from "react-native-svg";
import { api } from "../services/api";

const { width: SCREEN_W } = Dimensions.get("window");

const C = {
  bg:     "#07080f",
  card:   "#0f1120",
  border: "#1e2235",
  grid:   "#181b2e",
  primary: "#4f8ef7",
  green:   "#22c55e",
  yellow:  "#f59e0b",
  red:     "#ef4444",
  cyan:    "#06b6d4",
  text1: "#f1f5f9",
  text2: "#94a3b8",
  text3: "#475569",
};

const RANGES = [
  { key: "1h",  label: "1 giờ",  hours: 1   },
  { key: "6h",  label: "6 giờ",  hours: 6   },
  { key: "24h", label: "24 giờ", hours: 24  },
  { key: "7d",  label: "7 ngày", hours: 168 },
];

const FIELDS = {
  temperature: { label: "Nhiệt độ", icon: "🌡️", unit: "°C",    color: "#f59e0b", precision: 2, threshLow: 18, threshHigh: 32 },
  humidity:    { label: "Độ ẩm",    icon: "💧", unit: "%",      color: "#4f8ef7", precision: 2, threshLow: 40, threshHigh: 80 },
  eco2:        { label: "eCO₂",     icon: "🌿", unit: " ppm",   color: "#22c55e", precision: 0, threshLow: null, threshHigh: 1000 },
  tvoc:        { label: "TVOC",     icon: "🧪", unit: " ppb",   color: "#a855f7", precision: 0, threshLow: null, threshHigh: 300 },
  battery:     { label: "Pin",      icon: "🔋", unit: " V",     color: "#06b6d4", precision: 2, threshLow: 3.3,  threshHigh: null },
};

function fmt(v, p) { return v.toFixed(p); }

function fmtTime(iso, hours) {
  const d = new Date(iso);
  if (hours <= 24) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Area line chart ──────────────────────────────────────────
const CHART_H = 190;
const PAD = { top: 14, bottom: 38, left: 46, right: 12 };

function AreaChart({ data, field, rangeHours }) {
  const cfg   = FIELDS[field];
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

  const thHY = cfg.threshHigh != null ? toY(cfg.threshHigh) : null;
  const thLY = cfg.threshLow  != null ? toY(cfg.threshLow)  : null;

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
            <Stop offset="0%"   stopColor={cfg.color} stopOpacity="0.42" />
            <Stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
          </SvgGrad>
        </Defs>

        {/* Grid ngang + nhãn Y */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          return (
            <React.Fragment key={i}>
              <SvgLine x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
                stroke={C.grid} strokeWidth="1" />
              <SvgText x={PAD.left - 5} y={y + 4}
                fontSize="9.5" fill={C.text3} textAnchor="end">
                {tick.toFixed(cfg.precision > 0 ? 1 : 0)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Ngưỡng cao – đỏ nét đứt */}
        {thHY != null && thHY > PAD.top && thHY < PAD.top + innerH && (
          <SvgLine x1={PAD.left} y1={thHY} x2={PAD.left + innerW} y2={thHY}
            stroke={C.red} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.75" />
        )}

        {/* Ngưỡng thấp – cyan nét đứt */}
        {thLY != null && thLY > PAD.top && thLY < PAD.top + innerH && (
          <SvgLine x1={PAD.left} y1={thLY} x2={PAD.left + innerW} y2={thLY}
            stroke={C.cyan} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.75" />
        )}

        {/* Area fill */}
        <Path d={area} fill={`url(#${gradId})`} />

        {/* Line */}
        <Path d={line} stroke={cfg.color} strokeWidth="1.8" fill="none" />

        {/* Tooltip indicator */}
        {tip && (
          <>
            <SvgLine x1={tip.cx} y1={PAD.top} x2={tip.cx} y2={PAD.top + innerH}
              stroke={C.text2} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <Circle cx={tip.cx} cy={tip.cy} r="5"
              fill={cfg.color} stroke={C.bg} strokeWidth="2.5" />
          </>
        )}

        {/* X-axis thời gian */}
        {xLabels.map((lbl, i) => (
          <SvgText key={i} x={lbl.x} y={CHART_H - 6} fontSize="9" fill={C.text3}
            textAnchor={i === 0 ? "start" : i === X_COUNT - 1 ? "end" : "middle"}>
            {lbl.text}
          </SvgText>
        ))}
      </Svg>

      {/* Lớp cảm ứng trong suốt */}
      <View
        style={[ch.touchLayer, { width: chartW, height: CHART_H }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => onTouchX(e.nativeEvent.locationX)}
        onResponderMove={(e)  => onTouchX(e.nativeEvent.locationX)}
        onResponderRelease={() => setTip(null)}
      />

      {/* Tooltip bubble */}
      {tip && (
        <View style={[ch.tooltip, { left: tip.tipL, top: Math.max(PAD.top + 4, tip.cy - 48) }]}>
          <Text style={ch.tipTime}>{tip.time}</Text>
          <Text style={[ch.tipVal, { color: cfg.color }]}>
            {fmt(tip.value, cfg.precision)}{cfg.unit}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={ch.legend}>
        <View style={ch.lgItem}>
          <View style={[ch.lgSolid, { backgroundColor: cfg.color }]} />
          <Text style={ch.lgTxt}>{cfg.label}</Text>
        </View>
        {cfg.threshHigh != null && (
          <View style={ch.lgItem}>
            <View style={[ch.lgDash, { borderColor: C.red }]} />
            <Text style={ch.lgTxt}>Ngưỡng cao ({cfg.threshHigh}{cfg.unit})</Text>
          </View>
        )}
        {cfg.threshLow != null && (
          <View style={ch.lgItem}>
            <View style={[ch.lgDash, { borderColor: C.cyan }]} />
            <Text style={ch.lgTxt}>Ngưỡng thấp ({cfg.threshLow}{cfg.unit})</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  wrap:       { position: "relative", marginTop: 8 },
  touchLayer: { position: "absolute", top: 0, left: 0 },
  empty:      { alignItems: "center", justifyContent: "center" },
  emptyText:  { color: C.text3, fontSize: 13 },
  tooltip: {
    position: "absolute",
    backgroundColor: "#12152cef",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    minWidth: 88,
  },
  tipTime: { fontSize: 11, color: C.text2, marginBottom: 2 },
  tipVal:  { fontSize: 18, fontWeight: "800" },
  legend:  { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4, marginTop: 6 },
  lgItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  lgSolid: { width: 14, height: 2, borderRadius: 1 },
  lgDash:  { width: 14, height: 0, borderTopWidth: 2, borderStyle: "dashed" },
  lgTxt:   { fontSize: 10, color: C.text3 },
});

// ─── Metric section ───────────────────────────────────────────
function MetricSection({ field, history, stats, rangeHours }) {
  const cfg    = FIELDS[field];
  const latest = history?.[0];
  const value  = latest?.[field] ?? 0;
  const st     = stats?.find((s) => s.field === field);

  let minPt = null, maxPt = null;
  (history || []).forEach((d) => {
    if (d[field] == null) return;
    if (!minPt || d[field] < minPt[field]) minPt = d;
    if (!maxPt || d[field] > maxPt[field]) maxPt = d;
  });

  const threshLabel = [
    cfg.threshLow  != null ? `${cfg.threshLow}${cfg.unit}`  : null,
    cfg.threshHigh != null ? `${cfg.threshHigh}${cfg.unit}` : null,
  ].filter(Boolean).join(" – ");

  return (
    <View style={ms.card}>
      <View style={ms.topRow}>
        {/* Giá trị hiện tại */}
        <View style={ms.leftCol}>
          <View style={ms.labelRow}>
            <Text style={ms.icon}>{cfg.icon}</Text>
            <Text style={ms.label}>{cfg.label}</Text>
          </View>
          <Text style={[ms.bigVal, { color: cfg.color }]}>
            {fmt(value, cfg.precision)}{cfg.unit}
          </Text>
          {latest && (
            <Text style={ms.updAt}>
              Cập nhật: {fmtTime(latest.received_at, rangeHours)}
            </Text>
          )}
        </View>

        {/* Stats nhỏ */}
        <View style={ms.statsGrid}>
          {minPt && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Thấp nhất</Text>
              <Text style={[ms.stVal, { color: C.primary }]}>
                {fmt(minPt[field], cfg.precision)}{cfg.unit}
              </Text>
              <Text style={ms.stTime}>{fmtTime(minPt.received_at, rangeHours)}</Text>
            </View>
          )}
          {maxPt && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Cao nhất</Text>
              <Text style={[ms.stVal, { color: C.red }]}>
                {fmt(maxPt[field], cfg.precision)}{cfg.unit}
              </Text>
              <Text style={ms.stTime}>{fmtTime(maxPt.received_at, rangeHours)}</Text>
            </View>
          )}
          {st && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Trung bình</Text>
              <Text style={[ms.stVal, { color: C.text1 }]}>
                {fmt(st.avg, cfg.precision)}{cfg.unit}
              </Text>
              <Text style={ms.stTime}>{rangeHours}h qua</Text>
            </View>
          )}
          {threshLabel.length > 0 && (
            <View style={ms.stItem}>
              <Text style={ms.stLbl}>Ngưỡng khuyến nghị</Text>
              <Text style={[ms.stVal, { color: C.text2, fontSize: 12 }]}>{threshLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={ms.divider} />

      <AreaChart data={history} field={field} rangeHours={rangeHours} />
    </View>
  );
}

const ms = StyleSheet.create({
  card:      { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  topRow:    { flexDirection: "row", gap: 10 },
  leftCol:   { flex: 1 },
  labelRow:  { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  icon:      { fontSize: 20 },
  label:     { fontSize: 14, fontWeight: "700", color: C.text2 },
  bigVal:    { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  updAt:     { fontSize: 11, color: C.text3, marginTop: 5 },
  divider:   { height: 1, backgroundColor: C.border, marginVertical: 14 },
  statsGrid: { flex: 1.1, flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: 4 },
  stItem:    { width: "48%" },
  stLbl:     { fontSize: 10, color: C.text3, marginBottom: 2 },
  stVal:     { fontSize: 14, fontWeight: "700" },
  stTime:    { fontSize: 10, color: C.text3, marginTop: 1 },
});

// ─── Time range selector ──────────────────────────────────────
function RangeSelector({ selected, onSelect }) {
  return (
    <View style={rs.wrap}>
      {RANGES.map((r) => {
        const active = selected === r.key;
        return (
          <TouchableOpacity key={r.key} activeOpacity={0.75}
            style={[rs.btn, active && rs.activeBtn]}
            onPress={() => onSelect(r)}>
            <Text style={[rs.lbl, active && rs.activeLbl]}>{r.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const rs = StyleSheet.create({
  wrap:      { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  btn:       { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  activeBtn: { backgroundColor: "#4f8ef722" },
  lbl:       { fontSize: 12, fontWeight: "600", color: C.text3 },
  activeLbl: { color: C.primary, fontWeight: "700" },
});

// ─── Radio card ───────────────────────────────────────────────
function RadioCard({ data }) {
  const d = data?.[0];
  if (!d) return null;
  const rssiC = d.rssi > -80 ? C.green : d.rssi > -100 ? C.yellow : C.red;
  const snrC  = d.snr  >  5  ? C.green : d.snr   >  0  ? C.yellow : C.red;
  const items = [
    { label: "RSSI",    val: `${d.rssi}`,              unit: "dBm", color: rssiC  },
    { label: "SNR",     val: d.snr?.toFixed(1),         unit: "dB",  color: snrC   },
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

const rd = StyleSheet.create({
  card:  { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 1.2, marginBottom: 14 },
  row:   { flexDirection: "row", alignItems: "center" },
  sep:   { width: 1, height: 44, backgroundColor: C.border },
  item:  { flex: 1, alignItems: "center" },
  val:   { fontSize: 20, fontWeight: "800" },
  unit:  { fontSize: 11, color: C.text3, marginTop: 1 },
  lbl:   { fontSize: 11, color: C.text2, fontWeight: "600", marginTop: 3 },
});

// ─── Main screen ──────────────────────────────────────────────
export default function DeviceDetailScreen({ route }) {
  const { device } = route.params;

  const [range,   setRange]   = useState(RANGES[2]);
  const [history, setHistory] = useState([]);
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

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
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.name}>{device.device_name}</Text>
        <Text style={s.eui}>{device.dev_eui}</Text>
      </View>

      <RangeSelector selected={range.key} onSelect={(r) => setRange(r)} />

      {Object.keys(FIELDS).map((field) => (
        <MetricSection
          key={field}
          field={field}
          history={history}
          stats={stats}
          rangeHours={range.hours}
        />
      ))}

      <RadioCard data={history} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
