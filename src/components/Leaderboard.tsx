import { useEffect, useState } from 'react';
import { fetchTopN, type LeaderboardEntry } from '../cloud/leaderboard';
import { formatEntropyParts, formatDuration } from '../game/formulas';
import { useAuth } from '../auth/AuthProvider';
import type { Lang } from '../i18n';

interface LeaderboardProps {
  language: Lang;
  onClose: () => void;
}

export function Leaderboard({ language, onClose }: LeaderboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const ko = language === 'ko';

  useEffect(() => {
    fetchTopN(100).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="leaderboard-overlay">
      <div className="leaderboard">
        <div className="leaderboard__header">
          <h2 className="leaderboard__title">
            {ko ? '엔트로피 랭킹' : 'Entropy Ranking'}
          </h2>
          <button className="leaderboard__close" type="button" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className="leaderboard__loading">{ko ? '불러오는 중...' : 'Loading...'}</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard__empty">{ko ? '아직 등록된 기록이 없습니다.' : 'No entries yet.'}</p>
        ) : (
          <div className="leaderboard__list">
            {entries.map((entry, idx) => {
              const isMe = user?.uid === entry.uid;
              const readout = formatEntropyParts(entry.peakEntropy);
              return (
                <div
                  key={entry.uid}
                  className={`leaderboard__row ${isMe ? 'leaderboard__row--me' : ''}`}
                >
                  <span className="leaderboard__rank">#{idx + 1}</span>
                  <span className="leaderboard__name">{entry.displayName}</span>
                  {entry.totalTimePlayed ? (
                    <span className="leaderboard__time">{formatDuration(entry.totalTimePlayed)}</span>
                  ) : null}
                  <span className="leaderboard__entropy">
                    {readout.value} <span className="hud-entropy-unit">{readout.unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
