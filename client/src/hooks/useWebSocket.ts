import { useEffect, useRef, useState, useCallback } from "react";

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export type Direction = "incoming" | "outgoing";

export interface LogEntry {
  direction: Direction;
  message: WSMessage;
  timestamp: number;
}

export function useWebSocket(roomId: string, playerId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/${roomId}?player_id=${playerId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[ws] connected to", ws.url);
      setConnected(true);
    };

    ws.onerror = (event) => {
      console.error("[ws] error:", event);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
        setLog((prev) => [...prev, { direction: "incoming", message: msg, timestamp: Date.now() }]);
      } catch {
        console.error("failed to parse ws message:", event.data);
      }
    };

    ws.onclose = (event) => {
      console.log("[ws] closed, code:", event.code, "reason:", event.reason);
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [roomId, playerId]);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      setLog((prev) => [...prev, { direction: "outgoing", message: msg, timestamp: Date.now() }]);
    }
  }, []);

  return { messages, log, connected, send };
}
