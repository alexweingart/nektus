import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../buttons/Button';

interface PageHeaderProps {
  onBack: () => void;
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
    console.log('[PageHeader] Back button pressed');
    onBack();
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <Button
        variant="circle"
        size="icon"
        onPress={handleBack}
      >
        <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
          <Path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
          />
        </Svg>
      </Button>

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
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
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
