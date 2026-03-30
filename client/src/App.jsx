import React, { useState, useEffect, useCallback } from "react";
import MeetingControls from "./components/MeetingControls.jsx";
import Transcript from "./components/Transcript.jsx";
import Suggestions from "./components/Suggestions.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useAudioCapture } from "./hooks/useAudioCapture.js";

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

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.host}`;

export default function App() {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState(null);
  const [isActive, setIsActive] = useState(false);

  const { isConnected, on, send, sendBinary } = useWebSocket(WS_URL);

  const { isCapturing, start: startCapture, stop: stopCapture } = useAudioCapture({
    onAudioData: (buffer) => {
      sendBinary(buffer);
    },
  });

  useEffect(() => {
    on("transcript", (data) => {
      if (data.text) {
        setTranscripts((prev) => {
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
    });

    on("error", (data) => {
      console.error("[Error]", data.message);
      setStatus({ status: "error", message: data.message });
    });
  }, [on]);

  const handleStart = useCallback(async () => {
    try {
      setTranscripts([]);
      setSuggestions([]);

      // 1. Tell server to start a coaching session (opens ElevenLabs STT connection)
      send("start");
      setStatus({ status: "starting", message: "Initializing..." });

      // 2. Small delay to let the server connect to ElevenLabs
      await new Promise((r) => setTimeout(r, 1000));

      // 3. Prompt user to share their Google Meet tab audio
      setStatus({ status: "sharing", message: "Select your Google Meet tab and check 'Share audio'" });
      await startCapture();

      setIsActive(true);
      setStatus({ status: "active", message: "Listening — coaching is live" });
    } catch (err) {
      setStatus({
        status: "error",
        message: err.name === "NotAllowedError"
          ? "Tab sharing was cancelled. Click Start to try again."
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
    setStatus({ status: "stopped", message: "Coaching session ended" });
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
      <div style={styles.wsIndicator}>
        <span style={styles.wsDot(isConnected)} />
        {isConnected ? "Connected" : "Reconnecting..."}
      </div>
    </div>
  );
}
