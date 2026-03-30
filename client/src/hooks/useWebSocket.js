import { useEffect, useRef, useCallback, useState } from "react";

export function useWebSocket(url) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef({});
  const reconnectTimer = useRef(null);

  const on = useCallback((event, handler) => {
    handlersRef.current[event] = handler;
  }, []);

  const send = useCallback((event, data) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event, data }));
    }
  }, []);

  const sendBinary = useCallback((buffer) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(buffer);
    }
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const { event: eventName, data } = JSON.parse(event.data);
          const handler = handlersRef.current[eventName];
          if (handler) handler(data);
        } catch (err) {
          console.error("[WS] Parse error:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [url]);

  return { isConnected, on, send, sendBinary };
}
