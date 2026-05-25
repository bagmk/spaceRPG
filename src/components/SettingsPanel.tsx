import { useEffect, useRef } from 'react';
import { t, type Lang } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import type { SoundManager } from '../game/audio';

interface SettingsPanelProps {
  sfxMuted: boolean;
  musicMuted: boolean;
  musicVolume: number;          // 0..1
  language: Lang;
  soundManager?: SoundManager | null;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onSetMusicVolume: (v: number) => void;
  onToggleLanguage: () => void;
  onRequestReset: () => void;
  onOpenLeaderboard?: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  sfxMuted,
  musicMuted,
  musicVolume,
  language,
  soundManager,
  onToggleSfx,
  onToggleMusic,
  onSetMusicVolume,
  onToggleLanguage,
  onRequestReset,
  onOpenLeaderboard,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { status, profile, signOut } = useAuth();

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
          <span className="settings-label">{language === 'ko' ? '음악' : 'Music'}</span>
          <button
            type="button"
            className={`settings-audio-btn ${!musicMuted ? 'settings-audio-btn--on' : ''}`}
            onClick={() => { onToggleMusic(); if (musicMuted) soundManager?.playToggle(true); }}
            aria-label={musicMuted ? 'Music off' : 'Music on'}
          >
            <span className="audio-icon">{musicMuted ? '🎵' : '🎵'}</span>
          </button>
        </div>


        <div className="settings-row">
          <span className="settings-label">{t(language, 'settingsSfx')}</span>
          <button
            type="button"
            className={`settings-audio-btn ${!sfxMuted ? 'settings-audio-btn--on' : ''}`}
            onClick={() => { onToggleSfx(); if (sfxMuted) window.setTimeout(() => soundManager?.playToggle(true), 30); }}
            aria-label={sfxMuted ? 'SFX off' : 'SFX on'}
          >
            <span className="audio-icon">{sfxMuted ? '🔈' : '🔈'}</span>
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t(language, 'settingsLanguage')}</span>
          <button
            type="button"
            className="settings-audio-btn settings-audio-btn--on"
            onClick={onToggleLanguage}
            title={t(language, language === 'en' ? 'settingsLangSwitchToKo' : 'settingsLangSwitchToEn')}
          >
            <span className="audio-icon" style={{ filter: 'none', opacity: 1 }}>{language === 'en' ? '🇺🇸' : '🇰🇷'}</span>
          </button>
        </div>

        {onOpenLeaderboard ? (
          <div className="settings-row">
            <span className="settings-label">{language === 'ko' ? '랭킹' : 'Ranking'}</span>
            <button
              type="button"
              className="settings-audio-btn settings-audio-btn--on"
              onClick={() => { onClose(); onOpenLeaderboard(); }}
            >
              <span className="audio-icon" style={{ filter: 'none', opacity: 1 }}>🏆</span>
            </button>
          </div>
        ) : null}

        <div className="settings-divider" />

        <button
          type="button"
          className="settings-reset-btn"
          onClick={onRequestReset}
        >
          {t(language, 'settingsReset')}
        </button>

        {status !== 'anonymous' && status !== 'signedOut' ? (
          <>
            <div className="settings-divider" />
            <div className="settings-account">
              <span className="settings-account-email">{profile?.email ?? profile?.displayName ?? ''}</span>
              <button
                type="button"
                className="settings-logout-btn"
                onClick={signOut}
              >
                {language === 'ko' ? '로그아웃' : 'Log Out'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
