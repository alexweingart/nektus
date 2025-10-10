/**
 * ToggleSetting - Reusable toggle setting component
 * Used for binary settings with a label and toggle switch
 */

'use client';

import React from 'react';
import { Text } from './Typography';

interface ToggleSettingProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  label,
  enabled,
  onChange,
  disabled = false
}) => {
  return (
    <div className="flex items-center justify-between px-6">
      <Text variant="small" className="text-white">
        {label}
      </Text>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-white' : 'bg-white/20'
        }`}
        disabled={disabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
            enabled ? 'bg-gray-500 translate-x-6' : 'bg-white translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
