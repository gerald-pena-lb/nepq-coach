import React from "react";

export default function MeetingControls({ status, onStart, onStop, isActive, isCapturing }) {
  const isMobile = window.innerWidth < 768;

  return (
    <div style={styles.container}>
      <div>
        <div style={styles.logo}>NEPQ Coach</div>
        {!isMobile && <div style={styles.subtitle}>Real-time AI sales coaching</div>}
      </div>

      <div style={{ flex: 1 }} />

      {!isActive && status?.status === "error" && (
        <div style={styles.error}>{status.message}</div>
      )}

      {isActive && status && (
        <div style={styles.status}>
          <span style={{
            ...styles.dot,
            background: isCapturing ? "#22c55e" : "#71717a",
            animation: isCapturing ? "pulse 1.5s infinite" : "none",
          }} />
          {status.message}
        </div>
      )}

      {!isActive ? (
        <button style={styles.startBtn} onClick={onStart}>
          Start Coaching
        </button>
      ) : (
        <button style={styles.stopBtn} onClick={onStop}>
          Stop
        </button>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </div>
  );
}

const styles = {
  container: {
    padding: "12px 16px",
    background: "#1a1a24",
    borderBottom: "1px solid #2a2a3a",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  logo: { fontSize: "18px", fontWeight: "700", color: "#818cf8" },
  subtitle: { fontSize: "11px", color: "#52525b" },
  error: { fontSize: "12px", color: "#ef4444", maxWidth: "300px" },
  status: { fontSize: "12px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "6px" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  startBtn: {
    padding: "8px 20px", borderRadius: "8px", border: "none",
    background: "#818cf8", color: "#fff", fontSize: "14px",
    fontWeight: "600", cursor: "pointer",
  },
  stopBtn: {
    padding: "8px 20px", borderRadius: "8px",
    border: "1px solid #ef4444", background: "transparent",
    color: "#ef4444", fontSize: "14px", fontWeight: "600", cursor: "pointer",
  },
};
