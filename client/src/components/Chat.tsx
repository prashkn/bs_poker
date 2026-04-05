import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChat } from "@/hooks/useRoom";

interface ChatEntry {
  name: string;
  text: string;
  isMe: boolean;
}

export default function Chat() {
  const { messages, connected, send } = useChat();
  const [chatInput, setChatInput] = useState("");
  const [localChat, setLocalChat] = useState<ChatEntry[]>([]);

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    send({ event: "chat", payload: { text: chatInput.trim() } });
    setLocalChat((prev) => [...prev, { name: "you", text: chatInput.trim(), isMe: true }]);
    setChatInput("");
  }

  const lastProcessed = useRef(0);
  useEffect(() => {
    const newMessages = messages.slice(lastProcessed.current);
    lastProcessed.current = messages.length;
    for (const msg of newMessages) {
      if (msg.event === "chat_received") {
        setLocalChat((prev) => [...prev, {
          name: msg.payload.name as string,
          text: msg.payload.text as string,
          isMe: false,
        }]);
      }
    }
  }, [messages]);

  return (
    <Card className="w-140 flex flex-col">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {localChat.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet...</p>
          ) : (
            localChat.map((msg, i) => (
              <div
                key={i}
                className={`text-sm ${msg.isMe ? "text-right" : "text-left"}`}
              >
                <span className="font-semibold text-foreground">{msg.name}</span>
                <span className="text-muted-foreground"> {msg.text}</span>
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
            placeholder="Type a message..."
            disabled={!connected}
          />
          <Button type="submit" disabled={!connected || !chatInput.trim()}>
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
