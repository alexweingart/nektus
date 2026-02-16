/**
 * BaseTextInput - Base TextInput primitive with app-wide defaults
 * Centralizes cursor color and other theme settings
 *
 * IMPORTANT: Uses gesture-handler's TextInput to properly integrate with
 * parent gesture handlers (required for drag-and-drop to work with TextInput children)
 */

import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';
import { TextInput } from 'react-native-gesture-handler';

export interface BaseTextInputProps extends Omit<TextInputProps, 'cursorColor' | 'selectionColor'> {
  /** Override the default cursor color theme (white for dark bg, black for light bg) */
  colorTheme?: 'light' | 'dark';
}

/**
 * Themed TextInput that applies app-wide defaults.
 * Use this instead of the base TextInput for consistent styling.
 *
 * Uses react-native-gesture-handler's TextInput for proper integration
 * with parent gesture handlers like TouchableOpacity's onLongPress.
 */
export const BaseTextInput = forwardRef<RNTextInput, BaseTextInputProps>(
  ({ colorTheme = 'light', ...props }, ref) => {
    // Resolve the actual color based on theme
    const resolvedColor = colorTheme === 'light' ? '#ffffff' : '#000000';

    return (
      <TextInput
        // @ts-expect-error - gesture-handler TextInput ref type differs from RN TextInput but is compatible at runtime
        ref={ref}
        {...props}
        selectionColor={resolvedColor}
        cursorColor={resolvedColor}
      />
    );
  }
);

BaseTextInput.displayName = 'BaseTextInput';

export default BaseTextInput;
