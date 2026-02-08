import React from 'react';
import { View, StyleSheet, Linking, Alert, Image } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

// Custom X logo component (formerly Twitter)
const XIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
);

interface SocialIconProps {
  platform: string;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
  onPress?: () => void;
  disabled?: boolean;
  customIcon?: string;
  linkType?: 'default' | 'custom';
}

const SocialIcon: React.FC<SocialIconProps> = ({
  platform,
  username,
  size = 'md',
  variant = 'default',
  onPress,
  disabled = false,
  customIcon,
  linkType
}) => {

  // Web version has padding that reduces icon size:
  // sm: w-6 h-6 (24px container, 24px icon, no padding)
  // md: w-10 h-10 p-2 (40px container, 24px icon, 8px padding each side)
  // lg: w-16 h-16 p-3 (64px container, 40px icon, 12px padding each side)
  const containerSize = size === 'sm' ? 24 : size === 'lg' ? 64 : 40;
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 40 : 24;
  const color = variant === 'white' ? '#ffffff' : '#ffffff';

  // Generate platform URL based on username
  const getPlatformUrl = (platform: string, username: string): string | null => {
    if (!username) return null;

    const usernameFormatted = username.startsWith('@') ? username.substring(1) : username;

    switch (platform) {
      case 'facebook':
        return `https://facebook.com/${usernameFormatted}`;
      case 'instagram':
        return `https://instagram.com/${usernameFormatted}`;
      case 'x':
        return `https://x.com/${usernameFormatted}`;
      case 'linkedin':
        return `https://www.linkedin.com/in/${usernameFormatted}`;
      case 'snapchat':
        return `https://snapchat.com/add/${usernameFormatted}`;
      case 'whatsapp':
        return `https://wa.me/${usernameFormatted.replace(/[^0-9]/g, '')}`;
      case 'telegram':
        return `https://t.me/${usernameFormatted}`;
      case 'wechat':
        return `weixin://dl/chat?${usernameFormatted}`;
      case 'email':
        return `mailto:${usernameFormatted}`;
      case 'phone':
        return `sms:${usernameFormatted}`;
      default:
        return null;
    }
  };

  const handlePress = async () => {
    if (disabled) return;

    // If there's a custom press handler, use that
    if (onPress) {
      onPress();
      return;
    }

    // Handle custom links - username contains the full URL
    if (linkType === 'custom' && username) {
      console.log('[SocialIcon] Opening custom link:', username);
      try {
        const canOpen = await Linking.canOpenURL(username);
        if (canOpen) {
          await Linking.openURL(username);
        } else {
          Alert.alert('Error', 'Cannot open this link');
        }
      } catch (error) {
        console.error('Failed to open custom link:', error);
        Alert.alert('Error', 'Failed to open link');
      }
      return;
    }

    // Handle default platform behavior
    if (username) {
      const url = getPlatformUrl(platform, username);
      console.log(`[SocialIcon] Opening ${platform}:`, { username, url });
      if (url) {
        try {
          // For standard schemes (tel, sms, mailto, http, https), skip canOpenURL check
          // as it can sometimes fail even when the URL is valid
          const isStandardScheme = url.startsWith('tel:') ||
                                   url.startsWith('sms:') ||
                                   url.startsWith('mailto:') ||
                                   url.startsWith('http:') ||
                                   url.startsWith('https:');

          if (isStandardScheme) {
            console.log(`[SocialIcon] Opening standard scheme directly:`, url);
            await Linking.openURL(url);
            console.log(`[SocialIcon] Successfully opened ${platform}`);
          } else {
            const canOpen = await Linking.canOpenURL(url);
            console.log(`[SocialIcon] canOpenURL for ${platform}:`, canOpen);
            if (canOpen) {
              await Linking.openURL(url);
              console.log(`[SocialIcon] Successfully opened ${platform}`);
            } else {
              console.error(`[SocialIcon] Cannot open ${platform}, url:`, url);
              Alert.alert('Error', `Cannot open ${platform}`);
            }
          }
        } catch (error) {
          console.error(`Failed to open ${platform}:`, error);
          Alert.alert('Error', `Failed to open ${platform}`);
        }
      } else {
        console.error(`[SocialIcon] No URL generated for ${platform}`);
      }
    } else {
      console.error(`[SocialIcon] No username provided for ${platform}`);
    }
  };

  const iconElement = (() => {
    // Only show custom icon (favicon) for custom link types
    if (linkType === 'custom' && customIcon) {
      return (
        <Image
          source={{ uri: customIcon }}
          style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2 }}
          resizeMode="contain"
        />
      );
    }

    switch (platform) {
      case 'phone':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 512 512" fill={color}>
            <Path d="M493.4 24.6l-104-24c-11.3-2.6-22.9 3.3-27.5 13.9l-48 112c-4.2 9.8-1.4 21.3 6.9 28l60.6 49.6c-36 76.7-98.9 140.5-177.2 177.2l-49.6-60.6c-6.8-8.3-18.2-11.1-28-6.9l-112 48C3.9 366.5-2 378.1.6 389.4l24 104C27.1 504.2 36.7 512 48 512c256.1 0 464-207.5 464-464 0-11.2-7.7-20.9-18.6-23.4z" />
          </Svg>
        );
      case 'email':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 512 512" fill={color}>
            <Path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
          </Svg>
        );
      case 'facebook':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 512 512" fill={color}>
            <Path d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256h0z" />
          </Svg>
        );
      case 'instagram':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 448 512" fill={color}>
            <Path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
          </Svg>
        );
      case 'x':
        return <XIcon size={iconSize} color={color} />;
      case 'linkedin':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 448 512" fill={color}>
            <Path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z" />
          </Svg>
        );
      case 'snapchat':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 512 512" fill={color}>
            <Path d="M510.846 392.673c-5.211 12.157-27.239 21.089-67.36 27.318-2.064 2.786-3.775 14.686-6.507 23.956-1.625 5.566-5.623 8.869-12.128 8.869l-.297-.005c-9.395 0-19.203-4.323-38.852-4.323-26.521 0-35.662 6.043-56.254 20.588-21.832 15.438-42.771 28.764-74.027 27.399-31.646 2.334-58.025-16.908-72.871-27.404-20.714-14.643-29.828-20.582-56.241-20.582-18.864 0-30.736 4.72-38.852 4.72-8.073 0-11.213-4.922-12.422-9.04-2.703-9.189-4.404-21.263-6.523-24.13-20.679-3.209-67.31-11.344-68.498-32.15a10.627 10.627 0 0 1 8.877-11.069c69.583-11.455 100.924-82.901 102.227-85.934.074-.176.155-.344.237-.515 3.713-7.537 4.544-13.849 2.463-18.753-5.05-11.896-26.872-16.164-36.053-19.796-23.715-9.366-27.015-20.128-25.612-27.504 2.437-12.836 21.725-20.735 33.002-15.453 8.919 4.181 16.843 6.297 23.547 6.297 5.022 0 8.212-1.204 9.96-2.171-2.043-35.936-7.101-87.29 5.687-115.969C158.122 21.304 229.705 15.42 250.826 15.42c.944 0 9.141-.089 10.11-.089 52.148 0 102.254 26.78 126.723 81.643 12.777 28.65 7.749 79.792 5.695 116.009 1.582.872 4.357 1.942 8.599 2.139 6.397-.286 13.815-2.389 22.069-6.257 6.085-2.846 14.406-2.461 20.48.058l.029.01c9.476 3.385 15.439 10.215 15.589 17.87.184 9.747-8.522 18.165-25.878 25.018-2.118.835-4.694 1.655-7.434 2.525-9.797 3.106-24.6 7.805-28.616 17.271-2.079 4.904-1.256 11.211 2.46 18.748.087.168.166.342.239.515 1.301 3.03 32.615 74.46 102.23 85.934 6.427 1.058 11.163 7.877 7.725 15.859z" />
          </Svg>
        );
      case 'whatsapp':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 448 512" fill={color}>
            <Path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
          </Svg>
        );
      case 'telegram':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 496 512" fill={color}>
            <Path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z" />
          </Svg>
        );
      case 'wechat':
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 576 512" fill={color}>
            <Path d="M385.2 167.6c6.4 0 12.6.3 18.8 1.1C387.4 90.3 303.3 32 207.7 32 100.5 32 13 104.8 13 197.4c0 53.4 29.3 97.5 77.9 131.6l-19.3 58.6 68-34.1c24.4 4.8 43.8 9.7 68.2 9.7 6.2 0 12.1-.3 18.3-.8-4-12.9-6.2-26.6-6.2-40.8-.1-84.9 72.9-154 165.3-154zm-104.5-52.9c14.5 0 24.2 9.7 24.2 24.4 0 14.5-9.7 24.2-24.2 24.2-14.8 0-29.3-9.7-29.3-24.2.1-14.7 14.6-24.4 29.3-24.4zm-136.4 48.6c-14.5 0-29.3-9.7-29.3-24.2 0-14.8 14.8-24.4 29.3-24.4 14.8 0 24.4 9.7 24.4 24.4 0 14.6-9.6 24.2-24.4 24.2zM563 319.4c0-77.9-77.9-141.3-165.4-141.3-92.7 0-165.4 63.4-165.4 141.3S305 460.7 397.6 460.7c19.3 0 38.9-5.1 58.6-9.9l53.4 29.3-14.8-48.6C534 402.1 563 363.2 563 319.4zm-219.1-24.5c-9.7 0-19.3-9.7-19.3-19.6 0-9.7 9.7-19.3 19.3-19.3 14.8 0 24.4 9.7 24.4 19.3 0 10-9.7 19.6-24.4 19.6zm107.1 0c-9.7 0-19.3-9.7-19.3-19.6 0-9.7 9.7-19.3 19.3-19.3 14.5 0 24.4 9.7 24.4 19.3.1 10-9.9 19.6-24.4 19.6z" />
          </Svg>
        );
      default:
        return null;
    }
  })();

  if (!iconElement) return null;

  // Only make interactive if there's a reason to press (username or custom onPress)
  const isInteractive = !disabled && (!!username || !!onPress);

  const containerStyle = [
    styles.container,
    { width: containerSize, height: containerSize },
    disabled && styles.disabled,
  ];

  // Use View for display-only icons, TouchableOpacity for interactive ones
  if (!isInteractive) {
    return (
      <View style={containerStyle}>
        {iconElement}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      activeOpacity={0.7}
      extraButtonProps={{ exclusive: false }}
    >
      {iconElement}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  active: {
    transform: [{ scale: 0.95 }],
  },
});

export default SocialIcon;
