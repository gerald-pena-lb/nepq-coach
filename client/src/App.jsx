import React, { useState, useEffect, useCallback } from "react";
import MeetingControls from "./components/MeetingControls.jsx";
import Transcript from "./components/Transcript.jsx";
import Suggestions from "./components/Suggestions.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useAudioCapture } from "./hooks/useAudioCapture.js";

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.host}`;

export default function App() {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [tab, setTab] = useState("coach"); // mobile tab: "coach" or "transcript"

  const { isConnected, on, send, sendBinary } = useWebSocket(WS_URL);
  const { isCapturing, start: startCapture, stop: stopCapture } = useAudioCapture({
    onAudioData: (buffer) => sendBinary(buffer),
  });

  useEffect(() => {
    on("transcript", (data) => {
      if (data.text) setTranscripts((prev) => [...prev, data]);
    });
    on("suggestion", (data) => setSuggestions((prev) => [...prev, data]));
    on("status", (data) => setStatus(data));
    on("error", (data) => {
      console.error("[Error]", data.message);
      setStatus({ status: "error", message: data.message });
    });
  }, [on]);

  const handleStart = useCallback(async () => {
    try {
      setTranscripts([]);
      setSuggestions([]);
      send("start");
      await startCapture();
      setIsActive(true);
      setStatus({ status: "active", message: "Listening..." });
    } catch (err) {
      setStatus({
        status: "error",
        message: err.name === "NotAllowedError"
          ? "Microphone access denied. Allow mic and try again."
          : err.message,
      });
      send("stop");
      setIsActive(false);
    }
  }, [send, startCapture]);

  const handleStop = useCallback(() => {
    stopCapture();
    send("stop");
    setIsActive(false);
    setStatus({ status: "stopped", message: "Session ended" });
  }, [send, stopCapture]);

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f0f13" }}>
      <MeetingControls
        status={status}
        onStart={handleStart}
        onStop={handleStop}
        isActive={isActive}
        isCapturing={isCapturing}
      />

      {isMobile && isActive && (
        <div style={{ display: "flex", borderBottom: "1px solid #2a2a3a", background: "#1a1a24" }}>
          <button
            onClick={() => setTab("coach")}
            style={{
              flex: 1, padding: "10px", border: "none", cursor: "pointer",
              background: tab === "coach" ? "#818cf8" : "transparent",
              color: tab === "coach" ? "#fff" : "#71717a",
              fontSize: "13px", fontWeight: "600",
            }}
          >
            SAY THIS NEXT
          </button>
          <button
            onClick={() => setTab("transcript")}
            style={{
              flex: 1, padding: "10px", border: "none", cursor: "pointer",
              background: tab === "transcript" ? "#818cf8" : "transparent",
              color: tab === "transcript" ? "#fff" : "#71717a",
              fontSize: "13px", fontWeight: "600",
            }}
          >
            TRANSCRIPT
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
        {isMobile ? (
          tab === "coach" ? <Suggestions suggestions={suggestions} /> : <Transcript transcripts={transcripts} />
        ) : (
          <>
            <Transcript transcripts={transcripts} />
            <Suggestions suggestions={suggestions} />
          </>
        )}
      </div>

      <div style={{ position: "fixed", bottom: "8px", right: "12px", fontSize: "11px", color: "#52525b", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isConnected ? "#22c55e" : "#ef4444" }} />
        {isConnected ? "Connected" : "Reconnecting..."}
      </div>
    </div>
  );
}
