import React from "react";
import { View, StyleSheet } from "react-native";
import { SocialIcon } from "../elements/SocialIcon";
import type { ContactEntry } from "../../../../modules/context/ProfileContext";

interface SocialIconsListProps {
  contactEntries: ContactEntry[];
  excludeTypes?: string[];
}

// Field types to display as icons (exclude name, bio, etc.)
const ICON_FIELD_TYPES = [
  "phone",
  "email",
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "snapchat",
  "tiktok",
  "github",
  "website",
];

export function SocialIconsList({
  contactEntries,
  excludeTypes = ["name", "bio"],
}: SocialIconsListProps) {
  // Filter to only visible contact entries that should show as icons
  const visibleEntries = contactEntries.filter(
    (entry) =>
      entry.isVisible &&
      entry.value?.trim() &&
      !excludeTypes.includes(entry.fieldType) &&
      (ICON_FIELD_TYPES.includes(entry.fieldType) ||
        entry.linkType === "custom")
  );

  // Sort by order
  const sortedEntries = [...visibleEntries].sort((a, b) => a.order - b.order);

  if (sortedEntries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {sortedEntries.map((entry, index) => (
        <SocialIcon
          key={`${entry.fieldType}-${entry.section}-${index}`}
          fieldType={entry.fieldType}
          value={entry.value}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});

export default SocialIconsList;
