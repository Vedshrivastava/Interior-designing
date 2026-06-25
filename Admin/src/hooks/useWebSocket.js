import { useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:3000';

/**
 * Connects to the backend WebSocket and calls onMessage(parsedData)
 * for every incoming message. Auto-reconnects after 3 s if the
 * connection drops — identical behaviour to the frontend hook.
 */
export const useWebSocket = (onMessage) => {
    const onMsgRef  = useRef(onMessage);
    const unmounted = useRef(false);

    useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);

    useEffect(() => {
        unmounted.current = false;
        let ws;

        const connect = () => {
            if (unmounted.current) return;
            ws = new WebSocket(WS_URL);

            ws.onmessage = (e) => {
                try { onMsgRef.current(JSON.parse(e.data)); } catch {}
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
                ws.onclose = null;
                ws.close();
            }
        };
    }, []);
};
