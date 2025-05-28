'use client';

import React, { memo, useState, useEffect } from 'react';

interface BackgroundImageProps {
  imageUrl?: string;
  fallbackColor?: string;
}

const BackgroundImage: React.FC<BackgroundImageProps> = ({ 
  imageUrl, 
  fallbackColor = '#f4f9f4'
}) => {
  const [loaded, setLoaded] = useState<boolean>(!!imageUrl);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  
  // Preload the image to avoid flickering
  useEffect(() => {
    if (!imageUrl) {
      setLoaded(true);
      setBackgroundImage(null);
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      setBackgroundImage(imageUrl);
      setLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load background image:', imageUrl);
      setBackgroundImage(null);
      setLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);
  
  return (
    <div 
      className="fixed top-0 left-0 w-full h-full -z-10 transition-opacity duration-500"
      style={{
        ...(backgroundImage ? { 
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 1
        } : { 
          backgroundColor: fallbackColor,
          opacity: 1
        }),
      }}
    />
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(BackgroundImage);
