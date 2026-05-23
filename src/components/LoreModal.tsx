import { useEffect, useState } from 'react';
import { useLore } from '../hooks/useLore';
import type { Lang } from '../i18n';

interface LoreModalProps {
  loreId: string;
  language: Lang;
  onClose: () => void;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function formatBody(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) =>
      escape(para)
        .replace(/\n/g, '<br>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>'),
    )
    .map((p) => `<p>${p}</p>`)
    .join('');
}

export function LoreModal({ loreId, language, onClose }: LoreModalProps) {
  const state = useLore(loreId);
  const [internalLang, setInternalLang] = useState<Lang>(language);

  useEffect(() => setInternalLang(language), [language]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Don't render if not loaded yet or item missing
  if (state.status === 'loading') {
    return (
      <div className="lore-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="lore-modal" onClick={(e) => e.stopPropagation()}>
          <div className="lore-modal__body">…</div>
        </div>
      </div>
    );
  }
  if (state.status !== 'ready' || !state.item) {
    return (
      <div className="lore-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="lore-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="lore-modal__close" onClick={onClose} aria-label="Close">×</button>
          <div className="lore-modal__body">
            <p>{internalLang === 'ko' ? '해설을 찾을 수 없습니다.' : 'Lore not available.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const item = state.item;
  const isEntity = item.type === 'entity';
  const title = isEntity
    ? internalLang === 'ko' ? item.nameKo : item.nameEn
    : internalLang === 'ko' ? item.titleKo : item.titleEn;
  const subtitle = isEntity
    ? internalLang === 'ko' ? item.nameEn : item.nameKo
    : internalLang === 'ko' ? item.titleEn : item.titleKo;
  const stageLabel = internalLang === 'ko' ? item.stageKo : item.stageEn;
  const body = internalLang === 'ko' ? item.bodyKo : item.bodyEn;
  const stageNum = String(item.stageId).padStart(2, '0');

  return (
    <div className="lore-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lore-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lore-modal__close" onClick={onClose} aria-label="Close">×</button>
        <div className="lore-modal__lang">
          <button
            type="button"
            className={internalLang === 'en' ? 'active' : ''}
            onClick={() => setInternalLang('en')}
          >EN</button>
          <button
            type="button"
            className={internalLang === 'ko' ? 'active' : ''}
            onClick={() => setInternalLang('ko')}
          >KO</button>
        </div>
        <div className="lore-modal__breadcrumb">
          {(internalLang === 'ko' ? '스테이지 ' : 'Stage ') + stageNum + ' · ' + stageLabel + ' · ' +
            (isEntity ? (internalLang === 'ko' ? '엔티티' : 'Entity')
                       : (internalLang === 'ko' ? '마일스톤' : 'Milestone'))}
        </div>
        <h2 className="lore-modal__title">{title}</h2>
        {subtitle ? <div className="lore-modal__subtitle">{subtitle}</div> : null}
        {item.meta ? <div className="lore-modal__meta">{item.meta}</div> : null}
        {item.progress !== undefined ? <div className="lore-modal__meta">{item.progress}%</div> : null}
        <div className="lore-modal__body" dangerouslySetInnerHTML={{ __html: formatBody(body ?? '') }} />
      </div>
    </div>
  );
}
