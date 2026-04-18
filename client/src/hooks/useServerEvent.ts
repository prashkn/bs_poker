import { useContext, useEffect, useRef } from "react";
import type { ServerEvent, ServerEventMap } from "@/types";
import { RoomContext } from "./useRoom";

export function useServerEvent<K extends ServerEvent>(
  event: K,
  handler: (payload: ServerEventMap[K]) => void,
) {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useServerEvent must be used inside <RoomProvider>");
  }
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    return ctx.emitter.on(event, (payload) => ref.current(payload));
  }, [event, ctx.emitter]);
}
