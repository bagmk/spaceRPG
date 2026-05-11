import { useEffect, useRef } from 'react';

interface SettingsPanelProps {
  bgmMuted: boolean;
  sfxMuted: boolean;
  language: 'en' | 'ko';
  onToggleBgm: () => void;
  onToggleSfx: () => void;
  onToggleLanguage: () => void;
  onRequestReset: () => void;
  onClose: () => void;
}

const T = {
  en: {
    title: 'Settings',
    bgm: 'BGM',
    sfx: 'Sound Effects',
    language: 'Language',
    reset: 'Reset Game',
    on: 'ON',
    off: 'OFF',
  },
  ko: {
    title: '설정',
    bgm: '배경음악',
    sfx: '효과음',
    language: '언어',
    reset: '게임 초기화',
    on: '켜짐',
    off: '꺼짐',
  },
} as const;

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
  const t = T[language];

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
          <span className="settings-title">{t.title}</span>
          <button type="button" className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.bgm}</span>
          <button
            type="button"
            className={`settings-toggle ${!bgmMuted ? 'settings-toggle--on' : ''}`}
            onClick={onToggleBgm}
          >
            {bgmMuted ? t.off : t.on}
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.sfx}</span>
          <button
            type="button"
            className={`settings-toggle ${!sfxMuted ? 'settings-toggle--on' : ''}`}
            onClick={onToggleSfx}
          >
            {sfxMuted ? t.off : t.on}
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.language}</span>
          <button
            type="button"
            className="settings-lang-toggle"
            onClick={onToggleLanguage}
            title={language === 'en' ? 'Switch to Korean' : '영어로 전환'}
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
          {t.reset}
        </button>
      </div>
    </div>
  );
}
