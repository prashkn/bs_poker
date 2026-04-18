import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClientEvent,
  ClientEventMap,
  ServerEvent,
  ServerEventMap,
} from "@/types";

export class TypedEmitter<M> {
  private listeners = new Map<keyof M, Set<(payload: unknown) => void>>();

  on<K extends keyof M>(event: K, handler: (payload: M[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = (p: unknown) => handler(p as M[K]);
    set.add(wrapped);
    return () => {
      this.listeners.get(event)?.delete(wrapped);
    };
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}

export type ServerEmitter = TypedEmitter<ServerEventMap>;

export type SendFn = <K extends ClientEvent>(
  event: K,
  payload: ClientEventMap[K],
) => void;

export function useWebSocket(roomId: string, playerId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const emitter = useMemo<ServerEmitter>(() => new TypedEmitter<ServerEventMap>(), []);
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
        const msg = JSON.parse(event.data) as {
          event: ServerEvent;
          payload: unknown;
        };
        emitter.emit(msg.event, msg.payload as ServerEventMap[ServerEvent]);
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
  }, [roomId, playerId, emitter]);

  const send = useCallback<SendFn>((event, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    }
  }, []);

  return { emitter, connected, send };
}
