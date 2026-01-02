import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NektLogo } from "../ui/elements/NektLogo";

export function SplashScreen() {
  // Same gradient colors as ParticleNetwork (signed-out context)
  const gradientColors = [
    "rgba(34, 197, 94, 0.3)",
    "rgba(34, 197, 94, 0.12)",
    "#0a0f1a",
  ] as const;

  return (
    <View style={styles.container}>
      {/* Linear gradient background matching app theme */}
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Centered Nekt logo */}
      <View style={styles.logoContainer}>
        <NektLogo width={280} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SplashScreen;
