import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";

interface SocialIconProps {
  fieldType: string;
  value: string;
  onPress?: () => void;
}

// Icon mapping for different field types
const iconMap: Record<string, string> = {
  phone: "\u260E", // Phone symbol
  email: "\u2709", // Envelope
  instagram: "IG",
  facebook: "FB",
  linkedin: "in",
  x: "X",
  snapchat: "SC",
  tiktok: "TT",
  github: "GH",
  website: "\u{1F517}", // Link symbol
};

// URL builder for different platforms
function buildUrl(fieldType: string, value: string): string | null {
  switch (fieldType) {
    case "phone":
      return `tel:${value.replace(/\D/g, "")}`;
    case "email":
      return `mailto:${value}`;
    case "instagram":
      return `https://instagram.com/${value.replace("@", "")}`;
    case "facebook":
      return `https://facebook.com/${value}`;
    case "linkedin":
      return `https://linkedin.com/in/${value}`;
    case "x":
      return `https://x.com/${value.replace("@", "")}`;
    case "snapchat":
      return `https://snapchat.com/add/${value}`;
    case "tiktok":
      return `https://tiktok.com/@${value.replace("@", "")}`;
    case "github":
      return `https://github.com/${value}`;
    case "website":
      return value.startsWith("http") ? value : `https://${value}`;
    default:
      // For custom links, assume value is a full URL
      return value.startsWith("http") ? value : `https://${value}`;
  }
}

export function SocialIcon({ fieldType, value, onPress }: SocialIconProps) {
  const icon = iconMap[fieldType] || fieldType.substring(0, 2).toUpperCase();

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    const url = buildUrl(fieldType, value);
    if (!url) return;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", `Cannot open ${fieldType}`);
      }
    } catch (error) {
      console.error(`Failed to open ${fieldType}:`, error);
      Alert.alert("Error", `Failed to open ${fieldType}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    marginVertical: 8,
  },
  icon: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default SocialIcon;
