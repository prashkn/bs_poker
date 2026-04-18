import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRoom } from "@/hooks/useRoom";

const PASSWORD_MASK = "••••••••";

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

export default function RoomInfo() {
  const { roomId, password, isHost } = useRoom();
  const [revealed, setRevealed] = useState(false);

  if (!isHost) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <InfoRow
          label="Code"
          value={roomId}
          display={<span className="font-mono text-sm">{roomId}</span>}
          onCopy={() => copyToClipboard(roomId, "Code")}
        />
        <InfoRow
          label="Password"
          value={password}
          display={
            <span className="font-mono text-sm">
              {revealed ? password : PASSWORD_MASK}
            </span>
          }
          onCopy={() => copyToClipboard(password, "Password")}
          trailing={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  display: React.ReactNode;
  onCopy: () => void;
  trailing?: React.ReactNode;
}

function InfoRow({ label, value, display, onCopy, trailing }: InfoRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0 truncate">{display}</div>
      {trailing}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={onCopy}
        disabled={!value}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
