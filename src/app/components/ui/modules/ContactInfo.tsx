/**
 * ContactInfo component - Read-only display of contact profile information
 * Similar to ProfileInfo but without Personal/Work switching and editing capabilities
 */

'use client';

import React from 'react';
import Avatar from '../elements/Avatar';
import SocialIconsList from '../elements/SocialIconsList';
import ReactMarkdown from 'react-markdown';
import { Text } from '../Typography';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/lib/client/profile/transforms';

interface ContactInfoProps {
  profile: UserProfile;
  bioContent: string;
  markdownComponents?: {
    p: (props: React.ComponentProps<'p'>) => React.ReactElement;
    a: (props: React.ComponentProps<'a'>) => React.ReactElement;
  };
}

export const ContactInfo: React.FC<ContactInfoProps> = ({
  profile,
  bioContent,
  markdownComponents
}) => {
  const defaultMarkdownComponents = {
    p: (props: React.ComponentProps<'p'>) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
    a: (props: React.ComponentProps<'a'>) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Profile Image */}
      <div className="mb-4">
        <div className="border-4 border-white shadow-lg rounded-full">
          <Avatar
            src={profile.profileImage}
            alt={getFieldValue(profile.contactEntries, 'name') || 'Contact'}
            size="lg"
          />
        </div>
      </div>

      {/* Content with blur background */}
      <div className="w-full bg-black/60 backdrop-blur-lg px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
        {/* Name */}
        <div className="text-center mb-4">
          <h1 className="text-white text-2xl font-bold">{getFieldValue(profile.contactEntries, 'name') || 'Anonymous'}</h1>
        </div>

        {/* Bio */}
        <div className="text-center mb-6">
          <div className="text-white text-sm leading-relaxed">
            <ReactMarkdown components={markdownComponents || defaultMarkdownComponents}>
              {bioContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Social Media Icons */}
        <div className="w-full mb-4 text-center">
          {profile.contactEntries && (
            <SocialIconsList
              contactEntries={profile.contactEntries}
              size="md"
              variant="white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
