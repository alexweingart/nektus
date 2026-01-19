/**
 * ThemedTextInput - Base TextInput with app-wide defaults
 * Centralizes cursor color and other theme settings
 */

import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

export interface ThemedTextInputProps extends Omit<TextInputProps, 'cursorColor' | 'selectionColor'> {
  /** Override the default cursor color theme (white for dark bg, black for light bg) */
  colorTheme?: 'light' | 'dark';
}

/**
 * Themed TextInput that applies app-wide defaults.
 * Use this instead of the base TextInput for consistent styling.
 */
export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  ({ colorTheme = 'light', ...props }, ref) => {
    // Resolve the actual color based on theme
    const resolvedColor = colorTheme === 'light' ? '#ffffff' : '#000000';

    return (
      <TextInput
        ref={ref}
        {...props}
        selectionColor={resolvedColor}
        cursorColor={resolvedColor}
      />
    );
  }
);

ThemedTextInput.displayName = 'ThemedTextInput';

export default ThemedTextInput;
