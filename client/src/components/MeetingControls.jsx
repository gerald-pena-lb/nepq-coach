import React, { useState } from "react";

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
  input: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #3a3a4a",
    background: "#0f0f13",
    color: "#e4e4e7",
    fontSize: "14px",
    outline: "none",
  },
  joinBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "none",
    background: "#818cf8",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  leaveBtn: {
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
    fontSize: "12px",
    color: "#71717a",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
  },
  dot: (color) => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: color,
    display: "inline-block",
  }),
};

export default function MeetingControls({ status, onJoin, onLeave, isInMeeting }) {
  const [meetingUrl, setMeetingUrl] = useState("");

  const handleJoin = () => {
    if (meetingUrl.trim()) {
      onJoin(meetingUrl.trim());
    }
  };

  const statusColor = {
    connected: "#22c55e",
    capturing: "#22c55e",
    joining: "#eab308",
    launching: "#eab308",
    navigating: "#eab308",
    warning: "#f97316",
    error: "#ef4444",
    disconnected: "#71717a",
  };

  return (
    <div style={styles.container}>
      <div style={styles.logo}>NEPQ Coach</div>

      {!isInMeeting ? (
        <>
          <input
            style={styles.input}
            type="text"
            placeholder="Paste your Google Meet link here..."
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button style={styles.joinBtn} onClick={handleJoin}>
            Join Meeting
          </button>
        </>
      ) : (
        <>
          <div style={styles.status}>
            <span style={styles.dot(statusColor[status?.status] || "#71717a")} />
            {status?.message || "Connected"}
          </div>
          <div style={{ flex: 1 }} />
          <button style={styles.leaveBtn} onClick={onLeave}>
            Leave Meeting
          </button>
        </>
      )}
    </div>
  );
}
