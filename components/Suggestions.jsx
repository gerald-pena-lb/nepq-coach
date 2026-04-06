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
    padding: 16,
    marginBottom: 12,
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
    lineHeight: 1.4,
    marginBottom: 8,
  },
  sentiment: {
    fontSize: 12,
    color: 'var(--orange)',
    fontStyle: 'italic',
  },
};

export default function Suggestions({ suggestions, isActive, isProcessing, mode }) {
  if (suggestions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          {isProcessing
            ? 'Generating suggestion...'
            : !isActive
              ? 'Coaching suggestions will appear here during your call.'
              : mode === 'listen'
                ? 'Listening... tap SUGGEST when you need coaching.'
                : 'Tap SUGGEST to get a coaching recommendation.'}
        </div>
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
        {s.why && (
          <div style={styles.why}>
            <strong>Why it works:</strong> {s.why}
          </div>
        )}
        {latest.prospectSentiment && (
          <div style={styles.sentiment}>
            Prospect mood: {latest.prospectSentiment}
          </div>
        )}
      </div>
    </div>
  );
}
