import React, { useEffect, useRef } from "react";

export default function Suggestions({ suggestions }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [suggestions]);

  const latest = suggestions.length > 0 ? suggestions[suggestions.length - 1] : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Say This Next</div>
      <div style={styles.content} ref={scrollRef}>
        {!latest ? (
          <div style={styles.empty}>
            NEPQ coaching suggestions will appear here once the conversation starts.
          </div>
        ) : (
          <div>
            <div style={styles.stage}>{latest.stage || "Coaching"}</div>

            {latest.suggestions?.map((sug, j) => (
              <div key={j} style={styles.card}>
                <div style={styles.sayThis}>"{sug.text}"</div>
                {sug.why && <div style={styles.why}>{sug.why}</div>}
              </div>
            ))}

            {latest.prospectSentiment && (
              <div style={styles.sentiment}>Prospect: {latest.prospectSentiment}</div>
            )}
            {latest.toneTip && (
              <div style={styles.tone}>Tip: {latest.toneTip}</div>
            )}

            {suggestions.length > 1 && (
              <div style={styles.history}>
                <div style={styles.historyLabel}>Previous suggestions</div>
                {suggestions.slice(0, -1).reverse().map((s, i) => (
                  <div key={i} style={styles.historyItem}>
                    {s.suggestions?.[0]?.text && `"${s.suggestions[0].text}"`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const isMobile = window.innerWidth < 768;

const styles = {
  container: {
    width: isMobile ? "100%" : "400px",
    display: "flex", flexDirection: "column", flexShrink: 0,
    borderLeft: isMobile ? "none" : "1px solid #2a2a3a",
    borderTop: isMobile ? "1px solid #2a2a3a" : "none",
  },
  header: {
    padding: "12px 16px", borderBottom: "1px solid #2a2a3a",
    fontSize: "13px", fontWeight: "600", color: "#22c55e",
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  content: { flex: 1, overflowY: "auto", padding: "12px 16px" },
  stage: {
    fontSize: "11px", fontWeight: "700", color: "#818cf8",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px",
  },
  card: { marginBottom: "12px" },
  sayThis: {
    fontSize: "16px", lineHeight: "1.5", color: "#f4f4f5", fontWeight: "500",
    padding: "12px 14px", background: "#1e1e2e", borderRadius: "8px",
    borderLeft: "3px solid #818cf8", marginBottom: "6px",
  },
  why: { fontSize: "12px", color: "#71717a", lineHeight: "1.4", paddingLeft: "14px" },
  sentiment: {
    fontSize: "12px", color: "#a78bfa", marginTop: "8px",
    padding: "8px 12px", background: "#1e1e2e", borderRadius: "6px",
  },
  tone: {
    fontSize: "12px", color: "#22d3ee", marginTop: "6px",
    padding: "8px 12px", background: "#0f2b2e", borderRadius: "6px",
  },
  empty: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    color: "#52525b", fontSize: "14px", textAlign: "center", padding: "20px",
  },
  history: { marginTop: "20px", paddingTop: "12px", borderTop: "1px solid #2a2a3a" },
  historyLabel: { fontSize: "11px", color: "#52525b", textTransform: "uppercase", marginBottom: "8px" },
  historyItem: { fontSize: "12px", color: "#71717a", marginBottom: "6px", fontStyle: "italic" },
};
