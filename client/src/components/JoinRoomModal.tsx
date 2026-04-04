import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useJoinRoom } from "@/api/room";

interface JoinRoomModalProps {
  roomId: string;
  onJoined: (playerId: string) => void;
}

export default function JoinRoomModal({ roomId, onJoined }: JoinRoomModalProps) {
  const [password, setPassword] = useState("");
  const [playerName, setPlayerName] = useState("");
  const joinRoom = useJoinRoom();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !playerName) {
      toast.error("All fields are required.", { position: "top-center" });
      return;
    }
    joinRoom.mutate(
      { room_id: roomId, password, player_name: playerName },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(`player_id:${roomId}`, data.player_id);
          onJoined(data.player_id);
        },
        onError: () => {
          toast.error("Failed to join room.", {
            position: "top-center",
          });
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-96">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>
              Enter the password and your name to join{" "}
              <span className="font-mono font-semibold text-foreground">{roomId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="join-password" required>Password</FieldLabel>
              <Input
                id="join-password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="join-name" required>Name</FieldLabel>
              <Input
                id="join-name"
                value={playerName}
                required
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </Field>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={joinRoom.isPending}>
              {joinRoom.isPending ? "Joining..." : "Join"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
