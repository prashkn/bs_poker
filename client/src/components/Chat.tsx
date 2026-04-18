import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChat, usePlayers } from "@/hooks/useRoom";
import { avatarUrl } from "@/lib/avatar";

interface ChatEntry {
  playerId: string;
  name: string;
  text: string;
  isMe: boolean;
}

interface MessageGroup {
  playerId: string;
  name: string;
  isMe: boolean;
  texts: string[];
}

function groupMessages(entries: ChatEntry[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.playerId === e.playerId) {
      last.texts.push(e.text);
    } else {
      groups.push({
        playerId: e.playerId,
        name: e.name,
        isMe: e.isMe,
        texts: [e.text],
      });
    }
  }
  return groups;
}

export default function Chat() {
  const { messages, connected, send } = useChat();
  const { players, playerId } = usePlayers();
  const myName = players.find((p) => p.id === playerId)?.name ?? "you";
  const [chatInput, setChatInput] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleSendChat(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    send({ event: "chat", payload: { text } });
    setEntries((prev) => [...prev, { playerId, name: myName, text, isMe: true }]);
    setChatInput("");
  }

  const lastProcessed = useRef(0);
  useEffect(() => {
    const newMessages = messages.slice(lastProcessed.current);
    lastProcessed.current = messages.length;
    for (const msg of newMessages) {
      if (msg.event !== "chat_received") continue;
      setEntries((prev) => [
        ...prev,
        {
          playerId: msg.payload.player_id as string,
          name: msg.payload.name as string,
          text: msg.payload.text as string,
          isMe: false,
        },
      ]);
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const groups = groupMessages(entries);

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="scroll-muted flex flex-col gap-3 h-full overflow-y-auto pr-1"
        >
          {entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="text-sm font-medium text-foreground">Quiet table.</p>
              <p className="text-xs text-muted-foreground">
                Someone has to break first.
              </p>
            </div>
          ) : (
            groups.map((g, gi) => (
              <div
                key={gi}
                className={`flex items-end gap-2 ${
                  g.isMe ? "justify-end" : "justify-start"
                }`}
              >
                {!g.isMe && (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={avatarUrl(g.playerId)} alt={g.name} />
                    <AvatarFallback>{g.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`flex min-w-0 max-w-[75%] flex-col gap-0.5 ${
                    g.isMe ? "items-end" : "items-start"
                  }`}
                >
                  {!g.isMe && (
                    <span className="px-1 text-xs font-medium text-muted-foreground">
                      {g.name}
                    </span>
                  )}
                  {g.texts.map((t, ti) => (
                    <div
                      key={ti}
                      className={`chat-message-in break-words rounded-2xl px-3 py-1.5 text-sm leading-snug ${
                        g.isMe
                          ? "bg-zinc-300 text-zinc-950"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSendChat} className="flex w-full gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Say something..."
            disabled={!connected}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!connected || !chatInput.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
