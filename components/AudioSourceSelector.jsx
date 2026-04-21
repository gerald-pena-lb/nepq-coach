'use client';

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
  },
  modal: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    padding: 24,
    maxWidth: 400,
    width: '100%',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    textAlign: 'left',
    marginBottom: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--text)',
    transition: 'all 0.15s',
  },
  btnLabel: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 2,
  },
  btnDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  cancel: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    background: 'transparent',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 4,
  },
};

export default function AudioSourceSelector({ onSelectMic, onSelectTab, onCancel }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>Choose Audio Source</div>
        <div style={styles.subtitle}>
          How should Jeremy hear the conversation?
        </div>

        <button
          style={styles.btn}
          onClick={onSelectMic}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
        >
          <span style={styles.btnLabel}>Microphone</span>
          <span style={styles.btnDesc}>
            Place this device near your laptop to pick up both sides of the call
          </span>
        </button>

        <button
          style={styles.btn}
          onClick={onSelectTab}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
        >
          <span style={styles.btnLabel}>Browser Tab Audio</span>
          <span style={styles.btnDesc}>
            Share audio directly from your Google Meet tab (desktop Chrome only)
          </span>
        </button>

        <button style={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
