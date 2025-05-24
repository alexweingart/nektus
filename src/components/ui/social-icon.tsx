import React from "react";
import { cn } from "@/lib/utils";
import { 
  FaWhatsapp, 
  FaTelegram, 
  FaFacebook, 
  FaInstagram, 
  FaTwitter, 
  FaSnapchat, 
  FaLinkedin, 
  FaPhone,
  FaEnvelope,
} from 'react-icons/fa';

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'email' | 'phone';

export interface SocialIconProps {
  platform: SocialPlatform;
  status?: 'confirmed' | 'autofilled' | 'empty';
  onClick?: () => void;
  size?: number;
  className?: string;
}

export function SocialIcon({
  platform,
  status = 'empty',
  onClick,
  size = 20,
  className
}: SocialIconProps) {
  // Get the icon component for a social platform
  const Icon = React.useMemo(() => {
    switch (platform) {
      case 'facebook':
        return FaFacebook;
      case 'instagram':
        return FaInstagram;
      case 'twitter':
        return FaTwitter;
      case 'snapchat':
        return FaSnapchat;
      case 'linkedin':
        return FaLinkedin;
      case 'whatsapp':
        return FaWhatsapp;
      case 'telegram':
        return FaTelegram;
      case 'email':
        return FaEnvelope;
      case 'phone':
        return FaPhone;
      default:
        return FaEnvelope;
    }
  }, [platform]);

  // Set appropriate colors based on status
  const statusClasses = React.useMemo(() => {
    switch (status) {
      case 'confirmed':
        return "bg-primary text-white";
      case 'autofilled':
        return "bg-primary-light text-white";
      case 'empty':
      default:
        return "bg-muted text-primary";
    }
  }, [status]);

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "w-10 h-10 cursor-pointer transition-all duration-200",
        statusClasses,
        className
      )}
      onClick={onClick}
    >
      <Icon size={size} />
    </div>
  );
}
