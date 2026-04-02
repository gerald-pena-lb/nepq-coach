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
  previousLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  previousCard: {
    background: 'var(--bg-card)',
    borderRadius: 8,
    borderLeft: '3px solid var(--border)',
    padding: '10px 12px',
    marginBottom: 8,
    opacity: 0.6,
  },
  previousText: {
    fontSize: 14,
    lineHeight: 1.4,
    color: 'var(--text)',
  },
  previousStage: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginBottom: 4,
  },
};

function SuggestionCard({ suggestion, isPrimary }) {
  if (!suggestion) return null;

  const s = suggestion.suggestions?.[0];
  if (!s) return null;

  if (!isPrimary) {
    return (
      <div style={styles.previousCard}>
        <div style={styles.previousStage}>{suggestion.stage}</div>
        <div style={styles.previousText}>&ldquo;{s.text}&rdquo;</div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={styles.card}>
      <div style={styles.stage}>{suggestion.stage}</div>
      <div style={styles.text}>&ldquo;{s.text}&rdquo;</div>
      {s.why && (
        <div style={styles.why}>
          <strong>Why it works:</strong> {s.why}
        </div>
      )}
      {suggestion.prospectSentiment && (
        <div style={styles.sentiment}>
          Prospect mood: {suggestion.prospectSentiment}
        </div>
      )}
    </div>
  );
}

export default function Suggestions({ suggestions, isActive, isProcessing }) {
  if (suggestions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          {isProcessing
            ? 'Analyzing conversation...'
            : isActive
              ? 'Waiting for the prospect to speak...'
              : 'Coaching suggestions will appear here during your call.'}
        </div>
      </div>
    );
  }

  const [latest, ...previous] = suggestions;
  const recentPrevious = previous.slice(0, 3);

  return (
    <div style={styles.container}>
      <SuggestionCard suggestion={latest} isPrimary />

      {recentPrevious.length > 0 && (
        <>
          <div style={styles.previousLabel}>Previous</div>
          {recentPrevious.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} isPrimary={false} />
          ))}
        </>
      )}
    </div>
  );
}
