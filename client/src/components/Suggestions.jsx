import React, { useEffect, useRef } from "react";

const styles = {
  container: {
    width: "420px",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
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
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  card: {
    background: "#1a1a24",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #2a2a3a",
  },
  stageLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#818cf8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  stageDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#818cf8",
  },
  suggestion: {
    marginBottom: "12px",
    paddingBottom: "12px",
    borderBottom: "1px solid #2a2a3a",
  },
  suggestionLast: {
    marginBottom: "0",
  },
  sayThis: {
    fontSize: "15px",
    lineHeight: "1.5",
    color: "#f4f4f5",
    fontWeight: "500",
    marginBottom: "6px",
    padding: "10px 14px",
    background: "#1e1e2e",
    borderRadius: "8px",
    borderLeft: "3px solid #818cf8",
  },
  why: {
    fontSize: "12px",
    color: "#71717a",
    lineHeight: "1.4",
    paddingLeft: "14px",
  },
  sentiment: {
    fontSize: "12px",
    color: "#a78bfa",
    marginTop: "8px",
    padding: "8px 12px",
    background: "#1e1e2e",
    borderRadius: "6px",
  },
  toneTip: {
    fontSize: "12px",
    color: "#22d3ee",
    marginTop: "6px",
    padding: "8px 12px",
    background: "#0f2b2e",
    borderRadius: "6px",
  },
  priority: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#52525b",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#52525b",
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
    lineHeight: "1.5",
  },
};

export default function Suggestions({ suggestions }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [suggestions]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>AI Coach Suggestions</div>
      <div style={styles.content} ref={scrollRef}>
        {suggestions.length === 0 ? (
          <div style={styles.empty}>
            Coaching suggestions will appear here as the conversation progresses.
            <br /><br />
            The AI will analyze what the prospect says and suggest NEPQ-based responses in real-time.
          </div>
        ) : (
          suggestions.map((s, i) => (
            <div key={i} style={styles.card}>
              <div style={styles.stageLabel}>
                <span style={styles.stageDot} />
                {s.stage || "Analyzing..."}
              </div>

              {s.suggestions?.map((sug, j) => (
                <div
                  key={j}
                  style={
                    j === (s.suggestions.length - 1)
                      ? styles.suggestionLast
                      : styles.suggestion
                  }
                >
                  <div style={styles.priority}>
                    {sug.priority === 1 ? "Best response" : `Option ${sug.priority}`}
                  </div>
                  <div style={styles.sayThis}>"{sug.text}"</div>
                  {sug.why && <div style={styles.why}>{sug.why}</div>}
                </div>
              ))}

              {s.prospectSentiment && (
                <div style={styles.sentiment}>
                  Prospect mood: {s.prospectSentiment}
                </div>
              )}

              {s.toneTip && (
                <div style={styles.toneTip}>
                  Delivery tip: {s.toneTip}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
