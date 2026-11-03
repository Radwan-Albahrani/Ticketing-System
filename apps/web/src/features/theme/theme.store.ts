import { create } from 'zustand';
import { normalizeThemePreference, type ThemePreference } from './theme.utils';
function readPreference(): ThemePreference {
  try {
    return normalizeThemePreference(localStorage.getItem('loura-theme'));
  } catch {
    return 'system';
  }
}
export const useTheme = create<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>((set) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    set({ preference });
    try {
      localStorage.setItem('loura-theme', preference);
    } catch {
      /* The selected theme still works if browser storage is unavailable. */
    }
  },
}));
