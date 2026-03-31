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

  const { isConnected, on, send, sendBinary } = useWebSocket(WS_URL);
  const { isCapturing, start: startCapture, stop: stopCapture } = useAudioCapture({
    onAudioData: (buffer) => sendBinary(buffer),
  });

  useEffect(() => {
    on("transcript", (data) => {
      if (data.text) {
        setTranscripts((prev) => [...prev, data]);
      }
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

  return (
    <div style={styles.app}>
      <MeetingControls
        status={status}
        onStart={handleStart}
        onStop={handleStop}
        isActive={isActive}
        isCapturing={isCapturing}
      />
      <div style={styles.main}>
        <Transcript transcripts={transcripts} />
        <Suggestions suggestions={suggestions} />
      </div>
      <div style={styles.indicator}>
        <span style={{ ...styles.dot, background: isConnected ? "#22c55e" : "#ef4444" }} />
        {isConnected ? "Connected" : "Reconnecting..."}
      </div>
    </div>
  );
}

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
    flexDirection: window.innerWidth < 768 ? "column" : "row",
  },
  indicator: {
    position: "fixed",
    bottom: "8px",
    right: "12px",
    fontSize: "11px",
    color: "#52525b",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },
};
