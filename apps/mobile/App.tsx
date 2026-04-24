import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { initDatabase } from "./src/services/offlineSync/database";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CheckInScreen } from "./src/screens/CheckIn/CheckInScreen";
import { AuthProvider } from "./src/contexts/AuthContext";

// Cài thêm navigation
// npm install @react-navigation/native @react-navigation/native-stack
// npx expo install react-native-screens react-native-safe-area-context

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Khởi tạo SQLite khi app load
    initDatabase().catch(console.error);
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "UniHub Check-in" }}
        />
        <Stack.Screen
          name="CheckIn"
          component={CheckInScreen}
          options={{ title: "Quét mã QR" }}
        />
      </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
