import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const CheckInScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📷 QR Scanner</Text>
      <Text style={styles.subtitle}>
        Camera scanner sẽ implement ở Ngày 6-7
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
