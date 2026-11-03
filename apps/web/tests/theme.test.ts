import { describe, expect, test } from 'bun:test';
import { normalizeThemePreference, resolveTheme } from '../src/features/theme/theme.utils';
describe('theme preferences', () => {
  test('explicit light and dark choices override system settings', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  test('system preference follows the current OS appearance', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  test('missing or invalid stored preferences safely use system appearance', () => {
    for (const value of [null, undefined, 'invalid', '{}'])
      expect(normalizeThemePreference(value)).toBe('system');
    expect(normalizeThemePreference('dark')).toBe('dark');
  });
});
