import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MadeHand, Card } from "@/types";

// Hand type constants matching the server
const HighCard = 1;
const Pair = 2;
const TwoPair = 3;
const ThreeOfAKind = 4;
const Straight = 5;
const Flush = 6;
const FullHouse = 7;
const FourOfAKind = 8;
const StraightFlush = 9;
const RoyalFlush = 10;

const HAND_TYPES = [
  { value: HighCard, label: "High Card" },
  { value: Pair, label: "Pair" },
  { value: TwoPair, label: "Two Pair" },
  { value: ThreeOfAKind, label: "Three of a Kind" },
  { value: Straight, label: "Straight" },
  { value: Flush, label: "Flush" },
  { value: FullHouse, label: "Full House" },
  { value: FourOfAKind, label: "Four of a Kind" },
  { value: StraightFlush, label: "Straight Flush" },
  { value: RoyalFlush, label: "Royal Flush" },
] as const;

const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

const VALUE_LABELS: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-foreground",
  spades: "text-foreground",
};

interface ClaimPopoverProps {
  onClaim: (madeHand: MadeHand) => void;
  disabled: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
}

function needsValue1(handType: number): boolean {
  return handType !== RoyalFlush;
}

function needsValue2(handType: number): boolean {
  return handType === TwoPair || handType === FullHouse;
}

function needsSuit(handType: number): boolean {
  return handType === Flush || handType === StraightFlush || handType === RoyalFlush;
}

// Minimum high card value for straights (need 5 consecutive, lowest is 2-6 so high=6)
function minStraightHigh(): number {
  return 6;
}

function buildCards(handType: number, value1: number, value2: number, suit: string): Card[] {
  switch (handType) {
    case HighCard:
      return [{ suit: SUITS[0], value: value1 }];
    case Pair:
      return SUITS.slice(0, 2).map(s => ({ suit: s, value: value1 }));
    case ThreeOfAKind:
      return SUITS.slice(0, 3).map(s => ({ suit: s, value: value1 }));
    case FourOfAKind:
      return SUITS.map(s => ({ suit: s, value: value1 }));
    case TwoPair:
      return [
        ...SUITS.slice(0, 2).map(s => ({ suit: s, value: Math.max(value1, value2) })),
        ...SUITS.slice(0, 2).map(s => ({ suit: s, value: Math.min(value1, value2) })),
      ];
    case Straight:
      return [0, 1, 2, 3, 4].map(i => ({ suit: SUITS[i % 4], value: value1 - 4 + i }));
    case Flush:
      return [0, 1, 2, 3, 4].map(i => ({ suit: suit, value: value1 - 4 + i }));
    case FullHouse:
      return [
        ...SUITS.slice(0, 3).map(s => ({ suit: s, value: value1 })),
        ...SUITS.slice(0, 2).map(s => ({ suit: s, value: value2 })),
      ];
    case StraightFlush:
      return [0, 1, 2, 3, 4].map(i => ({ suit: suit, value: value1 - 4 + i }));
    case RoyalFlush:
      return [10, 11, 12, 13, 14].map(v => ({ suit: suit, value: v }));
    default:
      return [];
  }
}

export default function ClaimPopover({
  onClaim,
  disabled,
  triggerClassName,
  triggerLabel = "Claim",
}: ClaimPopoverProps) {
  const [open, setOpen] = useState(false);
  const [handType, setHandType] = useState<number | null>(null);
  const [value1, setValue1] = useState<number | null>(null);
  const [value2, setValue2] = useState<number | null>(null);
  const [suit, setSuit] = useState<string | null>(null);

  function reset() {
    setHandType(null);
    setValue1(null);
    setValue2(null);
    setSuit(null);
  }

  function handleHandTypeChange(val: string) {
    setHandType(Number(val));
    setValue1(null);
    setValue2(null);
    setSuit(null);
  }

  function isComplete(): boolean {
    if (handType === null) return false;
    if (needsValue1(handType) && value1 === null) return false;
    if (needsValue2(handType) && value2 === null) return false;
    if (needsSuit(handType) && suit === null) return false;
    if (handType === TwoPair && value1 === value2) return false;
    if (handType === FullHouse && value1 === value2) return false;
    return true;
  }

  function handleSubmit() {
    if (!isComplete() || handType === null) return;
    const cards = buildCards(handType, value1 ?? 0, value2 ?? 0, suit ?? "");
    onClaim({ hand_type: handType, cards });
    reset();
    setOpen(false);
  }

  const availableValues = handType === Straight || handType === StraightFlush
    ? VALUES.filter(v => v >= minStraightHigh())
    : VALUES;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        <Button className={triggerClassName ?? "flex-1"} disabled={disabled}>
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Make a Claim</p>

          <Select onValueChange={handleHandTypeChange} value={handType?.toString() ?? ""}>
            <SelectTrigger>
              <SelectValue placeholder="Select hand type" />
            </SelectTrigger>
            <SelectContent>
              {HAND_TYPES.map((h) => (
                <SelectItem key={h.value} value={h.value.toString()}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {handType !== null && needsSuit(handType) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Suit</p>
              <div className="flex gap-1">
                {SUITS.map((s) => (
                  <Button
                    key={s}
                    variant={suit === s ? "default" : "outline"}
                    size="sm"
                    className={`w-9 h-9 text-lg ${suit !== s ? SUIT_COLORS[s] : ""}`}
                    onClick={() => setSuit(s)}
                  >
                    {SUIT_SYMBOLS[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {handType !== null && needsValue1(handType) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {handType === TwoPair ? "High Pair" : handType === FullHouse ? "Three of a Kind" : handType === Straight || handType === StraightFlush ? "High Card" : "Value"}
              </p>
              <div className="flex flex-wrap gap-1">
                {availableValues.map((v) => (
                  <Button
                    key={v}
                    variant={value1 === v ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 text-xs"
                    onClick={() => setValue1(v)}
                  >
                    {VALUE_LABELS[v]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {handType !== null && needsValue2(handType) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {handType === TwoPair ? "Low Pair" : "Pair"}
              </p>
              <div className="flex flex-wrap gap-1">
                {VALUES.filter(v => v !== value1).map((v) => (
                  <Button
                    key={v}
                    variant={value2 === v ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 text-xs"
                    onClick={() => setValue2(v)}
                  >
                    {VALUE_LABELS[v]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!isComplete()}
            onClick={handleSubmit}
          >
            Submit Claim
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
