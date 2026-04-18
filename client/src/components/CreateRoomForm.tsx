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
import { CreateRoomRequest, useCreateRoom } from "@/api/room";
import { playerIdKey } from "@/lib/storage";

export default function CreateRoomForm() {
  const navigate = useNavigate();
  const createRoom = useCreateRoom();

  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !name) {
      toast.error("All fields are required to create a room.");
      return;
    }
    const req: CreateRoomRequest = { password, host_name: name };
    createRoom.mutate(req, {
      onSuccess: (data) => {
        sessionStorage.setItem(playerIdKey(data.room_id), data.player_id);
        navigate(`/rooms/${data.room_id}`);
      },
      onError: () => {
        toast.error("Error creating room.");
      },
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Create Room</CardTitle>
          <CardDescription>Start a new room and invite friends.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="create-password" required>Password</FieldLabel>
            <Input
              id="create-password"
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-name" required>Name</FieldLabel>
            <Input
              id="create-name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
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
  );
}
