import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLoading?: boolean;
  showInitials?: boolean; // Explicitly control when to show initials
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
  showInitials = false
}) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [previouslyShowedInitials, setPreviouslyShowedInitials] = React.useState(false);
  const sizeClass = sizeClasses[size];

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
      }, 3000); // 3 seconds for visibility
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

  // Show empty skeleton while loading OR waiting to determine if we should show initials
  if (isLoading || (!imgSrc && !showInitials && !hasError)) {
    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className} bg-white/20 animate-pulse`} />
    );
  }

  // Show our custom initials if explicitly told to (Google had initials, not real photo)
  if (showInitials && !imgSrc && !isTransitioning) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className} bg-nekt-gradient flex items-center justify-center`}>
        <span className={`${fontSize} font-semibold`} style={{ color: '#004D40' }}>
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
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className} bg-nekt-gradient flex items-center justify-center`}>
        <span className={`${fontSize} font-semibold`} style={{ color: '#004D40' }}>
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
        <div className="absolute inset-0 bg-nekt-gradient flex items-center justify-center transition-opacity duration-[3000ms] opacity-100 animate-[fadeOut_3000ms_ease-out_forwards]">
          <span className={`${fontSize} font-semibold`} style={{ color: '#004D40' }}>
            {initials}
          </span>
        </div>
        {/* Image fading in - start invisible, fade to visible */}
        {imgSrc && (
          <div className="absolute inset-0 opacity-0 animate-[fadeIn_3000ms_ease-out_forwards]">
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
