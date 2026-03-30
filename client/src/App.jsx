import React, { useState, useEffect, useCallback } from "react";
import MeetingControls from "./components/MeetingControls.jsx";
import Transcript from "./components/Transcript.jsx";
import Suggestions from "./components/Suggestions.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";

const styles = {
  app: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0f0f13",
  },
  main: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  wsIndicator: {
    position: "fixed",
    bottom: "12px",
    right: "12px",
    fontSize: "11px",
    color: "#52525b",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  wsDot: (connected) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: connected ? "#22c55e" : "#ef4444",
  }),
};

const WS_URL = `ws://${window.location.hostname}:${window.location.port || 3001}`;

export default function App() {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState(null);
  const [isInMeeting, setIsInMeeting] = useState(false);

  const { isConnected, on } = useWebSocket(WS_URL);

  useEffect(() => {
    on("transcript", (data) => {
      if (data.text) {
        setTranscripts((prev) => {
          // If interim result, update the last entry if it was also interim
          if (!data.isFinal && prev.length > 0 && !prev[prev.length - 1].isFinal) {
            return [...prev.slice(0, -1), data];
          }
          return [...prev, data];
        });
      }
    });

    on("suggestion", (data) => {
      setSuggestions((prev) => [...prev, data]);
    });

    on("status", (data) => {
      setStatus(data);
      if (data.status === "connected" || data.status === "capturing") {
        setIsInMeeting(true);
      }
      if (data.status === "disconnected") {
        setIsInMeeting(false);
      }
    });

    on("error", (data) => {
      console.error("[Error]", data.message);
      setStatus({ status: "error", message: data.message });
    });
  }, [on]);

  const handleJoin = useCallback(async (meetingUrl) => {
    try {
      setStatus({ status: "launching", message: "Starting bot..." });
      setIsInMeeting(true);
      setTranscripts([]);
      setSuggestions([]);

      const res = await fetch("/api/meeting/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus({ status: "error", message: data.error });
        setIsInMeeting(false);
      }
    } catch (err) {
      setStatus({ status: "error", message: err.message });
      setIsInMeeting(false);
    }
  }, []);

  const handleLeave = useCallback(async () => {
    try {
      await fetch("/api/meeting/leave", { method: "POST" });
      setIsInMeeting(false);
      setStatus({ status: "disconnected", message: "Left the meeting" });
    } catch (err) {
      console.error("Leave error:", err);
    }
  }, []);

  return (
    <div style={styles.app}>
      <MeetingControls
        status={status}
        onJoin={handleJoin}
        onLeave={handleLeave}
        isInMeeting={isInMeeting}
      />
      <div style={styles.main}>
        <Transcript transcripts={transcripts} />
        <Suggestions suggestions={suggestions} />
      </div>
      <div style={styles.wsIndicator}>
        <span style={styles.wsDot(isConnected)} />
        {isConnected ? "Live" : "Reconnecting..."}
      </div>
    </div>
  );
}
