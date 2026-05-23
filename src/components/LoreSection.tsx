import { useLore } from '../hooks/useLore';
import type { Lang } from '../i18n';

interface LoreSectionProps {
  loreId: string;
  language: Lang;
}

/** Renders body text with **bold**, *italic*, and paragraph breaks. */
function formatBody(text: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  return text
    .split(/\n\n+/)
    .map((para) =>
      esc(para)
        .replace(/\n/g, '<br>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>'),
    )
    .map((p) => `<p>${p}</p>`)
    .join('');
}

export function LoreSection({ loreId, language }: LoreSectionProps) {
  const state = useLore(loreId);

  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <div className="lore-section lore-section--loading">
        <div className="lore-section__body">…</div>
      </div>
    );
  }
  if (state.status === 'error' || !state.item) {
    return null; // Silent fail — gracefully hide if lore not found
  }

  const body = language === 'ko' ? state.item.bodyKo : state.item.bodyEn;
  if (!body) return null;

  return (
    <div className="lore-section">
      <div className="lore-section__body" dangerouslySetInnerHTML={{ __html: formatBody(body) }} />
    </div>
  );
}
