/**
 * ThemedTextInput - Base TextInput with app-wide defaults
 * Centralizes cursor color and other theme settings
 */

import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

export interface ThemedTextInputProps extends TextInputProps {
  /** Override the default cursor color (white for dark bg, black for light bg) */
  cursorColor?: 'light' | 'dark';
}

/**
 * Themed TextInput that applies app-wide defaults.
 * Use this instead of the base TextInput for consistent styling.
 */
export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  ({ cursorColor = 'light', selectionColor, ...props }, ref) => {
    // Use provided selectionColor, or default based on cursorColor prop
    const resolvedSelectionColor = selectionColor ?? (cursorColor === 'light' ? '#ffffff' : '#000000');

    return (
      <TextInput
        ref={ref}
        selectionColor={resolvedSelectionColor}
        {...props}
      />
    );
  }
);

ThemedTextInput.displayName = 'ThemedTextInput';

export default ThemedTextInput;
