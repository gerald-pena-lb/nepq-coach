import React, { useEffect, useRef } from "react";

const styles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #2a2a3a",
    minWidth: 0,
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #2a2a3a",
    fontSize: "14px",
    fontWeight: "600",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  message: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  speaker: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#818cf8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  text: {
    fontSize: "15px",
    lineHeight: "1.5",
    color: "#e4e4e7",
  },
  interim: {
    fontSize: "15px",
    lineHeight: "1.5",
    color: "#71717a",
    fontStyle: "italic",
  },
  timestamp: {
    fontSize: "11px",
    color: "#52525b",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#52525b",
    fontSize: "14px",
  },
};

export default function Transcript({ transcripts }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>Live Transcript</div>
      <div style={styles.messages} ref={scrollRef}>
        {transcripts.length === 0 ? (
          <div style={styles.empty}>
            Waiting for conversation... Join a meeting to start.
          </div>
        ) : (
          transcripts.map((t, i) => (
            <div key={i} style={styles.message}>
              <div style={styles.speaker}>
                {t.speaker === 0 ? "Prospect" : `Speaker ${t.speaker}`}
                <span style={styles.timestamp}> {formatTime(t.timestamp)}</span>
              </div>
              <div style={t.isFinal ? styles.text : styles.interim}>{t.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
