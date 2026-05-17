import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  validateDisplayName,
  claimDisplayName,
  isNameAvailable,
} from '../cloud/profile';
import type { Lang } from '../i18n';

interface NameSetupModalProps {
  language: Lang;
  onComplete: () => void;
}

export function NameSetupModal({ language, onComplete }: NameSetupModalProps) {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ko = language === 'ko';

  // Debounced availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAvailable(null);
    setError(null);

    const trimmed = name.trim();
    const validation = validateDisplayName(trimmed);
    if (!validation.ok) {
      if (trimmed.length > 0) {
        const reasons: Record<string, string> = ko
          ? { length: '2~16자로 입력해주세요', chars: '한글, 영문, 숫자, 공백만 사용 가능', profanity: '사용할 수 없는 이름입니다' }
          : { length: 'Must be 2–16 characters', chars: 'Letters, numbers, and spaces only', profanity: 'This name is not allowed' };
        setError(reasons[validation.reason]);
      }
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const avail = await isNameAvailable(trimmed);
        setAvailable(avail);
        if (!avail) {
          setError(ko ? '이미 사용 중인 이름입니다' : 'This name is already taken');
        }
      } catch {
        setError(ko ? '확인 중 오류 발생' : 'Error checking availability');
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, ko]);

  const handleSubmit = useCallback(async () => {
    if (!user || submitting) return;
    const trimmed = name.trim();
    const validation = validateDisplayName(trimmed);
    if (!validation.ok) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await claimDisplayName(user.uid, trimmed);
      if (result.ok) {
        await refreshProfile();
        onComplete();
      } else {
        const reasons: Record<string, string> = ko
          ? { taken: '이미 사용 중인 이름입니다', invalid: '유효하지 않은 이름입니다' }
          : { taken: 'Name already taken', invalid: 'Invalid name' };
        setError(reasons[result.reason]);
      }
    } catch {
      setError(ko ? '저장 중 오류가 발생했습니다' : 'Failed to save name');
    } finally {
      setSubmitting(false);
    }
  }, [user, name, submitting, refreshProfile, onComplete, ko]);

  const canSubmit = name.trim().length >= 2 && available === true && !checking && !submitting;

  return (
    <div className="name-modal-overlay">
      <div className="name-modal">
        <h2 className="name-modal__title">
          {ko ? '캐릭터 이름 설정' : 'Set Your Name'}
        </h2>
        <p className="name-modal__desc">
          {ko
            ? '다른 플레이어에게 보여질 이름을 입력하세요.'
            : 'Choose a name visible to other players.'}
        </p>
        <div className="name-modal__input-row">
          <input
            className="name-modal__input"
            type="text"
            maxLength={16}
            placeholder={ko ? '이름 입력...' : 'Enter name...'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
            autoFocus
          />
          {checking && <span className="name-modal__status name-modal__status--checking">...</span>}
          {!checking && available === true && <span className="name-modal__status name-modal__status--ok">✓</span>}
        </div>
        {error && <p className="name-modal__error">{error}</p>}
        <button
          className="name-modal__btn"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting
            ? (ko ? '저장 중...' : 'Saving...')
            : (ko ? '시작하기' : 'Confirm')}
        </button>
      </div>
    </div>
  );
}
