import React from "react";
import { StyleSheet } from "react-native";
import { DualStateSelector } from "./DualStateSelector";

type ViewMode = "Personal" | "Work";

interface ProfileViewSelectorProps {
  selected: ViewMode;
  onSelect: (mode: ViewMode) => void;
  /** Tint color for the slider (from profile.backgroundColors[2]) */
  tintColor?: string;
}

/**
 * ProfileViewSelector - uses DualStateSelector for Personal/Work toggle
 * Refactored to use the shared DualStateSelector component
 */
export function ProfileViewSelector({
  selected,
  onSelect,
  tintColor,
}: ProfileViewSelectorProps) {
  return (
    <DualStateSelector
      options={["Personal", "Work"]}
      selectedOption={selected}
      onOptionChange={onSelect}
      tintColor={tintColor}
      style={styles.selector}
      minWidth={80}
    />
  );
}

const styles = StyleSheet.create({
  selector: {
    width: 192, // w-48 (12rem = 192px) - match web
    alignSelf: "center",
  },
});

export default ProfileViewSelector;
