import "react-native-gesture-handler";
import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, StyleSheet,
} from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { ThresholdProvider } from "./src/context/ThresholdContext";
import { api } from "./src/services/api";
import LoginScreen        from "./src/screens/LoginScreen";
import DeviceListScreen   from "./src/screens/DeviceListScreen";
import DeviceDetailScreen from "./src/screens/DeviceDetailScreen";
import AdminScreen        from "./src/screens/AdminScreen";
import DashboardScreen    from "./src/screens/DashboardScreen";

const Stack = createNativeStackNavigator();

function HeaderBtn({ label, onPress, C }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 }}
    >
      <Text style={{ color: C.text2, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Modal menu người dùng ─────────────────────────────────────
function UserMenuModal({ visible, username, role, onChangePw, onLogout, onClose }) {
  const { C } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={um.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[um.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[um.info, { borderBottomColor: C.border }]}>
            <Text style={[um.name, { color: C.text1 }]}>{username}</Text>
            <Text style={[um.roleLabel, { color: C.text3 }]}>
              {role === "building_admin" ? "Quản trị viên" : "Người dùng"}
            </Text>
          </View>
          <TouchableOpacity style={um.item} onPress={() => { onClose(); onChangePw(); }}>
            <Text style={[um.itemTxt, { color: C.text1 }]}>🔑  Đổi mật khẩu</Text>
          </TouchableOpacity>
          <View style={[um.sep, { backgroundColor: C.border }]} />
          <TouchableOpacity style={um.item} onPress={() => { onClose(); onLogout(); }}>
            <Text style={[um.itemTxt, { color: C.red }]}>↪️  Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const um = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end", paddingBottom: 40 },
  sheet:   { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  info:    { paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  name:    { fontSize: 16, fontWeight: "700" },
  roleLabel: { fontSize: 12, marginTop: 2 },
  item:    { paddingHorizontal: 18, paddingVertical: 16 },
  itemTxt: { fontSize: 15, fontWeight: "600" },
  sep:     { height: 1 },
});

// ─── Modal đổi mật khẩu ────────────────────────────────────────
function ChangePasswordModal({ visible, onClose }) {
  const { C } = useTheme();
  const m = useMemo(() => makeModalStyles(C), [C]);

  const [cur,     setCur]     = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  function reset() { setCur(""); setNext(""); setConfirm(""); setError(null); }

  async function handleSubmit() {
    if (!cur || !next || !confirm) { setError("Vui lòng điền đầy đủ"); return; }
    if (next !== confirm)          { setError("Mật khẩu mới không khớp"); return; }
    if (next.length < 4)           { setError("Mật khẩu mới tối thiểu 4 ký tự"); return; }
    try {
      setLoading(true);
      setError(null);
      await api.changePassword(cur, next);
      Alert.alert("Thành công", "Đổi mật khẩu thành công");
      reset();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.box}>
          <Text style={m.title}>Đổi mật khẩu</Text>

          <Text style={m.label}>Mật khẩu hiện tại</Text>
          <TextInput style={m.input} value={cur} onChangeText={setCur}
            secureTextEntry placeholderTextColor={C.text3} placeholder="••••••••" />

          <Text style={[m.label, { marginTop: 12 }]}>Mật khẩu mới</Text>
          <TextInput style={m.input} value={next} onChangeText={setNext}
            secureTextEntry placeholderTextColor={C.text3} placeholder="••••••••" />

          <Text style={[m.label, { marginTop: 12 }]}>Xác nhận mật khẩu mới</Text>
          <TextInput style={m.input} value={confirm} onChangeText={setConfirm}
            secureTextEntry placeholderTextColor={C.text3} placeholder="••••••••" />

          {error && <Text style={m.error}>{error}</Text>}

          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={m.cancelTxt}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.saveBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.saveTxt}>Xác nhận</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeModalStyles(C) {
  return StyleSheet.create({
    overlay:   { flex: 1, backgroundColor: "#000000bb", justifyContent: "center", alignItems: "center" },
    box:       { width: "88%", backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
    title:     { fontSize: 18, fontWeight: "800", color: C.text1, marginBottom: 20 },
    label:     { fontSize: 12, fontWeight: "600", color: C.text2, marginBottom: 8 },
    input:     { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: C.text1, fontSize: 14 },
    error:     { color: C.red, fontSize: 12, marginTop: 10, textAlign: "center" },
    btnRow:    { flexDirection: "row", gap: 10, marginTop: 20 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    cancelTxt: { color: C.text2, fontWeight: "600" },
    saveBtn:   { flex: 1, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    saveTxt:   { color: "#fff", fontWeight: "700" },
  });
}

// ─── Nội dung App (cần ThemeProvider bên ngoài) ────────────────
function AppContent() {
  const { C, isDark, toggleTheme } = useTheme();

  const [user,         setUser]         = useState(null);
  const [booting,      setBooting]      = useState(true);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background:   C.bg,
      card:         C.card,
      text:         C.text1,
      border:       C.border,
      primary:      C.primary,
      notification: C.red,
    },
  }), [C, isDark]);

  useEffect(() => {
    api.getStoredUser().then((stored) => {
      if (stored) setUser(stored);
      setBooting(false);
    });
  }, []);

  function handleLogin(data) {
    setUser({ role: data.role, dev_eui: data.dev_eui, username: data.username });
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
  }

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const themeBtn = <HeaderBtn label={isDark ? "☀️" : "🌙"} onPress={toggleTheme} C={C} />;
  const userBtn  = <HeaderBtn label="👤" onPress={() => setShowUserMenu(true)} C={C} />;

  return (
    <>
      <ChangePasswordModal visible={showChangePw} onClose={() => setShowChangePw(false)} />
      <UserMenuModal
        visible={showUserMenu}
        username={user?.username ?? ""}
        role={user?.role ?? "user"}
        onChangePw={() => setShowChangePw(true)}
        onLogout={handleLogout}
        onClose={() => setShowUserMenu(false)}
      />

      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle:      { backgroundColor: C.card },
            headerTintColor:  C.text1,
            headerTitleStyle: { fontWeight: "700" },
            headerBackTitle:  "Quay lại",
          }}
        >
          {!user ? (
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {() => <LoginScreen onLogin={handleLogin} />}
            </Stack.Screen>

          ) : user.role === "building_admin" ? (
            <>
              <Stack.Screen
                name="Home"
                options={({ navigation }) => ({
                  title: "Thiết bị LoRaWAN",
                  headerRight: () => (
                    <View style={{ flexDirection: "row" }}>
                      <HeaderBtn label="📊" onPress={() => navigation.navigate("Dashboard")} C={C} />
                      <HeaderBtn label="👥" onPress={() => navigation.navigate("Admin")} C={C} />
                      {themeBtn}
                      {userBtn}
                    </View>
                  ),
                })}
                component={DeviceListScreen}
              />
              {/* isAdmin=true để DeviceDetailScreen hiện nút chỉnh ngưỡng */}
              <Stack.Screen
                name="Detail"
                initialParams={{ isAdmin: true }}
                options={({ route }) => ({ title: route.params?.device?.device_name || "Chi tiết" })}
                component={DeviceDetailScreen}
              />
              <Stack.Screen
                name="Admin"
                options={{ title: "Quản lý tài khoản" }}
                component={AdminScreen}
              />
              <Stack.Screen
                name="Dashboard"
                options={{ title: "Tổng quan hệ thống" }}
                component={DashboardScreen}
              />
            </>

          ) : (
            <Stack.Screen
              name="MyRoom"
              options={{
                title: "Phòng của tôi",
                headerRight: () => (
                  <View style={{ flexDirection: "row" }}>
                    {themeBtn}
                    {userBtn}
                  </View>
                ),
              }}
            >
              {(props) => (
                <DeviceDetailScreen
                  {...props}
                  route={{
                    ...props.route,
                    params: { device: { dev_eui: user.dev_eui, device_name: user.username }, isAdmin: false },
                  }}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

// ─── Root ──────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <ThresholdProvider>
        <AppContent />
      </ThresholdProvider>
    </ThemeProvider>
  );
}
