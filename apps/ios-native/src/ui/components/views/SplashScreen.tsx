import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import {
  Canvas,
  Rect,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import { NektLogo } from "../ui/elements/NektLogo";

export function SplashScreen() {
  const { width, height } = useWindowDimensions();

  // Same gradient colors as ParticleNetwork (signed-out context)
  const gradientColors = {
    start: "rgba(34, 197, 94, 0.3)",
    middle: "rgba(34, 197, 94, 0.12)",
    end: "#0a0f1a",
  };

  return (
    <View style={styles.container}>
      {/* Radial gradient background matching app theme */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, 0)}
            r={height * 0.6}
            colors={[
              gradientColors.start,
              gradientColors.middle,
              gradientColors.end,
              gradientColors.end,
            ]}
            positions={[0, 0.35, 0.6, 1]}
          />
        </Rect>
      </Canvas>

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
