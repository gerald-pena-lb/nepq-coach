import { useEffect, useRef, useCallback, useState } from "react";

export function useWebSocket(url) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef({});

  const on = useCallback((event, handler) => {
    handlersRef.current[event] = handler;
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onmessage = (event) => {
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
        // Reconnect after 2s
        setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { isConnected, on };
}
