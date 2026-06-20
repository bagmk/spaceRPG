import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { t, type Lang } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import type { SoundManager } from '../game/audio';
import type { GameState, PersistentGameState } from '../game/types';
import { serializeSave, deserializeSave, listBackupRing, restoreBackupRing } from '../game/storage';

interface SettingsPanelProps {
  sfxMuted: boolean;
  musicMuted: boolean;
  musicVolume: number;          // 0..1
  language: Lang;
  state: GameState;             // C-P2: needed to serialize the current save
  soundManager?: SoundManager | null;
  onImportSave: (persistent: PersistentGameState) => void;  // C-P2
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
  state,
  soundManager,
  onImportSave,
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

  // ── C-P2: save export / import / backups ──
  const [exportCode, setExportCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'bad'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => { setExportCode(serializeSave(state)); setCopied(false); };
  const handleCopy = async () => {
    const code = exportCode ?? serializeSave(state);
    setExportCode(code);
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { /* clipboard blocked: the code is visible in the textarea to copy manually */ }
  };
  const handleDownload = () => {
    const code = exportCode ?? serializeSave(state);
    setExportCode(code);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmic-save-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const applyImport = (persistent: PersistentGameState | null) => {
    if (!persistent) { setImportStatus('bad'); return; }
    // Stamp a fresh save time so an imported (possibly old) code neither grants a
    // bogus offline windfall nor loses to a newer cloud save on the next sync.
    onImportSave({ ...persistent, lastSaveAt: Date.now() });
    setImportStatus('ok');
    onClose();
  };
  const handleImport = () => applyImport(deserializeSave(importText));
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setImportText(String(reader.result ?? '')); setImportStatus('idle'); };
    reader.readAsText(f);
  };
  const ringEntries = listBackupRing();

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

        {/* C-P2: save export / import / backups */}
        <div className="settings-save">
          <span className="settings-save__heading">{t(language, 'settingsSaveSection')}</span>

          <button type="button" className="settings-save__btn" onClick={handleExport}>
            {t(language, 'settingsExport')}
          </button>
          {exportCode ? (
            <>
              <textarea
                className="settings-save__code"
                value={exportCode}
                readOnly
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="settings-save__actions">
                <button type="button" className="settings-save__btn" onClick={handleCopy}>
                  {copied ? t(language, 'settingsCopied') : t(language, 'settingsCopy')}
                </button>
                <button type="button" className="settings-save__btn" onClick={handleDownload}>
                  {t(language, 'settingsDownload')}
                </button>
              </div>
              <span className="settings-save__hint">{t(language, 'settingsExportHint')}</span>
            </>
          ) : null}

          <textarea
            className="settings-save__code"
            value={importText}
            placeholder={t(language, 'settingsImportHint')}
            rows={2}
            onChange={(e) => { setImportText(e.target.value); setImportStatus('idle'); }}
          />
          <input type="file" accept=".txt,.json" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} />
          <div className="settings-save__actions">
            <button type="button" className="settings-save__btn" onClick={() => fileInputRef.current?.click()}>
              {t(language, 'settingsImportFile')}
            </button>
            <button
              type="button"
              className="settings-save__btn settings-save__btn--apply"
              disabled={!importText.trim()}
              onClick={handleImport}
            >
              {t(language, 'settingsImportApply')}
            </button>
          </div>
          {importStatus === 'bad' ? <span className="settings-save__error">{t(language, 'settingsImportBad')}</span> : null}
          {importStatus === 'ok' ? <span className="settings-save__ok">{t(language, 'settingsImportOk')}</span> : null}

          <span className="settings-save__heading">{t(language, 'settingsBackups')}</span>
          {ringEntries.length === 0 ? (
            <span className="settings-save__hint">{t(language, 'settingsBackupsEmpty')}</span>
          ) : (
            <ul className="settings-save__ring">
              {ringEntries.slice().reverse().map((entry) => (
                <li key={entry.t} className="settings-save__ring-row">
                  <span className="settings-save__ring-when">{`${new Date(entry.t).toLocaleString()} · v${entry.v}`}</span>
                  <button
                    type="button"
                    className="settings-save__btn"
                    onClick={() => applyImport(restoreBackupRing(entry))}
                  >
                    {t(language, 'settingsRestore')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="settings-divider" />

        <button
          type="button"
          className="settings-reset-btn"
          onClick={onRequestReset}
        >
          {t(language, 'settingsReset')}
        </button>

        {status !== 'loading' && status !== 'signedOut' ? (
          <>
            <div className="settings-divider" />
            {status !== 'anonymous' ? (
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
            ) : null}

            {!confirmingDelete ? (
              <button
                type="button"
                className="settings-delete-btn"
                onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}
              >
                {status === 'anonymous' ? (ko ? '데이터 삭제' : 'Delete Data') : (ko ? '계정 삭제' : 'Delete Account')}
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
