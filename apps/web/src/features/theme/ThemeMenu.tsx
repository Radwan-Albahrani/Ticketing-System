import { useLayoutEffect } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './theme.store';
import { isThemePreference, resolveTheme } from './theme.utils';
export function ThemeEffect() {
  const preference = useTheme((state) => state.preference);
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preference, media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
  return null;
}
const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;
export function ThemeMenu() {
  const { preference, setPreference } = useTheme();
  const current = options.find((option) => option.value === preference)!;
  const Icon = current.icon;
  return (
    <Menu.Root>
      <Menu.Trigger className="theme-trigger" aria-label="Color theme">
        <Icon size={15} />
        <span>{current.label}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="theme-positioner">
          <Menu.Popup className="theme-popup">
            <div className="theme-menu-label">APPEARANCE</div>
            <Menu.RadioGroup
              value={preference}
              onValueChange={(value: unknown) => {
                if (isThemePreference(value)) setPreference(value);
              }}
            >
              {options.map(({ value, label, icon: OptionIcon }) => (
                <Menu.RadioItem key={value} value={value} className="theme-option" closeOnClick>
                  <OptionIcon size={15} />
                  <span>{label}</span>
                  <span className="theme-check">
                    <Menu.RadioItemIndicator>
                      <Check size={13} />
                    </Menu.RadioItemIndicator>
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
