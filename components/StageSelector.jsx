'use client';

import { STAGES } from '@/lib/salesFramework';

const styles = {
  container: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  pill: {
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    transition: 'all 0.15s',
  },
  pillActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#fff',
  },
};

export default function StageSelector({ activeStage, onSelect, disabled }) {
  return (
    <div style={styles.container}>
      {STAGES.map((stage) => (
        <button
          key={stage.id}
          style={{
            ...styles.pill,
            ...(activeStage === stage.id ? styles.pillActive : {}),
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => onSelect(stage.id)}
          disabled={disabled}
        >
          {stage.label}
        </button>
      ))}
    </div>
  );
}
