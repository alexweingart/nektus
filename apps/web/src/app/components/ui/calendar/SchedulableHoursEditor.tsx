/**
 * SchedulableHoursEditor - Component for editing available hours per day
 * Adapted from CalConnect's CalendarItem for Nekt styling
 */

'use client';

import React from 'react';
import { TimePicker } from '../inputs/TimePicker';
import { Text } from '../Typography';
import type { SchedulableHours } from '@/types/profile';

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
  'sunday'
];

export const SchedulableHoursEditor: React.FC<SchedulableHoursEditorProps> = ({
  schedulableHours,
  onChange
}) => {

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
      [field]: value
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

  return (
    <div className="space-y-3">
      {DAYS.map(day => {
        const hasSlots = schedulableHours[day]?.length > 0;

        return (
          <div key={day} className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
            {/* Day Header */}
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <Text variant="base" className="text-white font-medium capitalize">
                {day}
              </Text>
              <button
                onClick={() => handleAddTimeSlot(day)}
                className="px-3 py-1 bg-white/10 border border-white/20 rounded-2xl text-white text-sm hover:bg-white/20 transition-colors"
              >
                + Add
              </button>
            </div>

            {/* Time Slots (Always Visible) */}
            <div className="px-4 pb-4 space-y-2 border-t border-white/10">
              {hasSlots ? (
                schedulableHours[day].map((slot, slotIndex) => (
                  <div key={slotIndex} className="flex gap-2 items-center mt-3">
                    <div className="flex-1 flex gap-2 items-center">
                      <TimePicker
                        value={slot.start}
                        onChange={(time) => handleTimeChange(day, slotIndex, 'start', time)}
                        className="flex-1 max-w-[140px]"
                      />
                      <Text variant="small" className="text-white/60" as="span">
                        to
                      </Text>
                      <TimePicker
                        value={slot.end}
                        onChange={(time) => handleTimeChange(day, slotIndex, 'end', time)}
                        className="flex-1 max-w-[140px]"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveTimeSlot(day, slotIndex)}
                      className="h-10 w-10 rounded-full bg-white/10 border border-white/20 text-gray-400 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0 flex items-center justify-center"
                      aria-label="Remove time slot"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <Text variant="small" className="text-white/40 italic pt-3">
                  No available hours
                </Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
