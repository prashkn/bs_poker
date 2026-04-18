import { useEffect, useRef, useState, useCallback } from "react";

export interface WSMessage {
  event: string;
  payload: Record<string, unknown>;
}

export function useWebSocket(roomId: string, playerId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const qp = new URLSearchParams({ player_id: playerId });

    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/${roomId}?${qp.toString()}`
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
    }
  }, []);

  return { messages, connected, send };
}
