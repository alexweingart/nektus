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

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  alt = 'Profile',
  size = 'md',
  className = '' 
}) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const sizeClass = sizeClasses[size];

  React.useEffect(() => {
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

  return (
    <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}>
      <Image
        key={imgSrc} // Force remount when image URL changes
        src={imgSrc || '/default-avatar.png'}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={size === 'lg'}
        className="object-cover"
        onError={() => setImgSrc('/default-avatar.png')}
        unoptimized={imgSrc?.startsWith('data:') || imgSrc?.includes('firebasestorage.app')}
      />
    </div>
  );
};

export default Avatar;
