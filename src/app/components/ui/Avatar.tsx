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
    setImgSrc(src);
  }, [src]);

  return (
    <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}>
      <div className="absolute inset-0 bg-gray-100 rounded-full">
        <div className="w-full h-full flex items-center justify-center">
          <Image
            src={imgSrc || '/default-avatar.png'}
            alt={alt}
            fill
            className="object-cover"
            onError={() => setImgSrc('/default-avatar.png')}
            unoptimized={imgSrc?.startsWith('data:')}
          />
        </div>
      </div>
    </div>
  );
};

export default Avatar;
