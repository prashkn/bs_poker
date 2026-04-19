import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { AvatarImg } from "@/components/game/primitives";
import { useChat, usePlayers } from "@/hooks/useRoom";
import { useServerEvent } from "@/hooks/useServerEvent";

interface ChatEntry {
  playerId: string;
  name: string;
  text: string;
  isMe: boolean;
}

export default function InlineChat() {
  const { connected, send } = useChat();
  const { players, playerId } = usePlayers();
  const myName = players.find((p) => p.id === playerId)?.name ?? "you";
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useServerEvent("chat_received", ({ player_id, name, text: msg }) => {
    setEntries((prev) => [
      ...prev,
      { playerId: player_id, name, text: msg, isMe: false },
    ]);
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    send("chat", { text: trimmed });
    setEntries((prev) => [
      ...prev,
      { playerId, name: myName, text: trimmed, isMe: true },
    ]);
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-muted flex flex-col gap-1.5 pr-1"
      >
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            Quiet table.
          </div>
        ) : (
          entries.map((m, i) => (
            <div
              key={i}
              className={`chat-message-in flex gap-1.5 ${
                m.isMe ? "justify-end" : "justify-start"
              }`}
            >
              {!m.isMe && (
                <AvatarImg
                  seed={m.playerId}
                  name={m.name}
                  size={18}
                  className="mt-0.5 self-start"
                />
              )}
              <div
                className={`flex max-w-[80%] flex-col ${
                  m.isMe ? "items-end" : "items-start"
                }`}
              >
                {!m.isMe && (
                  <span className="text-[9px] text-muted-foreground px-1 leading-none mb-0.5">
                    {m.name}
                  </span>
                )}
                <div
                  className={`rounded-xl px-2.5 py-1 text-xs leading-snug break-words ${
                    m.isMe ? "bg-zinc-200 text-zinc-950" : "bg-secondary"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="mt-2 flex gap-1.5 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
          disabled={!connected}
          className="h-8 flex-1 rounded-md border border-input bg-transparent px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!connected || !text.trim()}
          aria-label="Send message"
          className="flex h-8 items-center justify-center rounded-md bg-primary px-2.5 text-primary-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          <Send className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}
