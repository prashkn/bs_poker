import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const navigate = useNavigate();

  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinName, setJoinName] = useState("");

  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");

  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!joinRoomId || !joinPassword || !joinName) {
      setError("All fields are required to join.");
      return;
    }
    navigate(
      `/rooms/${joinRoomId}?name=${encodeURIComponent(joinName)}&password=${encodeURIComponent(joinPassword)}`
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!createPassword || !createName) {
      setError("All fields are required to create a room.");
      return;
    }
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: createPassword,
          host_name: createName,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to create room.");
        return;
      }
      const data = await res.json();
      navigate(
        `/rooms/${data.room_id}?name=${encodeURIComponent(createName)}&password=${encodeURIComponent(createPassword)}&host_id=${data.host_id}`
      );
    } catch {
      setError("Failed to create room.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-10 text-5xl font-bold text-foreground">BS Poker</h1>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-stretch gap-8">
        <Card className="w-72">
          <form onSubmit={handleJoin}>
            <CardHeader>
              <CardTitle>Join Room</CardTitle>
              <CardDescription>Enter a room code to join an existing game.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="join-room-id">Room ID</Label>
                <Input
                  id="join-room-id"
                  placeholder="e.g. a1b2c3d4"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="join-password">Password</Label>
                <Input
                  id="join-password"
                  type="password"
                  placeholder="Room password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="join-name">Your Name</Label>
                <Input
                  id="join-name"
                  placeholder="Display name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Join
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Separator orientation="vertical" />

        <Card className="w-72">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Create Room</CardTitle>
              <CardDescription>Start a new room and invite friends.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Room password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-name">Your Name</Label>
                <Input
                  id="create-name"
                  placeholder="Display name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Create
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
