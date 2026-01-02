/**
 * ItemChip component - List item with icon, title, subtitle, and optional action
 * Used in HistoryView to display contact list items
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ItemChipProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  truncateTitle?: boolean;
  onClick?: () => void;
  onPress?: () => void; // Alias for onClick
  onActionClick?: (e: GestureResponderEvent) => void;
  onActionPress?: () => void; // Alias for onActionClick
  onLongPress?: () => void;
  actionIcon?: 'calendar' | 'chevron' | 'trash';
  isActionLoading?: boolean;
}

// Calendar icon component
const CalendarIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
    />
  </Svg>
);

// Chevron icon component
const ChevronIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="#9CA3AF">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
    />
  </Svg>
);

// Trash icon component
const TrashIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="#EF4444">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
    />
  </Svg>
);

export function ItemChip({
  icon,
  title,
  subtitle,
  truncateTitle = false,
  onClick,
  onPress,
  onActionClick,
  onActionPress,
  onLongPress,
  actionIcon = 'chevron',
  isActionLoading = false,
}: ItemChipProps) {
  // Support both onClick and onPress (alias)
  const handlePress = onClick || onPress;
  // Support both onActionClick and onActionPress (alias)
  const handleActionClick = onActionClick || onActionPress;
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
    if (handleActionClick && !isActionLoading) {
      if (onActionClick) {
        onActionClick(e);
      } else if (onActionPress) {
        onActionPress();
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      delayLongPress={500}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        {icon}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={styles.title}
          numberOfLines={truncateTitle ? 1 : undefined}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      {/* Action Button */}
      {handleActionClick && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onActionButtonPress}
          activeOpacity={0.7}
        >
          {isActionLoading ? (
            <ActivityIndicator size="small" color="#374151" />
          ) : actionIcon === 'trash' ? (
            <TrashIcon />
          ) : actionIcon === 'calendar' ? (
            <CalendarIcon />
          ) : (
            <ChevronIcon />
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default ItemChip;
