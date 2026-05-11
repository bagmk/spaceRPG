import { useEffect, useRef } from 'react';
import { t, type Lang } from '../i18n';

interface SettingsPanelProps {
  bgmMuted: boolean;
  sfxMuted: boolean;
  language: Lang;
  onToggleBgm: () => void;
  onToggleSfx: () => void;
  onToggleLanguage: () => void;
  onRequestReset: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  bgmMuted,
  sfxMuted,
  language,
  onToggleBgm,
  onToggleSfx,
  onToggleLanguage,
  onRequestReset,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <span className="settings-title">{t(language, 'settingsTitle')}</span>
          <button type="button" className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t(language, 'settingsBgm')}</span>
          <button
            type="button"
            className={`settings-toggle ${!bgmMuted ? 'settings-toggle--on' : ''}`}
            onClick={onToggleBgm}
          >
            {bgmMuted ? t(language, 'settingsOff') : t(language, 'settingsOn')}
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t(language, 'settingsSfx')}</span>
          <button
            type="button"
            className={`settings-toggle ${!sfxMuted ? 'settings-toggle--on' : ''}`}
            onClick={onToggleSfx}
          >
            {sfxMuted ? t(language, 'settingsOff') : t(language, 'settingsOn')}
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t(language, 'settingsLanguage')}</span>
          <button
            type="button"
            className="settings-lang-toggle"
            onClick={onToggleLanguage}
            title={t(language, language === 'en' ? 'settingsLangSwitchToKo' : 'settingsLangSwitchToEn')}
          >
            {language === 'en' ? '🇺🇸 EN' : '🇰🇷 KO'}
          </button>
        </div>

        <div className="settings-divider" />

        <button
          type="button"
          className="settings-reset-btn"
          onClick={onRequestReset}
        >
          {t(language, 'settingsReset')}
        </button>
      </div>
    </div>
  );
}
