import { useEffect, useRef, useState } from 'react';
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
  onForceReset?: () => void;
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
  onForceReset,
  onOpenLeaderboard,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { status, profile, signOut, deleteAccount } = useAuth();
  const ko = language === 'ko';
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // State + localStorage already cleared inside deleteAccount.
      // Force-reset the game so the UI goes back to intro (no reload needed,
      // which would re-hydrate from a potentially stale cloud save).
      if (onForceReset) {
        onForceReset();
      }
      onClose();
      return;
    } catch (e: any) {
      setDeleting(false);
      // User canceled the reauth popup/sheet - not a real error.
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === '1001') return;
      console.error('[SettingsPanel] delete account error:', e);
      setDeleteError(ko ? '삭제 실패. 다시 시도해주세요.' : 'Delete failed. Please try again.');
    }
  };

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

            {!confirmingDelete ? (
              <button
                type="button"
                className="settings-delete-btn"
                onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}
              >
                {ko ? '계정 삭제' : 'Delete Account'}
              </button>
            ) : (
              <div className="settings-delete-confirm">
                <span className="settings-delete-warning">
                  {ko
                    ? '계정과 모든 진행/랭킹이 영구 삭제됩니다. 되돌릴 수 없습니다.'
                    : 'Your account and all progress and ranking will be permanently deleted. This cannot be undone.'}
                </span>
                <div className="settings-delete-actions">
                  <button
                    type="button"
                    className="settings-delete-cancel"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    {ko ? '취소' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="settings-delete-confirm-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? (ko ? '삭제 중...' : 'Deleting...') : (ko ? '영구 삭제' : 'Delete Forever')}
                  </button>
                </div>
                {deleteError ? <span className="settings-delete-error">{deleteError}</span> : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
