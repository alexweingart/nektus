import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Image,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getInitials } from "@nektus/shared-utils";

// Nekt brand colors
const NEKT_COLORS = {
  gradientStart: "#E7FED2", // Pale cream/green
  gradientEnd: "#71E454", // Bright lime green
  textOnGradient: "#004D40", // Dark teal
  brandGreen: "#4ade80",
};

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  showInitials?: boolean;
}

const sizeMap = {
  sm: 64,
  md: 96,
  lg: 128,
};

const fontSizeMap = {
  sm: 24,
  md: 36,
  lg: 48,
};

export function Avatar({
  src,
  alt = "Profile",
  size = "md",
  isLoading = false,
  showInitials = false,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];

  // Reset states when src changes
  useEffect(() => {
    setHasError(false);
    setImageLoaded(false);
    fadeAnim.setValue(0);
  }, [src, fadeAnim]);

  // Fade in animation when image loads
  useEffect(() => {
    if (imageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [imageLoaded, fadeAnim]);

  const handleError = () => {
    setHasError(true);
  };

  const handleLoad = () => {
    setImageLoaded(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
        ]}
      >
        <ActivityIndicator size="small" color="#4ade80" />
      </View>
    );
  }

  const initials = getInitials(alt);

  // Show initials if: explicitly requested, no src, or error loading image
  const shouldShowInitials = showInitials || !src || hasError;

  if (shouldShowInitials) {
    return (
      <View
        style={[
          styles.container,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
        ]}
      >
        <LinearGradient
          colors={[NEKT_COLORS.gradientStart, NEKT_COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.initialsContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
        >
          <Text
            style={[
              styles.initialsText,
              { fontSize, color: NEKT_COLORS.textOnGradient },
            ]}
          >
            {initials}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Show image with fade-in effect
  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
      ]}
    >
      {/* Initials underneath for fallback during load */}
      <LinearGradient
        colors={[NEKT_COLORS.gradientStart, NEKT_COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.initialsContainer,
          StyleSheet.absoluteFill,
          { borderRadius: dimension / 2 },
        ]}
      >
        <Text
          style={[
            styles.initialsText,
            { fontSize, color: NEKT_COLORS.textOnGradient },
          ]}
        >
          {initials}
        </Text>
      </LinearGradient>

      {/* Image on top with fade-in */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
      >
        <Image
          source={{ uri: src }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
          onError={handleError}
          onLoad={handleLoad}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
  },
  initialsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  initialsText: {
    fontWeight: "600",
  },
  image: {
    resizeMode: "cover",
  },
});

export default Avatar;
