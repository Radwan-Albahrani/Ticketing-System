export type ThemePreference = 'light' | 'dark' | 'system';
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : 'system';
}
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;
}
