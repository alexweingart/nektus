import React from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { ANIMATION } from '@nektus/shared-client';
import { BRAND_LIGHT_GREEN, BRAND_DARK_GREEN } from '../../../../shared/colors';
import { fontStyles } from '../Typography';

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

const CROSSFADE_MS = ANIMATION.CINEMATIC_MS;

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Profile',
  size = 'md',
  sizeNumeric,
  isLoading = false,
  showInitials = false,
  profileColors,
}) => {
  const gradientCenter = profileColors ? profileColors[0] : BRAND_DARK_GREEN;
  const gradientEdge = profileColors ? profileColors[1] : BRAND_LIGHT_GREEN;
  const initialsColor = '#FFFFFF';

  // Current displayed image and the outgoing one (during crossfade)
  const [displayedSrc, setDisplayedSrc] = React.useState(src);
  const [outgoingSrc, setOutgoingSrc] = React.useState<string | undefined>(undefined);
  const [hasError, setHasError] = React.useState(false);

  // Initials → image transition state
  const [isInitialsTransition, setIsInitialsTransition] = React.useState(false);
  const [previouslyShowedInitials, setPreviouslyShowedInitials] = React.useState(false);

  const fadeAnimInitials = React.useRef(new Animated.Value(1)).current;
  const fadeAnimImage = React.useRef(new Animated.Value(0)).current;
  // New image opacity for image→image crossfade (driven by onLoad)
  const crossfadeOpacity = React.useRef(new Animated.Value(1)).current;

  // Track pending src so we can render it hidden and wait for onLoad
  const [pendingSrc, setPendingSrc] = React.useState<string | undefined>(undefined);

  const dimension = sizeNumeric ?? sizeMap[size];
  const fontSize = sizeNumeric ? Math.round(sizeNumeric * 0.375) : fontSizeMap[size];

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

  // Handle src prop changes
  React.useEffect(() => {
    if (src === displayedSrc && !pendingSrc) return;
    if (src === pendingSrc) return; // Already waiting for this one

    const wasShowingInitials = previouslyShowedInitials && !displayedSrc;
    const willShowImage = !!src;
    const hadImage = !!displayedSrc;

    if (wasShowingInitials && willShowImage) {
      // Initials → image crossfade (immediate, no onLoad wait needed for first image)
      setIsInitialsTransition(true);
      setDisplayedSrc(src);
      setHasError(false);

      Animated.parallel([
        Animated.timing(fadeAnimInitials, {
          toValue: 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimImage, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsInitialsTransition(false);
        setPreviouslyShowedInitials(false);
      });
    } else if (hadImage && willShowImage && src !== displayedSrc) {
      // Image → image: stage the new src as pending, wait for onLoad to crossfade
      setPendingSrc(src);
      setHasError(false);
    } else {
      // Direct swap (no animation)
      setHasError(false);
      setDisplayedSrc(src);
      setPendingSrc(undefined);
      fadeAnimInitials.setValue(1);
      fadeAnimImage.setValue(0);
      crossfadeOpacity.setValue(1);
    }
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when the pending (new) image finishes loading — start the crossfade
  const handlePendingLoad = React.useCallback(() => {
    if (!pendingSrc) return;
    // Swap: current becomes outgoing, pending becomes displayed
    setOutgoingSrc(displayedSrc);
    setDisplayedSrc(pendingSrc);
    setPendingSrc(undefined);
    crossfadeOpacity.setValue(0);

    Animated.timing(crossfadeOpacity, {
      toValue: 1,
      duration: CROSSFADE_MS,
      useNativeDriver: true,
    }).start(() => {
      setOutgoingSrc(undefined);
    });
  }, [pendingSrc, displayedSrc, crossfadeOpacity]);

  // Track when we start showing initials
  React.useEffect(() => {
    if (showInitials && !src) {
      setPreviouslyShowedInitials(true);
    }
  }, [showInitials, src]);

  const handleError = () => {
    console.log('[Avatar] Image failed to load:', displayedSrc?.substring(0, 80));
    setHasError(true);
  };

  // ── Render helpers ──

  if (isLoading || (!displayedSrc && !showInitials && !hasError && !pendingSrc)) {
    return (
      <View style={[
        styles.container,
        { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: 'rgba(255, 255, 255, 0.2)' }
      ]} />
    );
  }

  const initials = getInitials(alt);

  const imageStyle = [
    styles.image,
    { width: dimension, height: dimension, borderRadius: dimension / 2 },
  ];

  const containerStyle = [
    styles.container,
    { width: dimension, height: dimension, borderRadius: dimension / 2 },
  ];

  const renderInitials = () => (
    <>
      {renderRadialGradientBackground(dimension)}
      <View style={[styles.initialsContainer, { width: dimension, height: dimension }]}>
        <Text style={[styles.initialsText, { fontSize, color: initialsColor }]}>
          {initials}
        </Text>
      </View>
    </>
  );

  // Show initials (no image, no transition)
  if ((showInitials || hasError) && !displayedSrc && !isInitialsTransition) {
    return <View style={containerStyle}>{renderInitials()}</View>;
  }

  // Initials → image transition
  if (isInitialsTransition) {
    return (
      <View style={containerStyle}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnimInitials }]}>
          {renderInitials()}
        </Animated.View>
        {displayedSrc && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnimImage }]}>
            <Image source={{ uri: displayedSrc }} style={imageStyle} onError={handleError} />
          </Animated.View>
        )}
      </View>
    );
  }

  // No image at all — initials fallback
  if (!displayedSrc) {
    return <View style={containerStyle}>{renderInitials()}</View>;
  }

  // Normal image display (possibly with crossfade layers)
  return (
    <View style={containerStyle}>
      {/* Outgoing image (full opacity, behind new image during crossfade) */}
      {outgoingSrc && (
        <Image source={{ uri: outgoingSrc }} style={[StyleSheet.absoluteFill as any, ...imageStyle]} />
      )}

      {/* Current image */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: outgoingSrc ? crossfadeOpacity : 1 }]}>
        <Image source={{ uri: displayedSrc }} style={imageStyle} onError={handleError} />
      </Animated.View>

      {/* Hidden pending image — just for triggering onLoad */}
      {pendingSrc && (
        <Image
          source={{ uri: pendingSrc }}
          style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
          onLoad={handlePendingLoad}
        />
      )}
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
    ...fontStyles.bold,
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;
