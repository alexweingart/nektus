import React, { ReactNode } from "react";
import { Text, StyleSheet, TextStyle } from "react-native";
import { SORA } from "../../../shared/fonts";

type HeadingVariant = "h1" | "h2" | "h3";

interface HeadingProps {
  children: ReactNode;
  /** Heading variant - h1: 24px, h2: 20px, h3: 18px (all bold, size creates hierarchy) */
  variant?: HeadingVariant;
  className?: string;
  style?: TextStyle;
}

type BodyTextVariant = "base" | "small";

interface BodyTextProps {
  children: ReactNode;
  /** Text variant - base: 16px, small: 14px */
  variant?: BodyTextVariant;
  className?: string;
  style?: TextStyle;
  muted?: boolean;
}

export function Heading({ children, variant = "h1", style }: HeadingProps) {
  return <Text style={[styles.heading, headingVariantStyles[variant], style]}>{children}</Text>;
}

export function BodyText({ children, variant = "base", style, muted = false }: BodyTextProps) {
  return (
    <Text style={[styles.body, bodyVariantStyles[variant], muted && styles.muted, style]}>{children}</Text>
  );
}

export function Label({ children, style }: Omit<HeadingProps, "variant">) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

// Heading variant styles matching web Typography
// All headings use bold — size creates the visual hierarchy
const headingVariantStyles = StyleSheet.create({
  h1: {
    fontSize: 24, // text-2xl
    lineHeight: 32,
    fontFamily: SORA.bold,
  },
  h2: {
    fontSize: 20, // text-xl
    lineHeight: 28,
    fontFamily: SORA.bold,
  },
  h3: {
    fontSize: 18, // text-lg
    lineHeight: 28,
    fontFamily: SORA.bold,
  },
});

// Body text variant styles matching web Typography
const bodyVariantStyles = StyleSheet.create({
  base: {
    fontSize: 16, // text-base
  },
  small: {
    fontSize: 14, // text-sm
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  heading: {
    color: "#ffffff",
  },
  body: {
    fontFamily: SORA.regular,
    color: "#ffffff",
    lineHeight: 24,
  },
  muted: {
    color: "#9CA3AF", // text-gray-400 matching web
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: SORA.bold,
    color: "#888888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

/**
 * Three font weights: regular (body), semibold (buttons/CTAs), bold (headings/titles).
 * Import these instead of SORA directly to keep font config centralized.
 */
export const fontStyles = StyleSheet.create({
  regular: { fontFamily: SORA.regular },
  semibold: { fontFamily: SORA.semibold },
  bold: { fontFamily: SORA.bold },
});

/**
 * Tailwind-equivalent text size styles (fontSize + lineHeight).
 * Use these instead of inline fontSize to ensure line-height parity with web.
 *
 *   textSizes.xs   = text-xs   (12px / 16px)
 *   textSizes.sm   = text-sm   (14px / 20px)
 *   textSizes.base = text-base (16px / 24px)
 *   textSizes.lg   = text-lg   (18px / 28px)
 *   textSizes.xl   = text-xl   (20px / 28px)
 *   textSizes.xxl  = text-2xl  (24px / 32px)
 *   textSizes.xxxl = text-3xl  (30px / 36px)
 */
export const textSizes = StyleSheet.create({
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  xxl: { fontSize: 24, lineHeight: 32 },
  xxxl: { fontSize: 30, lineHeight: 36 },
});
