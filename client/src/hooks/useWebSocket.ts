import { useEffect, useRef, useState, useCallback } from "react";

export interface WSMessage {
  event: string;
  payload: Record<string, unknown>;
}

export type Direction = "incoming" | "outgoing";

export interface LogEntry {
  direction: Direction;
  message: WSMessage;
  timestamp: number;
}

export type ConnectParams =
  | { type: "reconnect"; playerId: string }
  | { type: "join"; playerName: string; password: string };

export function useWebSocket(roomId: string, params: ConnectParams | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string | null>(
    params?.type === "reconnect" ? params.playerId : null
  );

  useEffect(() => {
    if (!roomId || !params) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const qp = new URLSearchParams();

    if (params.type === "reconnect") {
      qp.set("player_id", params.playerId);
    } else {
      qp.set("player_name", params.playerName);
      qp.set("password", params.password);
    }

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

        // For new joins, discover our player_id from the first room_state
        if (params.type === "join" && msg.event === "room_state") {
          const players = msg.payload.players as Array<{ id: string; name: string }>;
          const me = players.find((p) => p.name === params.playerName);
          if (me) {
            setResolvedPlayerId(me.id);
            sessionStorage.setItem(`player_id:${roomId}`, me.id);
            sessionStorage.removeItem(`join_name:${roomId}`);
            sessionStorage.removeItem(`join_password:${roomId}`);
          }
        }

        setMessages((prev) => [...prev, msg]);
        setLog((prev) => [
          ...prev,
          { direction: "incoming", message: msg, timestamp: Date.now() },
        ]);
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
  }, [roomId, params]);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      setLog((prev) => [
        ...prev,
        { direction: "outgoing", message: msg, timestamp: Date.now() },
      ]);
    }
  }, []);

  return { messages, log, connected, send, playerId: resolvedPlayerId };
}
