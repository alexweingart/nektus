import React from "react";
import { Alert, Text } from "react-native";
import { Button } from "../inputs/Button";

interface ExchangeButtonProps {
  onPress?: () => void;
}

export function ExchangeButton({ onPress }: ExchangeButtonProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Placeholder - contact exchange not yet implemented in iOS
      Alert.alert(
        "Coming Soon",
        "Contact exchange feature is coming to iOS soon!",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <Button
      variant="white"
      size="xl"
      onPress={handlePress}
      style={{ width: "100%" }}
    >
      <Text style={{ fontSize: 20, fontWeight: "600", color: "#374151" }}>
        Nekt
      </Text>
    </Button>
  );
}

export default ExchangeButton;
