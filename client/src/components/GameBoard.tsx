import PlayingCard from "@/components/PlayingCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ClaimPopover from "@/components/ClaimPopover";
import { useGame } from "@/hooks/useRoom";
import { useRoom } from "@/hooks/useRoom";
import type { MadeHand } from "@/types";

export default function GameBoard() {
  const { currentTurnPlayerId, players, isMyTurn, myHand, round } = useGame();
  const { send } = useRoom();
  const currentPlayer = players.get(currentTurnPlayerId);

  function handleClaim(madeHand: MadeHand) {
    send({ event: "claim", payload: { made_hand: madeHand } });
  }

  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Round {round}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm">
          {currentTurnPlayerId ? (
            <p>
              {isMyTurn ? (
                <span className="font-semibold text-green-500">Your turn</span>
              ) : (
                <>
                  Waiting for{" "}
                  <span className="font-semibold">{currentPlayer?.name ?? "..."}</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">Waiting for first turn...</p>
          )}
        </div>

        {myHand.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Your hand</p>
            <div className="flex gap-1">
              {myHand.map((card, i) => (
                <PlayingCard key={i} card={card} />
              ))}
            </div>
          </div>
        )}

        {isMyTurn && (
          <div className="flex gap-2">
            <ClaimPopover onClaim={handleClaim} disabled={false} />
            <Button className="flex-1" variant="destructive" onClick={() => {}}>
              Call BS
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}