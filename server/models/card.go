package models

import (
	"github.com/google/uuid"
)

type Suit string

const (
	Hearts   Suit = "hearts"
	Diamonds Suit = "diamonds"
	Clubs    Suit = "clubs"
	Spades   Suit = "spades"
)

type Value int

const (
	Two   Value = 2
	Three Value = 3
	Four  Value = 4
	Five  Value = 5
	Six   Value = 6
	Seven Value = 7
	Eight Value = 8
	Nine  Value = 9
	Ten   Value = 10
	Jack  Value = 11
	Queen Value = 12
	King  Value = 13
	Ace   Value = 14
)

type Card struct {
	Suit  Suit  `json:"suit"`
	Value Value `json:"value"`
}

type Claim struct {
	PlayerID uuid.UUID `json:"player_id"`
	MadeHand MadeHand  `json:"made_hand"`
}

type PokerHand int

const (
	HighCard      PokerHand = 1
	Pair          PokerHand = 2
	TwoPair       PokerHand = 3
	ThreeOfAKind  PokerHand = 4
	Straight      PokerHand = 5
	Flush         PokerHand = 6
	FullHouse     PokerHand = 7
	FourOfAKind   PokerHand = 8
	StraightFlush PokerHand = 9
	RoyalFlush    PokerHand = 10
)

/*
MadeHand Contract:
A made hand must consist of all cards that comprise of the made hand.
ie. if my made hand claim is a two pair of 5s and 9s, then I must supply all 4 cards.
ie. if my made hand claim is a 3 of kind of 7s, then I must supply all 3 cards.
*/
type MadeHand struct {
	HandType PokerHand `json:"hand_type"`
	Cards    []Card    `json:"cards"`
}

func allSameValue(cards []Card) bool {
	for _, c := range cards[1:] {
		if c.Value != cards[0].Value {
			return false
		}
	}
	return true
}

func allSameSuit(cards []Card) bool {
	for _, c := range cards[1:] {
		if c.Suit != cards[0].Suit {
			return false
		}
	}
	return true
}

func isConsecutive(cards []Card) bool {
	min, max := cards[0].Value, cards[0].Value
	seen := make(map[Value]bool)
	for _, c := range cards {
		seen[c.Value] = true
		if c.Value < min {
			min = c.Value
		}
		if c.Value > max {
			max = c.Value
		}
	}
	return len(seen) == len(cards) && max-min == Value(len(cards)-1)
}

func getValueCounts(cards []Card) map[Value]int {
	counts := make(map[Value]int)
	for _, c := range cards {
		counts[c.Value]++
	}
	return counts
}

func getHighestValue(cards []Card) Value {
	highest := cards[0].Value
	for _, c := range cards[1:] {
		if c.Value > highest {
			highest = c.Value
		}
	}
	return highest
}

func getLowestValue(cards []Card) Value {
	lowest := cards[0].Value
	for _, c := range cards[1:] {
		if c.Value < lowest {
			lowest = c.Value
		}
	}
	return lowest
}

func isHighCardValid(cards []Card) bool {
	return len(cards) == 1
}

func isPairValid(cards []Card) bool {
	return len(cards) == 2 && allSameValue(cards)
}

func isTwoPairValid(cards []Card) bool {
	if len(cards) != 4 {
		return false
	}
	counts := getValueCounts(cards)
	if len(counts) != 2 {
		return false
	}
	for _, c := range counts {
		if c != 2 {
			return false
		}
	}
	return true
}

func isThreeOfAKindValid(cards []Card) bool {
	return len(cards) == 3 && allSameValue(cards)
}

func isStraightValid(cards []Card) bool {
	return len(cards) == 5 && isConsecutive(cards)
}

func isFlushValid(cards []Card) bool {
	return len(cards) == 5 && allSameSuit(cards)
}

func isFullHouseValid(cards []Card) bool {
	if len(cards) != 5 {
		return false
	}
	counts := getValueCounts(cards)
	if len(counts) != 2 {
		return false
	}
	for _, c := range counts {
		if c != 2 && c != 3 {
			return false
		}
	}
	return true
}

func isFourOfAKindValid(cards []Card) bool {
	return len(cards) == 4 && allSameValue(cards)
}

func isStraightFlushValid(cards []Card) bool {
	return isStraightValid(cards) && allSameSuit(cards)
}

func isRoyalFlushValid(cards []Card) bool {
	if !isStraightFlushValid(cards) {
		return false
	}
	for _, c := range cards {
		if c.Value == Ten {
			return true
		}
	}
	return false
}

func (h *MadeHand) IsValid() bool {
	switch h.HandType {
	case HighCard:
		return isHighCardValid(h.Cards)
	case Pair:
		return isPairValid(h.Cards)
	case TwoPair:
		return isTwoPairValid(h.Cards)
	case ThreeOfAKind:
		return isThreeOfAKindValid(h.Cards)
	case Straight:
		return isStraightValid(h.Cards)
	case Flush:
		return isFlushValid(h.Cards)
	case FullHouse:
		return isFullHouseValid(h.Cards)
	case FourOfAKind:
		return isFourOfAKindValid(h.Cards)
	case StraightFlush:
		return isStraightFlushValid(h.Cards)
	case RoyalFlush:
		return isRoyalFlushValid(h.Cards)
	default:
		return false
	}
}

// Suit is not a factor in determining hand strength, for now.
func (h *MadeHand) IsStrongerThan(other *MadeHand) bool {
	if !h.IsValid() || !other.IsValid() {
		return false
	}

	if h.HandType != other.HandType {
		return h.HandType > other.HandType
	}

	if h.HandType == HighCard ||
		h.HandType == Pair ||
		h.HandType == ThreeOfAKind ||
		h.HandType == Straight ||
		h.HandType == Flush ||
		h.HandType == FullHouse ||
		h.HandType == FourOfAKind ||
		h.HandType == StraightFlush {
		hHighestValue := getHighestValue(h.Cards)
		otherHighestValue := getHighestValue(other.Cards)
		return hHighestValue > otherHighestValue
	}

	if h.HandType == TwoPair {
		hHighestValue := getHighestValue(h.Cards)
		hLowestValue := getLowestValue(h.Cards)
		otherHighestValue := getHighestValue(other.Cards)
		otherLowestValue := getLowestValue(other.Cards)

		if hHighestValue != otherHighestValue {
			return hHighestValue > otherHighestValue
		}
		return hLowestValue > otherLowestValue
	}

	return false
}
