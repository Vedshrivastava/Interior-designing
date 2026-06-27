import { useEffect, useRef } from 'react';

const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/^http/, 'ws');

/**
 * Connects to the backend WebSocket, calls onMessage(data) for every
 * message, and auto-reconnects with exponential backoff (500ms → 10s max).
 */
export const useWebSocket = (onMessage) => {
    const cbRef    = useRef(onMessage);
    const wsRef    = useRef(null);
    const aliveRef = useRef(true);
    const delayRef = useRef(500);

    // Keep callback ref fresh without re-running the connection effect
    useEffect(() => { cbRef.current = onMessage; }, [onMessage]);

    useEffect(() => {
        aliveRef.current = true;
        delayRef.current = 500;

        const connect = () => {
            if (!aliveRef.current) return;

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                delayRef.current = 500; // reset backoff on success
            };

            ws.onmessage = (e) => {
                try { cbRef.current(JSON.parse(e.data)); } catch {}
            };

            ws.onclose = () => {
                if (!aliveRef.current) return;
                const wait = delayRef.current;
                delayRef.current = Math.min(wait * 2, 10000);
                setTimeout(connect, wait);
            };

            ws.onerror = () => ws.close();
        };

        connect();

        return () => {
            aliveRef.current = false;
            const ws = wsRef.current;
            if (ws) {
                ws.onopen    = null;
                ws.onmessage = null;
                ws.onclose   = null;
                ws.onerror   = null;
                ws.close();
            }
        };
    }, []);
};
