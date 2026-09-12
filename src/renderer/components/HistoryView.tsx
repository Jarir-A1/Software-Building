import type { ReactElement } from 'react';
import type { HistoryItem } from '../../shared/api';

interface HistoryViewProps {
  history: HistoryItem[];
  onRerun: (query: string) => void;
  onClear: () => void;
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
}

// Shows recent searches. Clicking a row re-runs that query; the clear button
// empties the persisted history.
export default function HistoryView({
  history,
  onRerun,
  onClear,
}: HistoryViewProps): ReactElement {
  if (history.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No search history</p>
        <p className="empty__hint">Words you search for will appear here.</p>
      </div>
    );
  }

  return (
    <section aria-label="Search history">
      <div className="view-header">
        <h2 className="view-title">History</h2>
        <button type="button" className="btn btn--ghost" onClick={onClear}>
          Clear all
        </button>
      </div>
      <ul className="entry-list">
        {history.map((item) => (
          <li key={`${item.query}-${item.timestamp}`} className="entry-row">
            <button
              type="button"
              className="entry-row__main"
              onClick={() => onRerun(item.query)}
            >
              <span className="entry-row__head" lang="bn">
                {item.query}
              </span>
              <span className="entry-row__gloss">{formatTime(item.timestamp)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
