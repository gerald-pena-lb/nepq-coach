import React, { useEffect, useRef } from "react";

export default function Suggestions({ suggestions }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [suggestions]);

  const latest = suggestions.length > 0 ? suggestions[suggestions.length - 1] : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #2a2a3a",
        fontSize: "13px", fontWeight: "600", color: "#22c55e",
        textTransform: "uppercase", letterSpacing: "0.05em",
        display: window.innerWidth < 768 ? "none" : "block",
      }}>
        Say This Next
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {!latest ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#52525b", fontSize: "15px", textAlign: "center", padding: "20px", lineHeight: "1.6" }}>
            NEPQ coaching suggestions will appear here once the conversation gets going.
            <br /><br />
            Speak for 10+ seconds so the AI has enough context.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              {latest.stage || "Coaching"}
            </div>

            {latest.suggestions?.map((sug, j) => (
              <div key={j} style={{ marginBottom: "16px" }}>
                <div style={{
                  fontSize: "18px", lineHeight: "1.6", color: "#f4f4f5", fontWeight: "500",
                  padding: "16px", background: "#1e1e2e", borderRadius: "10px",
                  borderLeft: "4px solid #818cf8", marginBottom: "8px",
                }}>
                  "{sug.text}"
                </div>
                {sug.why && (
                  <div style={{ fontSize: "13px", color: "#71717a", lineHeight: "1.5", paddingLeft: "16px" }}>
                    {sug.why}
                  </div>
                )}
              </div>
            ))}

            {latest.prospectSentiment && (
              <div style={{ fontSize: "13px", color: "#a78bfa", marginTop: "12px", padding: "10px 14px", background: "#1e1e2e", borderRadius: "8px" }}>
                Prospect mood: {latest.prospectSentiment}
              </div>
            )}
            {latest.toneTip && (
              <div style={{ fontSize: "13px", color: "#22d3ee", marginTop: "8px", padding: "10px 14px", background: "#0f2b2e", borderRadius: "8px" }}>
                Delivery tip: {latest.toneTip}
              </div>
            )}

            {suggestions.length > 1 && (
              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #2a2a3a" }}>
                <div style={{ fontSize: "11px", color: "#52525b", textTransform: "uppercase", marginBottom: "10px" }}>Previous</div>
                {suggestions.slice(0, -1).reverse().slice(0, 3).map((s, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "#71717a", marginBottom: "8px", fontStyle: "italic", padding: "8px 12px", background: "#13131a", borderRadius: "6px" }}>
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
