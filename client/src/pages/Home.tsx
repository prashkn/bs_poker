import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JoinRoomForm from "@/components/JoinRoomForm";
import CreateRoomForm from "@/components/CreateRoomForm";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background scattered suits */}
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <span className="absolute left-[7%] top-[10%] rotate-12 text-8xl opacity-[0.04]">♠</span>
        <span className="absolute right-[9%] top-[15%] -rotate-6 text-9xl text-red-500 opacity-[0.04]">♥</span>
        <span className="absolute left-[13%] bottom-[18%] rotate-[30deg] text-7xl opacity-[0.04]">♣</span>
        <span className="absolute right-[11%] bottom-[12%] rotate-12 text-8xl text-red-500 opacity-[0.04]">♦</span>
        <span className="absolute left-[38%] top-[4%] -rotate-12 text-5xl opacity-[0.025]">♦</span>
        <span className="absolute right-[32%] bottom-[6%] rotate-6 text-6xl opacity-[0.025]">♠</span>
      </div>

      {/* Hero */}
      <div className="relative mb-10 flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-3 text-xl">
          <span className="text-foreground/25">♠</span>
          <span className="text-foreground/25">♣</span>
          <span className="text-red-500/35">♥</span>
          <span className="text-red-500/35">♦</span>
        </div>

        <div className="relative">
          <div className="absolute -inset-10 rounded-full bg-foreground/[0.04] blur-3xl" />
          <h1 className="relative text-6xl font-bold tracking-tight sm:text-7xl">
            BS Poker
          </h1>
        </div>

        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          The multiplayer bluffing card game. Lie your way to victory — or call out the bluffs around you.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {["Multiplayer", "Real-time", "Free to play"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-border bg-secondary/50 px-3 py-0.5 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Join / Create tabs */}
      <Tabs defaultValue="join" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join">Join Room</TabsTrigger>
          <TabsTrigger value="create">Create Room</TabsTrigger>
        </TabsList>
        <TabsContent value="join">
          <JoinRoomForm />
        </TabsContent>
        <TabsContent value="create">
          <CreateRoomForm />
        </TabsContent>
      </Tabs>

      <p className="mt-10 text-xs text-muted-foreground/40">
        Gather your crew · Deal the cards · Start bluffing
      </p>
    </div>
  );
}
