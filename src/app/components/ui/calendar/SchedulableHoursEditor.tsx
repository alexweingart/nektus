/**
 * SchedulableHoursEditor - Component for editing available hours per day
 * Adapted from CalConnect's CalendarItem for Nekt styling
 */

'use client';

import React, { useState } from 'react';
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
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

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
    // Auto-expand day when adding time slot
    setExpandedDays(prev => ({ ...prev, [day]: true }));
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
        const isExpanded = expandedDays[day] || false;

        return (
          <div key={day} className="bg-black/40 border border-white/20 rounded-xl overflow-hidden">
            {/* Day Header */}
            <button
              onClick={() => toggleDay(day)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Text variant="base" className="text-white font-medium capitalize">
                  {day}
                </Text>
                {hasSlots && (
                  <Text variant="small" className="text-white/60">
                    {schedulableHours[day].length} slot{schedulableHours[day].length !== 1 ? 's' : ''}
                  </Text>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTimeSlot(day);
                  }}
                  className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-colors"
                >
                  + Add
                </button>
                <svg
                  className={`w-5 h-5 text-white/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Time Slots (Expanded) */}
            {isExpanded && (
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
                        className="h-10 w-10 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0 flex items-center justify-center"
                        aria-label="Remove time slot"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
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
            )}
          </div>
        );
      })}
    </div>
  );
};
