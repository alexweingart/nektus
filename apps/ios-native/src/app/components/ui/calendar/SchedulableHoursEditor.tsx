/**
 * SchedulableHoursEditor - Component for editing available hours per day
 * Allows users to set when they're available for scheduling
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TimePicker } from '../inputs/TimePicker';
import { textSizes, fontStyles } from '../Typography';
import type { SchedulableHours, TimeSlot } from '@nektus/shared-types';

interface SchedulableHoursEditorProps {
  schedulableHours: SchedulableHours;
  onChange: (hours: SchedulableHours) => void;
}

const DAYS: Array<keyof SchedulableHours> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Trash icon for removing time slots
const TrashIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </Svg>
);

export function SchedulableHoursEditor({
  schedulableHours,
  onChange,
}: SchedulableHoursEditorProps) {
  const handleTimeChange = (
    day: keyof SchedulableHours,
    slotIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    const updatedHours = { ...schedulableHours };
    if (!updatedHours[day][slotIndex]) {
      updatedHours[day][slotIndex] = { start: '09:00', end: '17:00' };
    }
    updatedHours[day][slotIndex] = {
      ...updatedHours[day][slotIndex],
      [field]: value,
    };
    onChange(updatedHours);
  };

  const handleAddTimeSlot = (day: keyof SchedulableHours) => {
    const updatedHours = { ...schedulableHours };
    updatedHours[day] = [...updatedHours[day], { start: '09:00', end: '17:00' }];
    onChange(updatedHours);
  };

  const handleRemoveTimeSlot = (day: keyof SchedulableHours, slotIndex: number) => {
    const updatedHours = { ...schedulableHours };
    updatedHours[day] = updatedHours[day].filter((_, index) => index !== slotIndex);
    onChange(updatedHours);
  };

  const capitalizeDay = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {DAYS.map((day) => {
        const hasSlots = schedulableHours[day]?.length > 0;

        return (
          <View key={day} style={styles.dayContainer}>
            {/* Day Header */}
            <View style={styles.dayHeader}>
              <Text style={styles.dayText}>{capitalizeDay(day)}</Text>
              <TouchableOpacity
                onPress={() => handleAddTimeSlot(day)}
                style={styles.addButton}
                activeOpacity={0.7}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {/* Time Slots */}
            <View style={styles.slotsContainer}>
              {hasSlots ? (
                schedulableHours[day].map((slot: TimeSlot, slotIndex: number) => (
                  <View key={slotIndex} style={styles.slotRow}>
                    <View style={styles.timePickersRow}>
                      <TimePicker
                        value={slot.start}
                        onChange={(time) => handleTimeChange(day, slotIndex, 'start', time)}
                      />
                      <Text style={styles.toText}>to</Text>
                      <TimePicker
                        value={slot.end}
                        onChange={(time) => handleTimeChange(day, slotIndex, 'end', time)}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveTimeSlot(day, slotIndex)}
                      style={styles.removeButton}
                      activeOpacity={0.7}
                    >
                      <TrashIcon />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noHoursText}>No available hours</Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dayContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dayText: {
    color: '#ffffff',
    ...textSizes.base,
    ...fontStyles.bold,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  addButtonText: {
    color: '#ffffff',
    ...textSizes.sm,
  },
  slotsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  timePickersRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toText: {
    color: 'rgba(255, 255, 255, 0.6)',
    ...textSizes.sm,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noHoursText: {
    color: 'rgba(255, 255, 255, 0.4)',
    ...textSizes.sm,
    fontStyle: 'italic',
    marginTop: 12,
  },
});

export default SchedulableHoursEditor;
