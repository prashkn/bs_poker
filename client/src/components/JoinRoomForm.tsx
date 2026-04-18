import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { JoinRoomRequest, useJoinRoom } from "@/api/room";
import { playerIdKey } from "@/lib/storage";

export default function JoinRoomForm() {
  const navigate = useNavigate();
  const joinRoom = useJoinRoom();

  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !password || !name) {
      toast.error("All fields are required to join.");
      return;
    }
    const req: JoinRoomRequest = { room_id: roomId, password, player_name: name };
    joinRoom.mutate(req, {
      onSuccess: (data) => {
        sessionStorage.setItem(playerIdKey(data.room_id), data.player_id);
        navigate(`/rooms/${data.room_id}`);
      },
      onError: () => {
        toast.error("Error joining room.");
      },
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Join Room</CardTitle>
          <CardDescription>Enter a room code to join a game.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="join-room-code" required>Room Code</FieldLabel>
            <Input
              id="join-room-code"
              placeholder="blue-rabbit-truck"
              value={roomId}
              required
              onChange={(e) => setRoomId(e.target.value)}
            />
          </Field>
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
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
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
  );
}
