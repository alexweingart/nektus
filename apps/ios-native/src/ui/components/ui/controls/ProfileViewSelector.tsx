import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

type ViewMode = "personal" | "work";

interface ProfileViewSelectorProps {
  selected: ViewMode;
  onSelect: (mode: ViewMode) => void;
}

export function ProfileViewSelector({
  selected,
  onSelect,
}: ProfileViewSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, selected === "personal" && styles.tabSelected]}
        onPress={() => onSelect("personal")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            selected === "personal" && styles.tabTextSelected,
          ]}
        >
          Personal
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, selected === "work" && styles.tabSelected]}
        onPress={() => onSelect("work")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            selected === "work" && styles.tabTextSelected,
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
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.3)", // Semi-transparent dark
    borderRadius: 9999, // Pill shape
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999, // Pill shape
    alignItems: "center",
  },
  tabSelected: {
    backgroundColor: "#ffffff", // White selected tab
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)", // Muted white
  },
  tabTextSelected: {
    color: "#1f2937", // Dark gray text
  },
});

export default ProfileViewSelector;
