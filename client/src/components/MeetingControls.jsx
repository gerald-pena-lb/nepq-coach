import React from "react";

const styles = {
  container: {
    padding: "20px 24px",
    background: "#1a1a24",
    borderBottom: "1px solid #2a2a3a",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  logo: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#818cf8",
    whiteSpace: "nowrap",
  },
  subtitle: {
    fontSize: "12px",
    color: "#52525b",
    whiteSpace: "nowrap",
  },
  spacer: {
    flex: 1,
  },
  startBtn: {
    padding: "10px 28px",
    borderRadius: "8px",
    border: "none",
    background: "#818cf8",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  stopBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "1px solid #ef4444",
    background: "transparent",
    color: "#ef4444",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  status: {
    fontSize: "13px",
    color: "#a1a1aa",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
  },
  dot: (color) => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    flexShrink: 0,
  }),
  pulse: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    display: "inline-block",
    flexShrink: 0,
    animation: "pulse 1.5s infinite",
  },
  steps: {
    fontSize: "12px",
    color: "#71717a",
    lineHeight: "1.6",
  },
};

const statusColors = {
  active: "#22c55e",
  ready: "#22c55e",
  starting: "#eab308",
  sharing: "#eab308",
  error: "#ef4444",
  stopped: "#71717a",
};

export default function MeetingControls({ status, onStart, onStop, isActive, isCapturing }) {
  return (
    <div style={styles.container}>
      <div>
        <div style={styles.logo}>NEPQ Coach</div>
        <div style={styles.subtitle}>Real-time AI sales coaching</div>
      </div>

      <div style={styles.spacer} />

      {isActive && status && (
        <div style={styles.status}>
          {isCapturing ? (
            <span style={styles.pulse} />
          ) : (
            <span style={styles.dot(statusColors[status?.status] || "#71717a")} />
          )}
          {status?.message}
        </div>
      )}

      {!isActive ? (
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={styles.steps}>
            1. Open your Google Meet in another tab &nbsp;→&nbsp; 2. Click Start &nbsp;→&nbsp; 3. Share that tab with audio
          </div>
          <button style={styles.startBtn} onClick={onStart}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Start Coaching
          </button>
        </div>
      ) : (
        <button style={styles.stopBtn} onClick={onStop}>
          Stop
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
