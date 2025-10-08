/**
 * TimePicker - 12-hour time picker with AM/PM toggle
 * Adapted from CalConnect for Nekt styling (dark theme)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Text } from '../Typography';
import { CustomTimeInput } from './CustomTimeInput';

interface TimePickerProps {
  value: string; // "HH:mm" in 24-hour format
  onChange: (time: string) => void;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className = '' }) => {
  // Convert 24-hour time to 12-hour format for display
  const convertTo12Hour = (time24: string) => {
    const [hours24, minutes] = time24.split(':').map(Number);
    const period = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    return { hours: hours12, minutes, period };
  };

  // Convert 12-hour format back to 24-hour for storage
  const convertTo24Hour = (hours12: number, minutes: number, period: 'AM' | 'PM') => {
    let hours24 = hours12;
    if (period === 'PM' && hours12 !== 12) {
      hours24 = hours12 + 12;
    } else if (period === 'AM' && hours12 === 12) {
      hours24 = 0;
    }
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const { hours: initialHours, minutes: initialMinutes, period: initialPeriod } = convertTo12Hour(value);

  const [hours, setHours] = useState(initialHours.toString());
  const [minutes, setMinutes] = useState(initialMinutes.toString().padStart(2, '0'));
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialPeriod as 'AM' | 'PM');

  // Update internal state when value prop changes
  useEffect(() => {
    const { hours: newHours, minutes: newMinutes, period: newPeriod } = convertTo12Hour(value);
    setHours(newHours.toString());
    setMinutes(newMinutes.toString().padStart(2, '0'));
    setPeriod(newPeriod as 'AM' | 'PM');
  }, [value]);

  // Update parent when any time component changes
  useEffect(() => {
    const hoursNum = parseInt(hours) || 12;
    const minutesNum = parseInt(minutes) || 0;

    if (hoursNum >= 1 && hoursNum <= 12 && minutesNum >= 0 && minutesNum <= 59 && (minutes === '' || minutes.length >= 1)) {
      const time24 = convertTo24Hour(hoursNum, minutesNum, period);
      if (time24 !== value) {
        onChange(time24);
      }
    }
  }, [hours, minutes, period, value, onChange]);

  const togglePeriod = () => {
    setPeriod(period === 'AM' ? 'PM' : 'AM');
  };

  return (
    <div className={`inline-flex items-center justify-center px-3 py-2 border border-white/20 rounded-lg bg-white/10 gradient-border-focus-within ${className}`}>
      <CustomTimeInput
        value={hours}
        onChange={(value) => setHours(value)}
        variant="hours"
        placeholder="12"
      />

      <Text variant="base" as="span" className="select-none -mx-1 text-white">:</Text>

      <CustomTimeInput
        value={minutes}
        onChange={(value) => setMinutes(value)}
        variant="minutes"
        placeholder="00"
      />

      <button
        type="button"
        onClick={togglePeriod}
        className="-ml-1 px-2 py-1 text-base font-medium text-white hover:bg-white/20 rounded transition-colors select-none focus:outline-none focus:ring-0 focus:border-transparent"
      >
        {period}
      </button>
    </div>
  );
};
