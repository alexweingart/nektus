/**
 * Button component - adapted from web
 * Supports white, circle, theme, and destructive variants
 * Includes radial gradient effect for white/circle/theme variants
 * Features spring animation on press (scale 0.96 → 1 with spring easing)
 */

import React, { ReactNode, useRef, useCallback, useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { RadialGradient } from "react-native-gradients";

type ButtonVariant = "white" | "circle" | "theme" | "destructive" | "primary" | "black";
type ButtonSize = "md" | "lg" | "xl" | "icon";

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
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
  loadingText,
  style,
  textStyle,
  icon,
  iconPosition = "left",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Spring animation for press effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    console.log('[Button] onPress called, variant:', variant);
    onPress();
  }, [onPress, variant]);

  // Determine if variant has radial gradient (white, circle, theme, primary)
  const hasGradient = variant === "white" || variant === "circle" || variant === "theme" || variant === "primary";

  // Color list for radial gradient matching web: radial-gradient(circle, rgb(255 255 255 / 1), rgb(255 255 255 / 0.6))
  const gradientColorList = [
    { offset: "0%", color: "#ffffff", opacity: "1" },
    { offset: "100%", color: "#ffffff", opacity: "0.6" }
  ];

  // Size configurations matching web
  const sizeConfig = {
    md: { height: 48, paddingHorizontal: 24, fontSize: 16, fontWeight: '500' as const, minWidth: 200 }, // h-12 px-6 text-base
    lg: { height: 56, paddingHorizontal: 32, fontSize: 18, fontWeight: '500' as const, minWidth: 200 }, // h-14 px-8 text-lg
    xl: { height: 64, paddingHorizontal: 40, fontSize: 20, fontWeight: '600' as const, minWidth: 200 }, // h-16 px-10 text-xl font-semibold
    icon: { height: 56, paddingHorizontal: 0, fontSize: 14, fontWeight: '500' as const, minWidth: 56 }, // h-14 w-14 p-0 text-sm
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
    isDisabled ? styles.disabled : undefined,
    style,
  ].filter((s): s is ViewStyle => Boolean(s));

  // Text styles
  const textStyles: TextStyle[] = [
    styles.text,
    { fontSize: currentSize.fontSize, fontWeight: currentSize.fontWeight },
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    textStyle,
  ].filter((s): s is TextStyle => s !== undefined);

  const content = (
    <>
      {loading ? (
        <>
          <ActivityIndicator
            size="small"
            color={variant === "destructive" || variant === "black" ? "#ffffff" : "#374151"}
          />
          {loadingText && (
            <Text style={[textStyles, styles.loadingText]}>{loadingText}</Text>
          )}
        </>
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={containerStyles}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1} // We handle visual feedback via scale animation
      >
        {/* Backdrop blur + radial gradient background matching web */}
        {hasGradient && (
          <View style={StyleSheet.absoluteFillObject}>
            {/* Backdrop blur (matches web's backdrop-blur-lg) */}
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="light"
              intensity={50}
            />
            {/* Radial gradient overlay */}
            <RadialGradient
              x="50%"
              y="50%"
              rx="71%"
              ry="71%"
              colorList={gradientColorList}
            />
          </View>
        )}
        <View style={styles.contentRow}>{content}</View>
      </TouchableOpacity>
    </Animated.View>
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
  loadingText: {
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
  black: {
    backgroundColor: "#000000", // Apple Sign-in branding
    borderWidth: 0,
  },

  disabled: {
    opacity: 0.5,
  },

  // Text styles - matching web's Tailwind typography
  text: {
    fontFamily: 'System', // San Francisco on iOS, matches web's system font
    letterSpacing: 0.2, // Slight letter spacing for better readability
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
  blackText: {
    color: "#ffffff",
  },
});

export default Button;
