import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JoinRoomForm from "@/components/JoinRoomForm";
import CreateRoomForm from "@/components/CreateRoomForm";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-10 text-5xl font-bold">BS Poker</h1>
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
