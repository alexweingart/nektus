/**
 * DualStateSelector - Reusable toggle component with sliding background
 * Used for binary state selection (e.g., Personal/Work, Social/Custom)
 * Matches web implementation
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from "react-native";

interface DualStateSelectorProps<T extends string> {
  options: [T, T]; // Exactly two options
  selectedOption: T;
  onOptionChange: (option: T) => void;
  style?: ViewStyle;
  minWidth?: number;
  /** Tint color for the slider (from profile colors) */
  tintColor?: string;
}

export function DualStateSelector<T extends string>({
  options,
  selectedOption,
  onOptionChange,
  style,
  minWidth = 80,
  tintColor,
}: DualStateSelectorProps<T>) {
  // Animated value for slider position (0 = left, 1 = right)
  const slideAnim = useRef(
    new Animated.Value(selectedOption === options[1] ? 1 : 0)
  ).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedOption === options[1] ? 1 : 0,
      useNativeDriver: false,
      tension: 40,
      friction: 7,
    }).start();
  }, [selectedOption, slideAnim, options]);

  // Calculate slider position (0% for left, 50% for right)
  const sliderLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  // Convert hex color to rgba with opacity - matches web's glass tint logic
  const getSliderBackground = () => {
    if (!tintColor) {
      // Default green (matches web default: 113, 228, 84)
      return "rgba(34, 197, 94, 0.25)";
    }

    // Parse hex color
    const hex = tintColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Web uses layered gradients with 0.30 and 0.20 opacity
    // iOS approximates with single color at ~0.25 opacity (average)
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Background slider (selected state indicator) */}
      <Animated.View
        style={[
          styles.slider,
          {
            left: sliderLeft,
            backgroundColor: getSliderBackground(),
          },
        ]}
      />

      {/* Option buttons */}
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.button, { minWidth }]}
          onPress={() => onOptionChange(option)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.buttonText,
              selectedOption === option
                ? styles.buttonTextSelected
                : styles.buttonTextUnselected,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    backgroundColor: "rgba(0, 0, 0, 0.6)", // bg-black/60 backdrop-blur-lg
    borderRadius: 9999, // rounded-full
    flexDirection: "row",
  },
  slider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    borderRadius: 9999,
    // backgroundColor set dynamically via inline style to use profile color
    // Matches web's layered gradient approach with approximated opacity
  },
  button: {
    position: "relative",
    zIndex: 10,
    flex: 1, // Equal width (flex-1)
    paddingVertical: 4, // py-1
    paddingHorizontal: 12, // px-3
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14, // text-sm
    fontWeight: "700", // font-bold
    lineHeight: 20, // Default line-height for text-sm in Tailwind (~1.43x)
    textAlign: "center",
  },
  buttonTextSelected: {
    color: "rgba(255, 255, 255, 1)", // text-white (100%)
  },
  buttonTextUnselected: {
    color: "rgba(255, 255, 255, 0.8)", // text-white/80
  },
});

export default DualStateSelector;
