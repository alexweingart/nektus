import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
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
  className = ''
}) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);
  const sizeClass = sizeClasses[size];

  React.useEffect(() => {
    setHasError(false); // Reset error state when src changes

    // For Firebase Storage URLs, add cache-busting to ensure fresh images
    if (src && src.includes('firebasestorage.app')) {
      const cacheBustingUrl = src.includes('?')
        ? `${src}&cb=${Date.now()}`
        : `${src}?cb=${Date.now()}`;
      setImgSrc(cacheBustingUrl);
    } else {
      setImgSrc(src);
    }
  }, [src]);

  const handleError = () => {
    console.log('[Avatar] Image failed to load:', imgSrc);
    setHasError(true);
  };

  // Show initials fallback if no image or image failed to load
  if (!imgSrc || hasError) {
    const initials = getInitials(alt);
    const fontSize = size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl';

    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className} bg-gradient-to-br from-emerald-400 to-[#004D40] flex items-center justify-center`}>
        <span className={`${fontSize} font-semibold text-white`}>
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
