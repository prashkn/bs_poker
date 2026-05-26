import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JoinRoomForm from "@/components/JoinRoomForm";
import CreateRoomForm from "@/components/CreateRoomForm";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold">BS Poker</h1>
      <Link
        to="/rules"
        className="mb-3 mt-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        How to play
      </Link>
      <Tabs defaultValue="join" className="w-96">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join">Join</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>
        <TabsContent value="join">
          <JoinRoomForm />
        </TabsContent>
        <TabsContent value="create">
          <CreateRoomForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
