'use client';

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
    lineHeight: 1.5,
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    borderLeft: '4px solid var(--accent)',
    border: '1px solid var(--border)',
    padding: 16,
    marginBottom: 12,
    boxShadow: 'var(--shadow-sm)',
  },
  stage: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.4,
    marginBottom: 10,
    color: 'var(--text)',
  },
  why: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
  sentiment: {
    fontSize: 12,
    color: 'var(--orange)',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  deeperBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--orange)',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

export default function Suggestions({ suggestions, isActive, isProcessing, hasCandidatesReady, onGoDeeper }) {
  if (suggestions.length === 0) {
    let message;
    if (isProcessing) {
      message = 'Jeremy is thinking...';
    } else if (!isActive) {
      message = 'Coaching suggestions will appear here during your call.';
    } else if (hasCandidatesReady) {
      message = 'Suggestion ready — tap SUGGEST to see it.';
    } else {
      message = 'Listening... tap SUGGEST when you need coaching.';
    }

    return (
      <div style={styles.container}>
        <div style={styles.empty}>{message}</div>
      </div>
    );
  }

  const [latest] = suggestions;
  const s = latest?.suggestions?.[0];
  if (!s) return null;

  return (
    <div style={styles.container}>
      <div className="fade-in" style={styles.card}>
        <div style={styles.stage}>{latest.stage}</div>
        <div style={styles.text}>&ldquo;{s.text}&rdquo;</div>
        {latest.prospectSentiment && (
          <div style={styles.sentiment}>
            Prospect mood: {latest.prospectSentiment}
          </div>
        )}
        {s.why && (
          <div style={styles.why}>
            <strong>Why it works:</strong> {s.why}
          </div>
        )}
        <button
          style={{
            ...styles.deeperBtn,
            opacity: isProcessing ? 0.5 : 1,
          }}
          onClick={onGoDeeper}
          disabled={isProcessing}
        >
          {isProcessing ? 'Thinking...' : 'Go Deeper'}
        </button>
      </div>
    </div>
  );
}
