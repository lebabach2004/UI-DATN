import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function LoginScreen({ onLogin }) {
  const { C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);

  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await api.login(username.trim(), password);
      onLogin(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.inner}>
        <Text style={s.logo}>📡</Text>
        <Text style={s.title}>LoRaWAN Monitor</Text>
        <Text style={s.sub}>Đăng nhập để tiếp tục</Text>

        <View style={s.card}>
          <Text style={s.label}>Tên đăng nhập</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={C.text3}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[s.label, { marginTop: 14 }]}>Mật khẩu</Text>
          <View style={s.pwWrap}>
            <TextInput
              style={s.pwInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.text3}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.text3} />
            </TouchableOpacity>
          </View>

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Đăng nhập</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    inner:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    logo:      { fontSize: 52, marginBottom: 12 },
    title:     { fontSize: 26, fontWeight: "800", color: C.text1, letterSpacing: -0.5 },
    sub:       { fontSize: 14, color: C.text2, marginTop: 6, marginBottom: 32 },
    card:      { width: "100%", backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
    label:     { fontSize: 12, fontWeight: "600", color: C.text2, marginBottom: 8, letterSpacing: 0.5 },
    input:     { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.text1, fontSize: 15 },
    pwWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12 },
    pwInput:   { flex: 1, paddingHorizontal: 16, paddingVertical: 13, color: C.text1, fontSize: 15 },
    eyeBtn:    { paddingHorizontal: 14, paddingVertical: 13 },
    error:     { color: C.red, fontSize: 13, marginTop: 12, textAlign: "center" },
    btn:       { marginTop: 22, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    btnTxt:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
}
