import React, { forwardRef } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { ThemedTextInput } from "./ThemedTextInput";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, style, ...props }, ref) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <ThemedTextInput
          ref={ref}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor="#666"
          {...props}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 9999, // Pill shape
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 16,
    color: "#000",
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
  },
  inputError: {
    borderColor: "#ef4444",
  },
  error: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    marginLeft: 4,
  },
});

export default Input;
