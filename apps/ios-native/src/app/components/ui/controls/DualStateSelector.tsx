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
  /** Called on press in (before press completes) - useful for focus management */
  onWillChange?: (option: T) => void;
  style?: ViewStyle;
  minWidth?: number;
  /** Tint color for the slider (from profile colors) */
  tintColor?: string;
}

export function DualStateSelector<T extends string>({
  options,
  selectedOption,
  onOptionChange,
  onWillChange,
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
      return "rgba(34, 197, 94, 0.30)";
    }

    // Parse hex color
    const hex = tintColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Web uses layered gradients with 0.30 and 0.20 opacity for tint
    // Use 0.30 (higher end) for more vibrant color, less washed out look
    return `rgba(${r}, ${g}, ${b}, 0.30)`;
  };

  // Calculate total width based on minWidth (2 buttons)
  const totalWidth = minWidth * 2;

  return (
    <View style={[styles.container, { width: totalWidth }, style]}>
      {/* Background slider (selected state indicator) */}
      <Animated.View
        style={[
          styles.slider,
          {
            left: sliderLeft,
            backgroundColor: getSliderBackground(),
          },
        ]}
      >
        {/* White overlay to match web's layered gradient look */}
        <View style={styles.sliderOverlay} />
      </Animated.View>

      {/* Option buttons */}
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.button, { minWidth }]}
          onPressIn={() => {
            // Call onWillChange BEFORE the press completes (before blur)
            if (option !== selectedOption) {
              onWillChange?.(option);
            }
          }}
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
    alignSelf: "center", // Don't stretch to full width, shrink to content
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
  sliderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    backgroundColor: "rgba(255, 255, 255, 0.08)", // White overlay (lower end of web's 0.15-0.08 gradient)
  },
  button: {
    position: "relative",
    zIndex: 10,
    flex: 1, // Equal width buttons so 50% slider covers exactly one button
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
