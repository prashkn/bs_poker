import PlayingCard from "@heruka_urgyen/react-playing-cards/lib/TcN";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ClaimPopover from "@/components/ClaimPopover";
import type { PlayerState, Card as GameCard, MadeHand } from "@/types";
import type { WSMessage } from "@/hooks/useWebSocket";

interface GameBoardProps {
  currentTurnPlayerId: string;
  players: Map<string, PlayerState>;
  isMyTurn: boolean;
  myHand: GameCard[];
  round: number;
  send: (msg: WSMessage) => void;
}

export default function GameBoard({
  currentTurnPlayerId,
  players,
  isMyTurn,
  myHand,
  round,
  send,
}: GameBoardProps) {
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
                <div key={i} className="h-28 w-20 [&_svg]:h-full [&_svg]:w-full">
                  <PlayingCard
                    card={toCardCode(card)}
                    height="96"
                  />
                </div>
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

function toCardCode(card: GameCard): string {
  const value = card.value >= 10 ? ['T', 'J', 'Q', 'K', 'A'][card.value - 10] : card.value.toString();
  const suit = card.suit.charAt(0).toLowerCase();
  return `${value}${suit}`;
}
