import { useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:3000';

/**
 * Connects to the backend WebSocket and calls onMessage(parsedData)
 * for every incoming message. Reconnects automatically after 3 s if
 * the connection drops.
 */
export const useWebSocket = (onMessage) => {
  const onMsgRef  = useRef(onMessage);
  const unmounted = useRef(false);

  // Keep callback ref fresh without re-running the effect
  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    unmounted.current = false;
    let ws;

    const connect = () => {
      if (unmounted.current) return;
      ws = new WebSocket(WS_URL);

      ws.onmessage = (e) => {
        try {
          onMsgRef.current(JSON.parse(e.data));
        } catch {}
      };

      ws.onclose = () => {
        if (!unmounted.current) setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      unmounted.current = true;
      if (ws) {
        ws.onclose = null; // prevent reconnect loop on intentional unmount
        ws.close();
      }
    };
  }, []);
};
