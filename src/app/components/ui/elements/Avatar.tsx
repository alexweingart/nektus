import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLoading?: boolean;
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
  isLoading = false
}) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);
  const sizeClass = sizeClasses[size];

  React.useEffect(() => {
    setHasError(false); // Reset error state when src changes
    setImgSrc(src);

    // Preload image for faster loading
    if (src && size === 'lg') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [src, size]);

  const handleError = () => {
    console.log('[Avatar] Image failed to load:', imgSrc);
    setHasError(true);
  };

  // Show empty skeleton while loading
  if (isLoading) {
    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className} bg-white/20 animate-pulse`} />
    );
  }

  // Show initials fallback if no image or image failed to load
  if (!imgSrc || hasError) {
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
