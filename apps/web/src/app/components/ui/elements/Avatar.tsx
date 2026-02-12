import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLoading?: boolean;
  showInitials?: boolean; // Explicitly control when to show initials
  profileColors?: string[]; // [dominant, accent1, accent2] for custom gradient
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
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
  className = '',
  isLoading = false,
  showInitials = false,
  profileColors
}) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [previouslyShowedInitials, setPreviouslyShowedInitials] = React.useState(false);
  const sizeClass = sizeClasses[size];

  // Generate gradient style from profile colors
  // Radial gradient: dominant (dark center) → accent1 (light edge), text in accent2
  const getGradientStyle = React.useCallback(() => {
    if (!profileColors || profileColors.length < 3) return null;
    const [dominant, accent1, accent2] = profileColors;
    return {
      background: `radial-gradient(circle, ${dominant} 0%, ${accent1} 100%)`,
      textColor: accent2
    };
  }, [profileColors]);

  const gradientStyle = getGradientStyle();

  React.useEffect(() => {
    // Track if we're transitioning from initials to image
    const wasShowingInitials = previouslyShowedInitials && !imgSrc;
    const willShowImage = src && !hasError;

    // If transitioning from initials to image, trigger crossfade
    if (wasShowingInitials && willShowImage) {
      setIsTransitioning(true);

      // Set new image immediately (will fade in)
      setImgSrc(src);
      setHasError(false);

      // Clear transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setPreviouslyShowedInitials(false);
      }, 1000); // 1 second crossfade
    } else {
      // Normal image change (no transition)
      setHasError(false);
      setImgSrc(src);
    }
  }, [src, hasError, previouslyShowedInitials, showInitials, isLoading, imgSrc]);

  // Track when we start showing initials
  React.useEffect(() => {
    if (showInitials && !src) {
      setPreviouslyShowedInitials(true);
    }
  }, [showInitials, src]);

  const handleError = () => {
    setHasError(true);
  };

  // Show skeleton while loading OR waiting to determine if we should show initials
  // If we have a name, show initials inside the pulse so it's not a blank circle
  if (isLoading || (!imgSrc && !showInitials && !hasError)) {
    const initials = alt && alt !== 'Profile' ? getInitials(alt) : null;
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div
        className={`relative rounded-full overflow-hidden ${sizeClass} ${className} ${initials && gradientStyle ? '' : 'bg-white/20'} animate-pulse flex items-center justify-center`}
        style={initials && gradientStyle ? { background: gradientStyle.background } : undefined}
      >
        {initials && (
          <span
            className={`${fontSize} font-semibold`}
            style={{ color: gradientStyle?.textColor || 'rgba(255,255,255,0.6)' }}
          >
            {initials}
          </span>
        )}
      </div>
    );
  }

  // Show our custom initials if explicitly told to (Google had initials, not real photo)
  if (showInitials && !imgSrc && !isTransitioning) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div
        className={`relative rounded-full overflow-hidden ${sizeClass} ${className} ${!gradientStyle ? 'bg-nekt-gradient' : ''} flex items-center justify-center`}
        style={gradientStyle ? { background: gradientStyle.background } : undefined}
      >
        <span
          className={`${fontSize} font-semibold`}
          style={{ color: gradientStyle?.textColor || '#004D40' }}
        >
          {initials}
        </span>
      </div>
    );
  }

  // Show initials if image failed to load
  if (hasError && !isTransitioning) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div
        className={`relative rounded-full overflow-hidden ${sizeClass} ${className} ${!gradientStyle ? 'bg-nekt-gradient' : ''} flex items-center justify-center`}
        style={gradientStyle ? { background: gradientStyle.background } : undefined}
      >
        <span
          className={`${fontSize} font-semibold`}
          style={{ color: gradientStyle?.textColor || '#004D40' }}
        >
          {initials}
        </span>
      </div>
    );
  }

  // During transition, show both initials (fading out) and image (fading in)
  if (isTransitioning) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}>
        {/* Initials fading out - start visible, fade to invisible */}
        <div
          className={`absolute inset-0 ${!gradientStyle ? 'bg-nekt-gradient' : ''} flex items-center justify-center opacity-100 animate-[fade-out_1000ms_ease-out_forwards]`}
          style={gradientStyle ? { background: gradientStyle.background } : undefined}
        >
          <span
            className={`${fontSize} font-semibold`}
            style={{ color: gradientStyle?.textColor || '#004D40' }}
          >
            {initials}
          </span>
        </div>
        {/* Image fading in - start invisible, fade to visible */}
        {imgSrc && (
          <div className="absolute inset-0 opacity-0 animate-[fade-in_1000ms_ease-out_forwards]">
            <Image
              src={imgSrc}
              alt={alt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={size === 'lg'}
              className="object-cover"
              onError={handleError}
              unoptimized={imgSrc?.startsWith('data:') || imgSrc?.includes('firebasestorage.app')}
            />
          </div>
        )}
      </div>
    );
  }

  // If we get here without imgSrc, show initials fallback
  if (!imgSrc) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div
        className={`relative rounded-full overflow-hidden ${sizeClass} ${className} ${!gradientStyle ? 'bg-nekt-gradient' : ''} flex items-center justify-center`}
        style={gradientStyle ? { background: gradientStyle.background } : undefined}
      >
        <span
          className={`${fontSize} font-semibold`}
          style={{ color: gradientStyle?.textColor || '#004D40' }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}>
      <Image
        key={imgSrc} // Force remount when image URL changes
        src={imgSrc}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={size === 'lg'}
        className="object-cover"
        onError={handleError}
        unoptimized={imgSrc?.startsWith('data:') || imgSrc?.includes('firebasestorage.app')}
      />
    </div>
  );
};

export default Avatar;
