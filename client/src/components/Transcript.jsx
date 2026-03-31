import React, { useEffect, useRef } from "react";

export default function Transcript({ transcripts }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>Live Transcript</div>
      <div style={styles.messages} ref={scrollRef}>
        {transcripts.length === 0 ? (
          <div style={styles.empty}>Place this device near your meeting and click Start Coaching.</div>
        ) : (
          transcripts.map((t, i) => (
            <div key={i} style={styles.message}>
              <div style={styles.text}>{t.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  header: {
    padding: "12px 16px", borderBottom: "1px solid #2a2a3a",
    fontSize: "13px", fontWeight: "600", color: "#a1a1aa",
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  messages: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  message: { display: "flex", flexDirection: "column", gap: "2px" },
  text: { fontSize: "14px", lineHeight: "1.5", color: "#e4e4e7" },
  empty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontSize: "14px", textAlign: "center", padding: "20px" },
};
