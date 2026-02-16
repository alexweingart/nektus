import { describe, it, expect } from 'vitest';
import { getInitials, stringToColor } from './avatar';

describe('getInitials', () => {
  it('returns first and last initials for two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns first two characters for single word', () => {
    expect(getInitials('John')).toBe('JO');
  });

  it('returns first and last initials for multi-word name', () => {
    expect(getInitials('John Michael Doe')).toBe('JD');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('returns ? for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?');
  });

  it('uppercases the initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles single character name', () => {
    expect(getInitials('A')).toBe('A');
  });

  it('handles extra whitespace between words', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD');
  });
});

describe('stringToColor', () => {
  it('returns deterministic color for same input', () => {
    const color1 = stringToColor('John Doe');
    const color2 = stringToColor('John Doe');
    expect(color1).toBe(color2);
  });

  it('returns different colors for different inputs', () => {
    const color1 = stringToColor('Alice');
    const color2 = stringToColor('Bob');
    expect(color1).not.toBe(color2);
  });

  it('returns valid HSL string', () => {
    const color = stringToColor('Test');
    expect(color).toMatch(/^hsl\(-?\d+, \d+%, \d+%\)$/);
  });

  it('saturation is in 60-80 range', () => {
    const color = stringToColor('Example');
    const match = color.match(/hsl\(-?\d+, (\d+)%, (\d+)%\)/);
    const saturation = parseInt(match![1], 10);
    expect(saturation).toBeGreaterThanOrEqual(60);
    expect(saturation).toBeLessThanOrEqual(79);
  });

  it('lightness is in 70-80 range', () => {
    const color = stringToColor('Example');
    const match = color.match(/hsl\(-?\d+, (\d+)%, (\d+)%\)/);
    const lightness = parseInt(match![2], 10);
    expect(lightness).toBeGreaterThanOrEqual(70);
    expect(lightness).toBeLessThanOrEqual(79);
  });
});
