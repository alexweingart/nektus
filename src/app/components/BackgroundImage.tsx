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
  const [loaded, setLoaded] = useState<boolean>(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  
  // Debug log when component renders
  console.log('BackgroundImage component rendering with props:', { 
    imageUrl: imageUrl || '[none]',
    hasBackgroundImage: !!backgroundImage,
    loaded
  });
  
  // Preload the image to avoid flickering
  useEffect(() => {
    console.log('BackgroundImage effect triggered with imageUrl:', imageUrl || '[none]');
    
    if (!imageUrl) {
      console.log('No image URL provided, using fallback color');
      setLoaded(true);
      setBackgroundImage(null);
      return;
    }
    
    // Reset loaded state when imageUrl changes
    setLoaded(false);
    
    console.log('Loading background image:', imageUrl);
    const img = new Image();
    
    img.onload = () => {
      console.log('Background image loaded successfully:', imageUrl);
      setBackgroundImage(imageUrl);
      setLoaded(true);
    };
    
    img.onerror = () => {
      console.error('Failed to load background image:', imageUrl);
      setBackgroundImage(null);
      setLoaded(true);
    };
    
    // Assign the src after setting up handlers
    img.src = imageUrl;
  }, [imageUrl]);
  
  return (
    <div 
      className="fixed top-0 left-0 w-full h-full z-[-1] transition-opacity duration-500"
      style={{
        ...(backgroundImage ? { 
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: loaded ? 1 : 0
        } : { 
          backgroundColor: fallbackColor,
          opacity: 1
        }),
        pointerEvents: 'none' // Ensure it doesn't interfere with clicks
      }}
    />
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(BackgroundImage);
