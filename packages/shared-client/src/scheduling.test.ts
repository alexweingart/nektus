import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  getDayOfWeek,
  isSlotWithinSchedulableHours,
  getAllValidSlots,
  calculateWindowCenter,
  selectOptimalSlot,
  processCommonSlots,
} from './scheduling';
import type { SchedulableHours, TimeSlot } from '@nektus/shared-types';

const allDayHours = (start: string, end: string): SchedulableHours => ({
  monday: [{ start, end }],
  tuesday: [{ start, end }],
  wednesday: [{ start, end }],
  thursday: [{ start, end }],
  friday: [{ start, end }],
  saturday: [{ start, end }],
  sunday: [{ start, end }],
});

/** Create a 30-min slot on a given date at a given hour:minute */
function slot(dateStr: string, hour: number, minute: number = 0): TimeSlot {
  const start = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe('timeToMinutes', () => {
  it('converts 00:00 to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 12:30 to 750', () => {
    expect(timeToMinutes('12:30')).toBe(750);
  });

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('getDayOfWeek', () => {
  it('returns monday for a Monday date', () => {
    // 2026-02-16 is a Monday
    expect(getDayOfWeek(new Date('2026-02-16T12:00:00'))).toBe('monday');
  });

  it('returns sunday for a Sunday date', () => {
    // 2026-02-15 is a Sunday
    expect(getDayOfWeek(new Date('2026-02-15T12:00:00'))).toBe('sunday');
  });

  it('returns friday for a Friday date', () => {
    // 2026-02-20 is a Friday
    expect(getDayOfWeek(new Date('2026-02-20T12:00:00'))).toBe('friday');
  });
});

describe('isSlotWithinSchedulableHours', () => {
  const hours = allDayHours('09:00', '17:00');

  it('returns true when slot is within window', () => {
    const slotTime = new Date('2026-02-16T10:00:00');
    expect(isSlotWithinSchedulableHours(slotTime, hours, 30)).toBe(true);
  });

  it('returns false when slot is before window', () => {
    const slotTime = new Date('2026-02-16T07:00:00');
    expect(isSlotWithinSchedulableHours(slotTime, hours, 30)).toBe(false);
  });

  it('returns false when slot + duration exceeds window', () => {
    const slotTime = new Date('2026-02-16T16:45:00');
    expect(isSlotWithinSchedulableHours(slotTime, hours, 30)).toBe(false);
  });

  it('accounts for travel buffers', () => {
    // 15:00 + 30 before + 60 event + 30 after = 17:00 — exactly at boundary
    const slotTime = new Date('2026-02-16T15:00:00');
    expect(isSlotWithinSchedulableHours(slotTime, hours, 60, 30, 30)).toBe(true);
    // 15:30 would exceed
    const slotTime2 = new Date('2026-02-16T15:30:00');
    expect(isSlotWithinSchedulableHours(slotTime2, hours, 60, 30, 30)).toBe(false);
  });

  it('returns false when day has no schedule', () => {
    const emptyHours: SchedulableHours = {
      ...hours,
      monday: [],
    };
    const slotTime = new Date('2026-02-16T10:00:00'); // Monday
    expect(isSlotWithinSchedulableHours(slotTime, emptyHours, 30)).toBe(false);
  });

  it('handles overnight windows', () => {
    const overnightHours = allDayHours('22:00', '06:00');
    const slotTime = new Date('2026-02-16T23:00:00');
    expect(isSlotWithinSchedulableHours(slotTime, overnightHours, 30)).toBe(true);
  });
});

describe('getAllValidSlots', () => {
  it('filters slots by preferred hours', () => {
    const template = {
      id: 'test',
      title: 'Test',
      duration: 30,
      eventType: 'video' as const,
      preferredSchedulableHours: allDayHours('10:00', '12:00'),
    };
    const slots = [
      slot('2026-02-16', 9, 0),
      slot('2026-02-16', 10, 0),
      slot('2026-02-16', 10, 30),
      slot('2026-02-16', 11, 0),
      slot('2026-02-16', 11, 30),
      slot('2026-02-16', 13, 0),
    ];
    const valid = getAllValidSlots(slots, template);
    // Only slots between 10:00-12:00 that have enough consecutive time
    expect(valid.length).toBeGreaterThan(0);
    for (const s of valid) {
      const h = new Date(s.start).getHours();
      expect(h).toBeGreaterThanOrEqual(10);
      expect(h).toBeLessThan(12);
    }
  });

  it('checks consecutive slots for travel buffer', () => {
    const template = {
      id: 'test',
      title: 'Test',
      duration: 60,
      eventType: 'in-person' as const,
      travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
      preferredSchedulableHours: allDayHours('08:00', '22:00'),
    };
    // Need 120 min consecutive (30 + 60 + 30)
    // Only 2 consecutive 30-min slots = 60 min, not enough
    const slots = [
      slot('2026-02-16', 10, 0),
      slot('2026-02-16', 10, 30),
    ];
    const valid = getAllValidSlots(slots, template);
    expect(valid.length).toBe(0);
  });

  it('returns valid slots when enough consecutive time exists', () => {
    const template = {
      id: 'test',
      title: 'Test',
      duration: 30,
      eventType: 'video' as const,
      preferredSchedulableHours: allDayHours('08:00', '22:00'),
    };
    const slots = [
      slot('2026-02-16', 10, 0),
      slot('2026-02-16', 10, 30),
    ];
    const valid = getAllValidSlots(slots, template);
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe('calculateWindowCenter', () => {
  it('calculates center of a normal window', () => {
    const hours = allDayHours('09:00', '17:00');
    const date = new Date('2026-02-16T12:00:00'); // Monday
    const center = calculateWindowCenter(hours, date);
    expect(center).toBe(timeToMinutes('13:00')); // (540+1020)/2 = 780
  });

  it('calculates center of overnight window', () => {
    const hours = allDayHours('22:00', '06:00');
    const date = new Date('2026-02-16T12:00:00');
    const center = calculateWindowCenter(hours, date);
    // 22:00 = 1320, 06:00 = 360 -> effective end = 1800 -> center = (1320+1800)/2 = 1560 -> 1560-1440 = 120 = 02:00
    expect(center).toBe(120);
  });

  it('returns null when day has no schedule', () => {
    const hours: SchedulableHours = { ...allDayHours('09:00', '17:00'), monday: [] };
    const date = new Date('2026-02-16T12:00:00'); // Monday
    expect(calculateWindowCenter(hours, date)).toBeNull();
  });
});

describe('selectOptimalSlot', () => {
  it('returns null for empty slots', () => {
    expect(selectOptimalSlot([], 720, 30)).toBeNull();
  });

  it('returns single slot when only one available', () => {
    const s = slot('2026-02-16', 10, 0);
    expect(selectOptimalSlot([s], 720, 30)).toEqual(s);
  });

  it('picks slot closest to center', () => {
    const s1 = slot('2026-02-16', 10, 0); // midpoint: 615
    const s2 = slot('2026-02-16', 12, 0); // midpoint: 735
    const s3 = slot('2026-02-16', 14, 0); // midpoint: 855
    const center = 750; // 12:30
    const result = selectOptimalSlot([s1, s2, s3], center, 30);
    expect(result).toEqual(s2);
  });

  it('tiebreaks by earliest slot', () => {
    const s1 = slot('2026-02-16', 11, 0); // midpoint: 675, dist from 720 = 45
    const s2 = slot('2026-02-16', 13, 0); // midpoint: 795, dist from 720 = 75
    const center = 720;
    const result = selectOptimalSlot([s1, s2], center, 30);
    expect(result).toEqual(s1);
  });
});

describe('processCommonSlots', () => {
  it('returns null for unknown template ID', () => {
    const result = processCommonSlots([], ['nonexistent']);
    expect(result['nonexistent']).toBeNull();
  });

  it('returns null when no valid slots exist', () => {
    const result = processCommonSlots([], ['video-30']);
    expect(result['video-30']).toBeNull();
  });

  it('picks best slot for a video call template', () => {
    // Create enough consecutive slots for a 30-min video call
    const slots = [
      slot('2026-02-16', 10, 0),
      slot('2026-02-16', 10, 30),
      slot('2026-02-16', 11, 0),
      slot('2026-02-16', 14, 0),
      slot('2026-02-16', 14, 30),
      slot('2026-02-16', 15, 0),
    ];
    const result = processCommonSlots(slots, ['video-30']);
    expect(result['video-30']).not.toBeNull();
  });

  it('processes multiple template IDs', () => {
    const slots = [
      slot('2026-02-16', 10, 0),
      slot('2026-02-16', 10, 30),
      slot('2026-02-16', 11, 0),
      slot('2026-02-16', 11, 30),
      slot('2026-02-16', 12, 0),
      slot('2026-02-16', 12, 30),
      slot('2026-02-16', 13, 0),
      slot('2026-02-16', 13, 30),
      slot('2026-02-16', 14, 0),
      slot('2026-02-16', 14, 30),
      slot('2026-02-16', 15, 0),
      slot('2026-02-16', 15, 30),
    ];
    const result = processCommonSlots(slots, ['video-30', 'lunch-60']);
    expect(result).toHaveProperty('video-30');
    expect(result).toHaveProperty('lunch-60');
  });
});
