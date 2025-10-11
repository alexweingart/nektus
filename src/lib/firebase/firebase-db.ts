// Calendar-specific Firebase client DB helpers for CalConnect merge
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS, UNIVERSAL_SCHEDULABLE_HOURS } from '@/lib/constants';

export const getDefaultSchedulableHours = (state: 'universal' | 'work' | 'personal') => {
  if (state === 'work') {
    return WORK_SCHEDULABLE_HOURS;
  } else if (state === 'personal') {
    return PERSONAL_SCHEDULABLE_HOURS;
  } else {
    return UNIVERSAL_SCHEDULABLE_HOURS;
  }
};
