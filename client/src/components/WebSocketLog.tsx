import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLog } from "@/hooks/useRoom";

export default function WebSocketLog() {
  const { log } = useLog();

  return (
    <Card className="w-120">
      <CardHeader>
        <CardTitle>WebSocket Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 max-h-96 overflow-y-auto font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet...</p>
          ) : (
            log.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.direction === "incoming"
                    ? "text-red-400"
                    : "text-green-400"
                }
              >
                <span className="text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}{" "}
                </span>
                <span>
                  {entry.direction === "incoming" ? "◀ IN " : "▶ OUT "}
                </span>
                {JSON.stringify(entry.message)}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
