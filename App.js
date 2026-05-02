// App.js
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DeviceListScreen  from "./app/screens/DeviceListScreen";
import DeviceDetailScreen from "./app/screens/DeviceDetailScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: "#1c1f2e" },
          headerTintColor:  "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle:     { backgroundColor: "#0f1117" },
        }}
      >
        <Stack.Screen
          name="Home"
          component={DeviceListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Detail"
          component={DeviceDetailScreen}
          options={({ route }) => ({
            title: route.params?.device?.device_name || "Chi tiết",
            headerBackTitle: "Quay lại",
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
