import { useEffect, useState } from 'react';
import { fetchTopN, type LeaderboardEntry, type LeaderboardTab } from '../cloud/leaderboard';
import { formatEntropyParts, formatDuration, formatWhole } from '../game/formulas';
import { useAuth } from '../auth/AuthProvider';
import type { Lang } from '../i18n';

interface LeaderboardProps {
  language: Lang;
  onClose: () => void;
}

const TABS: { id: LeaderboardTab; en: string; ko: string }[] = [
  { id: 'entropy', en: 'Entropy', ko: '엔트로피' },
  { id: 'time', en: 'Time', ko: '시간' },
  { id: 'clicks', en: 'Clicks', ko: '클릭' },
  { id: 'multiverse', en: 'Multiverse', ko: '멀티버스' },
];

function formatValue(entry: LeaderboardEntry, tab: LeaderboardTab): string {
  switch (tab) {
    case 'entropy': {
      const r = formatEntropyParts(entry.peakEntropy);
      return `${r.value} ${r.unit}`;
    }
    case 'time':
      return formatDuration(entry.totalTimePlayed ?? 0);
    case 'clicks':
      return formatWhole(entry.totalClicks ?? 0);
    case 'multiverse':
      return `#${formatWhole(entry.universeCount ?? 0)}`;
  }
}

export function Leaderboard({ language, onClose }: LeaderboardProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<LeaderboardTab>('entropy');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const ko = language === 'ko';

  useEffect(() => {
    setLoading(true);
    fetchTopN(100, tab).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [tab]);

  return (
    <section className="leaderboard-overlay">
      <div className="leaderboard">
        <div className="leaderboard__header">
          <h2 className="leaderboard__title">
            {ko ? '랭킹' : 'Ranking'}
          </h2>
          <button className="leaderboard__close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="leaderboard__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`leaderboard__tab ${tab === t.id ? 'leaderboard__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {ko ? t.ko : t.en}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="leaderboard__loading">{ko ? '불러오는 중...' : 'Loading...'}</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard__empty">{ko ? '아직 등록된 기록이 없습니다.' : 'No entries yet.'}</p>
        ) : (
          <div className="leaderboard__list">
            {entries.map((entry, idx) => {
              const isMe = user?.uid === entry.uid;
              return (
                <div
                  key={entry.uid}
                  className={`leaderboard__row ${isMe ? 'leaderboard__row--me' : ''}`}
                >
                  <span className="leaderboard__rank">#{idx + 1}</span>
                  <span className="leaderboard__name">{entry.displayName}</span>
                  <span className="leaderboard__value">{formatValue(entry, tab)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
