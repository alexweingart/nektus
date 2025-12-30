import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Animated } from "react-native";

type ViewMode = "personal" | "work";

interface ProfileViewSelectorProps {
  selected: ViewMode;
  onSelect: (mode: ViewMode) => void;
  /** Tint color for the slider (from profile.backgroundColors[2]) */
  tintColor?: string;
}

export function ProfileViewSelector({
  selected,
  onSelect,
  tintColor,
}: ProfileViewSelectorProps) {
  // Animated value for slider position (0 = left/personal, 1 = right/work)
  const slideAnim = React.useRef(new Animated.Value(selected === "work" ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selected === "work" ? 1 : 0,
      useNativeDriver: false,
      tension: 40,
      friction: 7,
    }).start();
  }, [selected, slideAnim]);

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
    const hex = tintColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Web uses layered gradients with 0.30 and 0.20 opacity
    // iOS approximates with single color at ~0.25 opacity (average)
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
  };

  return (
    <View style={styles.container}>
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
      <TouchableOpacity
        style={styles.button}
        onPress={() => onSelect("personal")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.buttonText,
            selected === "personal" ? styles.buttonTextSelected : styles.buttonTextUnselected,
          ]}
        >
          Personal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => onSelect("work")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.buttonText,
            selected === "work" ? styles.buttonTextSelected : styles.buttonTextUnselected,
          ]}
        >
          Work
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    backgroundColor: "rgba(0, 0, 0, 0.6)", // bg-black/60
    borderRadius: 9999, // rounded-full
    flexDirection: "row",
    width: 192, // w-48 (12rem = 192px) - match web
    alignSelf: "center",
  },
  slider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    borderRadius: 9999,
    // backgroundColor set dynamically via inline style to use profile color
    // Web uses layered gradients, iOS approximates with single color at 0.25 opacity
  },
  button: {
    position: "relative",
    zIndex: 10,
    flex: 1, // Equal width (flex-1)
    paddingVertical: 8, // Slightly more padding for better touch target
    paddingHorizontal: 12, // px-3 (12px)
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80, // Match web minWidth
  },
  buttonText: {
    fontSize: 14, // text-sm
    fontWeight: "700", // font-bold
    textAlign: "center",
  },
  buttonTextSelected: {
    color: "rgba(255, 255, 255, 1)", // text-white (100%)
  },
  buttonTextUnselected: {
    color: "rgba(255, 255, 255, 0.8)", // text-white/80
  },
});

export default ProfileViewSelector;
