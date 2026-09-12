import type { ReactElement } from 'react';
import type { Settings, ThemeMode } from '../../shared/api';

interface SettingsViewProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClearHistory: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

// The settings panel: theme mode, font size, phonetic-input toggle, and a
// clear-history action. Every change is persisted through the store IPC by the
// parent via onChange.
export default function SettingsView({
  settings,
  onChange,
  onClearHistory,
}: SettingsViewProps): ReactElement {
  return (
    <section aria-label="Settings" className="settings">
      <h2 className="view-title">Settings</h2>

      <div className="setting">
        <span className="setting__label">Theme</span>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={settings.theme === option.value}
              className={`segmented__btn${
                settings.theme === option.value ? ' segmented__btn--active' : ''
              }`}
              onClick={() => onChange({ theme: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <label className="setting__label" htmlFor="font-size">
          Font size: {settings.fontSize}px
        </label>
        <input
          id="font-size"
          type="range"
          min={12}
          max={28}
          step={1}
          value={settings.fontSize}
          onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        />
      </div>

      <div className="setting setting--row">
        <label className="setting__label" htmlFor="phonetic-input">
          Phonetic input (show Bangla candidate for Latin typing)
        </label>
        <input
          id="phonetic-input"
          type="checkbox"
          checked={settings.phoneticInput}
          onChange={(event) => onChange({ phoneticInput: event.target.checked })}
        />
      </div>

      <div className="setting setting--row">
        <span className="setting__label">Search history</span>
        <button type="button" className="btn btn--ghost" onClick={onClearHistory}>
          Clear history
        </button>
      </div>
    </section>
  );
}
