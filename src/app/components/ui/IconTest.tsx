'use client';

import React from 'react';
import SocialIcon from './SocialIcon';

export default function IconTest() {
  const platforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'] as const;
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Icon Test</h2>
      <div className="grid grid-cols-2 gap-4">
        {platforms.map(platform => (
          <div key={platform} className="flex items-center p-2 border rounded">
            <div className="w-8 h-8 flex items-center justify-center mr-2">
              <SocialIcon platform={platform} size="sm" />
            </div>
            <span>{platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
