/**
 * TimePicker - 12-hour time picker with AM/PM toggle
 * Stores value in 24-hour format internally
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NumberInput } from './NumberInput';
import { textSizes, fontStyles } from '../Typography';

interface TimePickerProps {
  value: string; // "HH:mm" in 24-hour format
  onChange: (time: string) => void;
}

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

export function TimePicker({ value, onChange }: TimePickerProps) {
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

    if (hoursNum >= 1 && hoursNum <= 12 && minutesNum >= 0 && minutesNum <= 59) {
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
    <View style={styles.container}>
      <NumberInput
        value={hours}
        onChange={setHours}
        variant="hours"
        placeholder="12"
      />

      <Text style={styles.separator}>:</Text>

      <NumberInput
        value={minutes}
        onChange={setMinutes}
        variant="minutes"
        placeholder="00"
      />

      <TouchableOpacity
        onPress={togglePeriod}
        style={styles.periodButton}
        activeOpacity={0.7}
      >
        <Text style={styles.periodText}>{period}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    height: 56,
    minHeight: 56,
  },
  separator: {
    color: '#ffffff',
    ...textSizes.sm,
    ...fontStyles.regular,
  },
  periodButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 4,
  },
  periodText: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: '#ffffff',
  },
});

export default TimePicker;
