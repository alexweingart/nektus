import React, { ReactNode } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost" | "white";
type ButtonSize = "md" | "lg" | "xl";

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: ReactNode;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Size-specific styles matching web: md=h-12(48px), lg=h-14(56px), xl=h-16(64px)
  const sizeStyles = {
    md: { height: 48, paddingHorizontal: 24 },
    lg: { height: 56, paddingHorizontal: 32 },
    xl: { height: 64, paddingHorizontal: 40 },
  };

  const textSizeStyles = {
    md: { fontSize: 16 },
    lg: { fontSize: 18 },
    xl: { fontSize: 20 },
  };

  const buttonStyles = [
    styles.base,
    sizeStyles[size],
    styles[variant],
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    textSizeStyles[size],
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    textStyle,
  ];

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "white" ? "#1f2937" : "#fff"}
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={textStyles}>{children}</Text>
        </>
      )}
    </View>
  );

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 9999, // Pill shape
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  touchable: {
    borderRadius: 9999,
    minWidth: 200,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    // Shadow matching web shadow-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  gradientBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    borderRadius: 9999,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
  primary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    // Shadow matching web shadow-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  white: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    // Shadow matching web shadow-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "500",
  },
  primaryText: {
    color: "#374151", // gray-700 matching web
  },
  secondaryText: {
    color: "#ffffff",
  },
  ghostText: {
    color: "#ffffff",
  },
  whiteText: {
    color: "#374151", // gray-700 matching web
  },
});

export default Button;
