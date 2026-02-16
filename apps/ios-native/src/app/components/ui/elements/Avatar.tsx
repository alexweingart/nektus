import React from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { BRAND_LIGHT_GREEN, BRAND_DARK_GREEN, TEXT_BLACK } from '../../../../shared/colors';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  sizeNumeric?: number; // Override preset size with exact pixel value
  isLoading?: boolean;
  showInitials?: boolean; // Explicitly control when to show initials
  profileColors?: [string, string, string]; // [dominant, accent1, accent2] from generateProfileColors
}

const sizeMap = {
  sm: 64,  // w-16 h-16
  md: 96,  // w-24 h-24
  lg: 128, // w-32 h-32
};

const fontSizeMap = {
  sm: 24,
  md: 36,
  lg: 48,
};

/**
 * Extract initials from a name string
 */
const getInitials = (name: string): string => {
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  // Take first letter of first and last word
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Profile',
  size = 'md',
  sizeNumeric,
  isLoading = false,
  showInitials = false,
  profileColors,
}) => {
  // Derive gradient and text colors from profileColors or fall back to brand green
  // Radial gradient: center = dominant (dark), edge = accent1 (lighter) - matches web
  const gradientCenter = profileColors ? profileColors[0] : BRAND_DARK_GREEN;
  const gradientEdge = profileColors ? profileColors[1] : BRAND_LIGHT_GREEN;
  const initialsColor = profileColors ? profileColors[2] : TEXT_BLACK;  // accent2 or dark teal
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);

  // Debug logging
  React.useEffect(() => {
    console.log('[Avatar] Props changed:', { src: src?.substring(0, 80), showInitials, isLoading, hasError, imgSrc: imgSrc?.substring(0, 80) });
  }, [src, showInitials, isLoading, hasError, imgSrc]);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [previouslyShowedInitials, setPreviouslyShowedInitials] = React.useState(false);

  const fadeAnimInitials = React.useRef(new Animated.Value(1)).current;
  const fadeAnimImage = React.useRef(new Animated.Value(0)).current;

  const dimension = sizeNumeric ?? sizeMap[size];
  const fontSize = sizeNumeric ? Math.round(sizeNumeric * 0.375) : fontSizeMap[size];

  // Radial gradient background for initials (matches web's radial-gradient(circle, dominant, accent1))
  const renderRadialGradientBackground = (dim: number) => (
    <Svg width={dim} height={dim} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgRadialGradient id="avatarGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={gradientCenter} stopOpacity="1" />
          <Stop offset="100%" stopColor={gradientEdge} stopOpacity="1" />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width={dim} height={dim} fill="url(#avatarGrad)" />
    </Svg>
  );

  React.useEffect(() => {
    // Only react to src changes, not hasError changes (prevents infinite loop)
    if (src === imgSrc) return;

    // Track if we're transitioning from initials to image
    const wasShowingInitials = previouslyShowedInitials && !imgSrc;
    const willShowImage = src && !hasError;

    // If transitioning from initials to image, trigger crossfade
    if (wasShowingInitials && willShowImage) {
      setIsTransitioning(true);

      // Set new image immediately (will fade in)
      setImgSrc(src);
      setHasError(false);

      // Start crossfade animation
      Animated.parallel([
        Animated.timing(fadeAnimInitials, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimImage, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsTransitioning(false);
        setPreviouslyShowedInitials(false);
      });
    } else {
      // Normal image change (no transition)
      setHasError(false);
      setImgSrc(src);
      fadeAnimInitials.setValue(1);
      fadeAnimImage.setValue(0);
    }
  }, [src]); // Only depend on src to prevent infinite loops

  // Track when we start showing initials
  React.useEffect(() => {
    if (showInitials && !src) {
      setPreviouslyShowedInitials(true);
    }
  }, [showInitials, src]);

  const handleError = () => {
    console.log('[Avatar] Image failed to load:', imgSrc?.substring(0, 80));
    setHasError(true);
  };

  // Show empty skeleton while loading OR waiting to determine if we should show initials
  if (isLoading || (!imgSrc && !showInitials && !hasError)) {
    return (
      <View style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
        }
      ]} />
    );
  }

  const initials = getInitials(alt);

  // Show our custom initials if explicitly told to (Google had initials, not real photo)
  if (showInitials && !imgSrc && !isTransitioning) {
    return (
      <View style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        }
      ]}>
        {renderRadialGradientBackground(dimension)}
        <View style={[styles.initialsContainer, { width: dimension, height: dimension }]}>
          <Text style={[styles.initialsText, { fontSize, color: initialsColor }]}>
            {initials}
          </Text>
        </View>
      </View>
    );
  }

  // Show initials if image failed to load
  if (hasError && !isTransitioning) {
    return (
      <View style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        }
      ]}>
        {renderRadialGradientBackground(dimension)}
        <View style={[styles.initialsContainer, { width: dimension, height: dimension }]}>
          <Text style={[styles.initialsText, { fontSize, color: initialsColor }]}>
            {initials}
          </Text>
        </View>
      </View>
    );
  }

  // During transition, show both initials (fading out) and image (fading in)
  if (isTransitioning) {
    return (
      <View style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        }
      ]}>
        {/* Initials fading out */}
        <Animated.View style={[
          StyleSheet.absoluteFill,
          { opacity: fadeAnimInitials }
        ]}>
          {renderRadialGradientBackground(dimension)}
          <View style={[styles.initialsContainer, { width: dimension, height: dimension }]}>
            <Text style={[styles.initialsText, { fontSize, color: initialsColor }]}>
              {initials}
            </Text>
          </View>
        </Animated.View>

        {/* Image fading in */}
        {imgSrc && (
          <Animated.View style={[
            StyleSheet.absoluteFill,
            { opacity: fadeAnimImage }
          ]}>
            <Image
              source={{ uri: imgSrc }}
              style={[
                styles.image,
                {
                  width: dimension,
                  height: dimension,
                  borderRadius: dimension / 2,
                }
              ]}
              onError={handleError}
            />
          </Animated.View>
        )}
      </View>
    );
  }

  // If we get here without imgSrc, show initials fallback
  if (!imgSrc) {
    return (
      <View style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        }
      ]}>
        {renderRadialGradientBackground(dimension)}
        <View style={[styles.initialsContainer, { width: dimension, height: dimension }]}>
          <Text style={[styles.initialsText, { fontSize, color: initialsColor }]}>
            {initials}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
      }
    ]}>
      <Image
        key={imgSrc} // Force remount when image URL changes
        source={{ uri: imgSrc }}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          }
        ]}
        onError={handleError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontWeight: '600',
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;
