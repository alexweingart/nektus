import React, { ReactNode } from "react";
import { Text, StyleSheet, TextStyle } from "react-native";
import { SF_ROUNDED } from "../../../shared/fonts";

type HeadingVariant = "h1" | "h2" | "h3";

interface HeadingProps {
  children: ReactNode;
  /** Heading variant - h1: 24px/bold, h2: 20px/semibold, h3: 18px/medium */
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
const headingVariantStyles = StyleSheet.create({
  h1: {
    fontSize: 24, // text-2xl
    fontFamily: SF_ROUNDED.bold,
  },
  h2: {
    fontSize: 20, // text-xl
    fontFamily: SF_ROUNDED.semibold,
  },
  h3: {
    fontSize: 18, // text-lg
    fontFamily: SF_ROUNDED.medium,
  },
});

// Body text variant styles matching web Typography
const bodyVariantStyles = StyleSheet.create({
  base: {
    fontSize: 16, // text-base
  },
  small: {
    fontSize: 14, // text-sm
  },
});

const styles = StyleSheet.create({
  heading: {
    color: "#ffffff",
    // No marginBottom - spacing should be controlled by parent containers
  },
  body: {
    fontFamily: SF_ROUNDED.regular,
    color: "#ffffff",
    lineHeight: 24,
  },
  muted: {
    color: "#9CA3AF", // text-gray-400 matching web
  },
  label: {
    fontSize: 14,
    fontFamily: SF_ROUNDED.semibold,
    color: "#888888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

/**
 * Reusable font styles for components that render text outside of Typography.
 * Import these instead of SF_ROUNDED directly to keep font config centralized.
 */
export const fontStyles = StyleSheet.create({
  regular: { fontFamily: SF_ROUNDED.regular },
  medium: { fontFamily: SF_ROUNDED.medium },
  semibold: { fontFamily: SF_ROUNDED.semibold },
  bold: { fontFamily: SF_ROUNDED.bold },
  heavy: { fontFamily: SF_ROUNDED.heavy },
});
