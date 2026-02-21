import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  sizeNumeric?: number; // Exact pixel size (overrides size prop)
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
  sizeNumeric,
  className = '',
  isLoading = false,
  showInitials: _showInitials = false,
  profileColors
}) => {
  const [hasError, setHasError] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const sizeClass = sizeNumeric ? '' : sizeClasses[size];

  // Generate gradient style from profile colors
  const getGradientStyle = React.useCallback(() => {
    if (!profileColors || profileColors.length < 3) return null;
    const [dominant, accent1] = profileColors;
    return {
      background: `radial-gradient(circle, ${dominant} 0%, ${accent1} 100%)`,
    };
  }, [profileColors]);

  const gradientStyle = getGradientStyle();

  // Reset loaded/error state when src changes
  React.useEffect(() => {
    setImageLoaded(false);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
  };

  const handleLoad = () => {
    setImageLoaded(true);
  };

  const initials = getInitials(alt);
  const fontSize = sizeNumeric
    ? undefined
    : size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';
  const fontSizeStyle = sizeNumeric ? { fontSize: Math.round(sizeNumeric * 0.375) } : undefined;

  // Initials display (used for explicit showInitials or error fallback)
  const InitialsDisplay = () => (
    <div
      className={`absolute inset-0 ${!gradientStyle ? 'bg-nekt-gradient' : ''} flex items-center justify-center`}
      style={gradientStyle ? { background: gradientStyle.background } : undefined}
    >
      <span
        className={`${fontSize || ''} font-bold`}
        style={{ color: '#FFFFFF', ...fontSizeStyle }}
      >
        {initials}
      </span>
    </div>
  );

  // Determine what overlay to show while image isn't ready
  const hasValidSrc = !!src && !hasError;
  const showSkeleton = isLoading || (hasValidSrc && !imageLoaded);
  const showInitialsOverlay = !hasValidSrc && !isLoading;

  return (
    <div
      className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}
      style={sizeNumeric ? { width: sizeNumeric, height: sizeNumeric } : undefined}
    >
      {/* Always render Image in DOM when we have src, so onLoad can fire */}
      {src && !hasError && (
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={size === 'lg' || !!sizeNumeric}
          className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onError={handleError}
          onLoad={handleLoad}
          unoptimized={src?.startsWith('data:') || src?.includes('firebasestorage.app')}
        />
      )}

      {/* Skeleton: show while loading profile data or waiting for image to download */}
      {showSkeleton && (
        <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
      )}

      {/* Initials: only show for explicit showInitials (Google) or image load error */}
      {showInitialsOverlay && <InitialsDisplay />}
    </div>
  );
};

export default Avatar;
