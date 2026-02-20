/**
 * ItemChip component - Generalized chip/item component
 * Used for calendar items, location items, and meeting suggestion chips
 *
 * Adapted from: apps/web/src/app/components/ui/modules/ItemChip.tsx
 */

import React, { useRef, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { textSizes, fontStyles } from '../Typography';

interface ItemChipProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actionButton?: ReactNode;  // Optional custom action button (for full control)
  onActionClick?: (e: GestureResponderEvent) => void;  // Standardized action button handler
  actionIcon?: 'trash' | 'calendar' | 'chevron' | ReactNode;  // Predefined icons or custom
  isActionLoading?: boolean;  // Show loading spinner on action button
  onClick?: () => void;
  onPress?: () => void;  // Alias for onClick
  onLongPress?: () => void;  // Long-press handler (500ms hold)
  truncateTitle?: boolean;  // Enable text truncation with ellipsis
}

// Trash icon component (stroke style like web)
const TrashIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </Svg>
);

// Calendar icon component
const CalendarIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="#ffffff">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
    />
  </Svg>
);

// Chevron icon component
const ChevronIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="#ffffff">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
    />
  </Svg>
);

// Loading spinner
const LoadingSpinner = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle
      cx="12"
      cy="12"
      r="10"
      stroke="#ffffff"
      strokeOpacity={0.25}
      strokeWidth={4}
    />
    <Path
      fill="#ffffff"
      fillOpacity={0.75}
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </Svg>
);

export function ItemChip({
  icon,
  title,
  subtitle,
  actionButton,
  onActionClick,
  actionIcon,
  isActionLoading = false,
  onClick,
  onPress,
  onLongPress,
  truncateTitle = false,
}: ItemChipProps) {
  const handlePress = onClick || onPress;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressIn = () => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
      }, 500);
    }
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onActionButtonPress = (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (onActionClick && !isActionLoading) {
      onActionClick(e);
    }
  };

  // Render predefined icon
  const renderActionIcon = () => {
    if (actionIcon === 'trash') {
      return <TrashIcon />;
    } else if (actionIcon === 'calendar') {
      return <CalendarIcon />;
    } else if (actionIcon === 'chevron') {
      return <ChevronIcon />;
    }
    return actionIcon as ReactNode; // Custom ReactNode
  };

  const hasAction = actionButton || onActionClick;

  return (
    <View style={styles.container}>
      {/* Clickable area */}
      <TouchableOpacity
        style={styles.contentArea}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={handlePress ? 0.7 : 1}
        delayLongPress={500}
        disabled={!handlePress}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          {icon}
        </View>

        {/* Content */}
        <View style={[styles.content, hasAction ? styles.contentWithAction : null]}>
          <Text
            style={styles.title}
            numberOfLines={truncateTitle ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Action Button */}
      {actionButton ? (
        <View style={styles.actionButtonContainer}>
          {actionButton}
        </View>
      ) : onActionClick ? (
        <TouchableOpacity
          style={[styles.actionButton, isActionLoading && styles.actionButtonLoading]}
          onPress={onActionButtonPress}
          activeOpacity={0.7}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            renderActionIcon()
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // bg-black/60
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', // border-white/10
    borderRadius: 16, // rounded-2xl
  },
  contentArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  iconContainer: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
  },
  contentWithAction: {
    marginRight: 12,
  },
  title: {
    ...textSizes.base,
    ...fontStyles.bold,
    color: '#ffffff',
  },
  subtitle: {
    ...textSizes.sm,
    color: 'rgba(209, 213, 219, 1)', // text-gray-300
    marginTop: 2,
  },
  actionButtonContainer: {
    flexShrink: 0,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // bg-white/10
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // border-white/20
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionButtonLoading: {
    opacity: 0.5,
  },
});

export default ItemChip;
