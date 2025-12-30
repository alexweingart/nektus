import React, { ReactNode } from "react";
import { Text, StyleSheet, TextStyle } from "react-native";

interface HeadingProps {
  children: ReactNode;
  className?: string;
  style?: TextStyle;
}

interface BodyTextProps {
  children: ReactNode;
  className?: string;
  style?: TextStyle;
  muted?: boolean;
}

export function Heading({ children, style }: HeadingProps) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function BodyText({ children, style, muted = false }: BodyTextProps) {
  return (
    <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>
  );
}

export function Label({ children, style }: HeadingProps) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24, // text-2xl (1.5rem = 24px)
    fontWeight: "700", // font-bold
    color: "#ffffff",
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: "#ffffff",
    lineHeight: 24,
  },
  muted: {
    color: "#888888",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
