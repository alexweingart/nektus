/**
 * Button component - adapted from web
 * Supports white, circle, theme, and destructive variants
 * Includes radial gradient effect for white/circle/theme variants
 */

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
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";

type ButtonVariant = "white" | "circle" | "theme" | "destructive" | "primary";
type ButtonSize = "md" | "lg" | "xl" | "icon";

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
  iconPosition?: "left" | "right";
}

export function Button({
  children,
  onPress,
  variant = "white",
  size = "md",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = "left",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Generate unique ID for gradient to avoid conflicts between multiple buttons
  const gradientId = React.useMemo(() => `btnGrad-${Math.random().toString(36).substr(2, 9)}`, []);

  // Determine if variant has radial gradient (white, circle, theme, primary)
  const hasGradient = variant === "white" || variant === "circle" || variant === "theme" || variant === "primary";

  // Size configurations matching web
  const sizeConfig = {
    md: { height: 48, paddingHorizontal: 24, fontSize: 16, minWidth: 200 }, // h-12 px-6 text-base
    lg: { height: 56, paddingHorizontal: 32, fontSize: 18, minWidth: 200 }, // h-14 px-8 text-lg
    xl: { height: 64, paddingHorizontal: 40, fontSize: 20, minWidth: 200 }, // h-16 px-10 text-xl
    icon: { height: 56, paddingHorizontal: 0, fontSize: 14, minWidth: 56 }, // h-14 w-14 p-0 text-sm (web uses w-14 h-14)
  };

  const currentSize = sizeConfig[size];

  // For circle variant with icon size, ensure perfect square
  const isCircle = variant === "circle";
  const containerWidth = isCircle || size === "icon" ? currentSize.height : undefined;

  // Button container styles
  const containerStyles: ViewStyle[] = [
    styles.base,
    {
      height: currentSize.height,
      minWidth: isCircle || size === "icon" ? currentSize.height : currentSize.minWidth,
      width: containerWidth,
      paddingHorizontal: currentSize.paddingHorizontal,
    },
    styles[variant],
    isDisabled && styles.disabled,
    style,
  ];

  // Text styles
  const textStyles: TextStyle[] = [
    styles.text,
    { fontSize: currentSize.fontSize },
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    textStyle,
  ];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "destructive" ? "#ffffff" : "#374151"}
        />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          {typeof children === "string" ? (
            <Text style={textStyles}>{children}</Text>
          ) : (
            children
          )}
          {icon && iconPosition === "right" && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </>
      )}
    </>
  );

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {/* Radial gradient background matching web */}
      {hasGradient && (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <SvgRadialGradient id={gradientId} cx={0.5} cy={0.5} r={1.0}>
              <Stop offset={0} stopColor="#ffffff" stopOpacity={1} />
              <Stop offset={1} stopColor="#ffffff" stopOpacity={0.6} />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      )}
      <View style={styles.contentRow}>{content}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 9999, // rounded-full
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "hidden", // Clip gradient to border radius
    // Shadow matching web shadow-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1, // Above gradient
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },

  // Variant styles
  white: {
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    backgroundColor: "transparent", // Let gradient show through
  },
  primary: {
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    backgroundColor: "transparent", // Let gradient show through
  },
  circle: {
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    backgroundColor: "transparent", // Let gradient show through
    padding: 0,
  },
  theme: {
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    backgroundColor: "transparent", // Let gradient show through
  },
  destructive: {
    backgroundColor: "#ef4444", // red-500
    borderWidth: 1,
    borderColor: "#dc2626", // red-600
  },

  disabled: {
    opacity: 0.5,
  },

  // Text styles
  text: {
    fontWeight: "500",
  },
  whiteText: {
    color: "#111827", // gray-900
  },
  primaryText: {
    color: "#111827", // gray-900 (same as white)
  },
  circleText: {
    color: "#111827", // gray-900
  },
  themeText: {
    color: "#004D40", // theme color
  },
  destructiveText: {
    color: "#ffffff",
  },
});

export default Button;
