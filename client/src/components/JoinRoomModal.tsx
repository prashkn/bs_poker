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

interface JoinRoomModalProps {
  roomId: string;
  onJoin: (playerName: string, password: string) => void;
}

export default function JoinRoomModal({ roomId, onJoin }: JoinRoomModalProps) {
  const [password, setPassword] = useState("");
  const [playerName, setPlayerName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !playerName) {
      toast.error("All fields are required.");
      return;
    }
    onJoin(playerName, password);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50">
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
            <Button type="submit" className="w-full">
              Join
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
