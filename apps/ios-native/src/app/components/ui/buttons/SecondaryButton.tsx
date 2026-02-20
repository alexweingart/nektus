import React, { ReactNode } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { fontStyles, textSizes } from "../Typography";

type SecondaryButtonVariant = "dark" | "subtle" | "destructive" | "light";

interface SecondaryButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: SecondaryButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * SecondaryButton - matches web's SecondaryButton component
 * Small, rounded pill buttons with semi-transparent backgrounds
 */
export function SecondaryButton({
  children,
  onPress,
  variant = "dark",
  disabled = false,
  style,
  textStyle,
}: SecondaryButtonProps) {
  const buttonStyles = [
    styles.base,
    styles[variant],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={textStyles}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999, // Pill shape
    alignItems: "center",
    justifyContent: "center",
  },
  // Matches web: bg-black/60 backdrop-blur-lg hover:bg-white/20
  dark: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  // Matches web: bg-white/20 backdrop-blur-lg hover:bg-white/40
  subtle: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  // Matches web: bg-red-500/50 backdrop-blur-lg hover:bg-red-500/70
  destructive: {
    backgroundColor: "rgba(239, 68, 68, 0.5)", // red-500 at 50%
  },
  // Matches web: bg-white hover:bg-gray-100
  light: {
    backgroundColor: "#ffffff",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...fontStyles.semibold,
    color: "#ffffff",
    ...textSizes.sm, // text-sm
  },
  darkText: {
    color: "#ffffff",
  },
  subtleText: {
    color: "#ffffff",
  },
  destructiveText: {
    color: "#ffffff",
  },
  lightText: {
    color: "#111827", // gray-900
  },
});

export default SecondaryButton;
