import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";

const ROLE_LABEL = { building_admin: "Admin", user: "User" };

export default function AdminScreen() {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const ROLE_COLOR = { building_admin: C.yellow, user: C.green };

  const [users,    setUsers]    = useState([]);
  const [devices,  setDevices]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ username: "", password: "", role: "user", dev_eui: "" });
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [u, d] = await Promise.all([api.getUsers(), api.getDevices()]);
      setUsers(u);
      setDevices(d);
    } catch (e) {
      Alert.alert("Lỗi", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    if (!form.username.trim() || !form.password.trim()) {
      setFormErr("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    if (form.role === "user" && !form.dev_eui) {
      setFormErr("Vui lòng chọn node cho user");
      return;
    }
    try {
      setSaving(true);
      setFormErr(null);
      await api.createUser({
        username: form.username.trim(),
        password: form.password,
        role:     form.role,
        dev_eui:  form.role === "user" ? form.dev_eui : null,
      });
      setForm({ username: "", password: "", role: "user", dev_eui: "" });
      setShowForm(false);
      loadData();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(user) {
    Alert.alert(
      "Xóa tài khoản",
      `Bạn chắc chắn muốn xóa "${user.username}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteUser(user.id);
              loadData();
            } catch (e) {
              Alert.alert("Lỗi", e.message);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Quản lý tài khoản</Text>
        <TouchableOpacity
          style={[s.addBtn, showForm && { backgroundColor: C.border }]}
          onPress={() => { setShowForm(!showForm); setFormErr(null); }}
        >
          <Text style={s.addBtnTxt}>{showForm ? "✕ Đóng" : "+ Thêm"}</Text>
        </TouchableOpacity>
      </View>

      {/* Form tạo user */}
      {showForm && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>TẠO TÀI KHOẢN MỚI</Text>

          <Text style={s.label}>Tên đăng nhập</Text>
          <TextInput
            style={s.input}
            value={form.username}
            onChangeText={(v) => setForm({ ...form, username: v })}
            placeholder="username"
            placeholderTextColor={C.text3}
            autoCapitalize="none"
          />

          <Text style={[s.label, { marginTop: 12 }]}>Mật khẩu</Text>
          <TextInput
            style={s.input}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            placeholder="••••••••"
            placeholderTextColor={C.text3}
            secureTextEntry
          />

          <Text style={[s.label, { marginTop: 12 }]}>Vai trò</Text>
          <View style={s.roleRow}>
            {["user", "building_admin"].map((role) => (
              <TouchableOpacity
                key={role}
                style={[s.roleBtn, form.role === role && { borderColor: C.primary, backgroundColor: C.primary + "22" }]}
                onPress={() => setForm({ ...form, role, dev_eui: "" })}
              >
                <Text style={[s.roleTxt, form.role === role && { color: C.primary }]}>
                  {ROLE_LABEL[role]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {form.role === "user" && (
            <>
              <Text style={[s.label, { marginTop: 12 }]}>Gán node (phòng)</Text>
              <View style={s.nodeList}>
                {devices.length === 0
                  ? <Text style={s.noDevice}>Không có node nào</Text>
                  : devices.map((d) => (
                    <TouchableOpacity
                      key={d.dev_eui}
                      style={[s.nodeItem, form.dev_eui === d.dev_eui && { borderColor: C.primary, backgroundColor: C.primary + "22" }]}
                      onPress={() => setForm({ ...form, dev_eui: d.dev_eui })}
                    >
                      <Text style={[s.nodeName, form.dev_eui === d.dev_eui && { color: C.primary }]}>
                        {d.device_name}
                      </Text>
                      <Text style={s.nodeEui}>{d.dev_eui.slice(-8)}</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
            </>
          )}

          {formErr && <Text style={s.error}>{formErr}</Text>}

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnTxt}>Tạo tài khoản</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Danh sách user */}
      <Text style={s.listTitle}>DANH SÁCH ({users.length})</Text>
      {users.map((u) => {
        const linkedDevice = devices.find((d) => d.dev_eui === u.dev_eui);
        return (
          <View key={u.id} style={s.userRow}>
            <View style={s.userLeft}>
              <View style={s.userTop}>
                <Text style={s.userName}>{u.username}</Text>
                <View style={[s.rolePill, { borderColor: ROLE_COLOR[u.role] }]}>
                  <Text style={[s.rolePillTxt, { color: ROLE_COLOR[u.role] }]}>
                    {ROLE_LABEL[u.role]}
                  </Text>
                </View>
              </View>
              {u.dev_eui && (
                <Text style={s.userNode}>
                  📍 {linkedDevice ? linkedDevice.device_name : u.dev_eui.slice(-8)}
                </Text>
              )}
            </View>
            {u.username !== "admin" && (
              <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(u)}>
                <Text style={s.delTxt}>Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
    header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
    title:        { fontSize: 22, fontWeight: "800", color: C.text1 },
    addBtn:       { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    addBtnTxt:    { color: "#fff", fontWeight: "700", fontSize: 13 },

    card:         { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 1.2, marginBottom: 16 },
    label:        { fontSize: 12, fontWeight: "600", color: C.text2, marginBottom: 8 },
    input:        { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: C.text1, fontSize: 14 },

    roleRow:      { flexDirection: "row", gap: 10 },
    roleBtn:      { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    roleTxt:      { color: C.text2, fontWeight: "600", fontSize: 13 },

    nodeList:     { gap: 8 },
    nodeItem:     { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    nodeName:     { color: C.text1, fontWeight: "600", fontSize: 14 },
    nodeEui:      { color: C.text3, fontSize: 11, fontFamily: "monospace" },
    noDevice:     { color: C.text3, fontSize: 13, textAlign: "center", paddingVertical: 10 },

    error:        { color: C.red, fontSize: 12, marginTop: 10, textAlign: "center" },
    saveBtn:      { marginTop: 16, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    saveBtnTxt:   { color: "#fff", fontWeight: "700", fontSize: 15 },

    listTitle:    { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 1.2, paddingHorizontal: 16, marginBottom: 8 },
    userRow:      { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center" },
    userLeft:     { flex: 1 },
    userTop:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    userName:     { fontSize: 15, fontWeight: "700", color: C.text1 },
    rolePill:     { borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2 },
    rolePillTxt:  { fontSize: 10, fontWeight: "800" },
    userNode:     { fontSize: 12, color: C.text3 },
    delBtn:       { backgroundColor: C.red + "22", borderWidth: 1, borderColor: C.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    delTxt:       { color: C.red, fontWeight: "700", fontSize: 12 },
  });
}
