import React from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  showInitials?: boolean; // Explicitly control when to show initials
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
  isLoading = false,
  showInitials = false
}) => {
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

  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];

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
        <LinearGradient
          colors={['#E7FED2', '#71E454']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.initialsContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            }
          ]}
        >
          <Text style={[styles.initialsText, { fontSize, color: '#004D40' }]}>
            {initials}
          </Text>
        </LinearGradient>
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
        <LinearGradient
          colors={['#E7FED2', '#71E454']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.initialsContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            }
          ]}
        >
          <Text style={[styles.initialsText, { fontSize, color: '#004D40' }]}>
            {initials}
          </Text>
        </LinearGradient>
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
          <LinearGradient
            colors={['#E7FED2', '#71E454']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.initialsContainer,
              {
                width: dimension,
                height: dimension,
                borderRadius: dimension / 2,
              }
            ]}
          >
            <Text style={[styles.initialsText, { fontSize, color: '#004D40' }]}>
              {initials}
            </Text>
          </LinearGradient>
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
        <LinearGradient
          colors={['#E7FED2', '#71E454']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.initialsContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            }
          ]}
        >
          <Text style={[styles.initialsText, { fontSize, color: '#004D40' }]}>
            {initials}
          </Text>
        </LinearGradient>
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
