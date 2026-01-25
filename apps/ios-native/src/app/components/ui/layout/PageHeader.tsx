import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../buttons/Button';

interface PageHeaderProps {
  onBack?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  title?: string;
}

/**
 * Page header component for iOS views.
 * Contains:
 *  – Back circle button
 *  – Optional centered title
 *  – Optional save circle button with loading state
 */
export function PageHeader({ onBack, onSave, isSaving = false, title }: PageHeaderProps) {
  const handleBack = () => {
    if (!onBack) return;
    console.log('[PageHeader] Back button pressed');
    onBack();
  };

  return (
    <View style={styles.container}>
      {/* Back button (or placeholder if no onBack) */}
      {onBack ? (
        <Button
          variant="circle"
          size="icon"
          onPress={handleBack}
        >
          <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
            <Path
              d="M10 5L4 10L10 15M4 10H16"
              stroke="#374151"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Button>
      ) : (
        <View style={styles.placeholder} />
      )}

      {/* Centered title - pointerEvents none so it doesn't block button touches */}
      {title && (
        <View style={styles.titleContainer} pointerEvents="none">
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {/* Save button or placeholder for layout balance */}
      {onSave ? (
        <Button
          variant="circle"
          size="icon"
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#374151" />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path
                d="M3 10L8 15L17 4"
                stroke="#374151"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </Button>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  placeholder: {
    width: 56,
    height: 56,
  },
});

export default PageHeader;
