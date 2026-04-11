import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreateRoomRequest, JoinRoomRequest, useCreateRoom, useJoinRoom } from "@/api/room";

export default function Home() {
  const navigate = useNavigate();

  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinName, setJoinName] = useState("");

  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");

  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinRoomId || !joinPassword || !joinName) {
      toast.error("All fields are required to join.", { position: "top-center" });
      return;
    }
    const joinRoomReq: JoinRoomRequest = { room_id: joinRoomId, password: joinPassword, player_name: joinName };
    joinRoom.mutate(joinRoomReq,
      {
        onSuccess: (data) => {
          sessionStorage.setItem(`player_id:${data.room_id}`, data.player_id);
          navigate(`/rooms/${data.room_id}`);
        },
        onError: () => {
          toast.error("Error joining room.", { position: "top-center" });
        },
      }
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createPassword || !createName) {
      toast.error("All fields are required to create a room.", { position: "top-center" });
      return;
    }
    const createRoomReq: CreateRoomRequest = { password: createPassword, host_name: createName };
    createRoom.mutate(createRoomReq,
      {
        onSuccess: (data) => {
          sessionStorage.setItem(`player_id:${data.room_id}`, data.player_id);
          navigate(`/rooms/${data.room_id}`);
        },
        onError: () => {
          toast.error("Error creating room.", { position: "top-center" });
        },
      }
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-10 text-5xl font-bold text-foreground">BS Poker</h1>

      <div className="flex items-stretch gap-2">
        <Card className="w-100 min-w-100">
          <form className="flex flex-col h-full" onSubmit={handleJoin}>
            <CardHeader>
              <CardTitle>Join Room</CardTitle>
              <CardDescription>Enter a room code to join a game.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1">
              <Field>
                <FieldLabel htmlFor="join-room-code" required>Room Code</FieldLabel>
                <Input
                  id="join-room-code"
                  placeholder="blue-rabbit-truck"
                  value={joinRoomId}
                  required
                  onChange={(e) => setJoinRoomId(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="join-password" required>Password</FieldLabel>
                <Input
                  id="join-password"
                  type="password"
                  value={joinPassword}
                  required
                  onChange={(e) => setJoinPassword(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="join-name" required>Name</FieldLabel>
                <Input
                  id="join-name"
                  value={joinName}
                  required
                  onChange={(e) => setJoinName(e.target.value)}
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Join
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Separator orientation="vertical" />

        <Card className="w-100 min-w-100">
          <form className="flex flex-col h-full" onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Create Room</CardTitle>
              <CardDescription>Start a new room and invite friends.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1">
              <Field>
                <FieldLabel htmlFor="create-password" required>Password</FieldLabel>
                <Input
                  id="create-password"
                  type="password"
                  value={createPassword}
                  required
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-name" required>Name</FieldLabel>
                <Input
                  id="create-name"
                  value={createName}
                  required
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={createRoom.isPending}>
                {createRoom.isPending ? "Creating..." : "Create"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
