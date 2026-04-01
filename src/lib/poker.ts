import type { Card, CardRank, Suit, PokerHandResult } from "@/types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: CardRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_NAMES: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};

const HAND_NAMES = [
  "High Card", "Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind",
  "Straight Flush", "Royal Flush",
];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** One 52-card deck cannot deal Hold'em to >22 players; stack decks so hole cards + board + burns never run out. */
export function createShuffledShoeForHoldem(numPlayers: number): Card[] {
  const perDeck = 52;
  const minCards = numPlayers * 2 + 18;
  const deckCount = Math.max(1, Math.ceil(minCards / perDeck));
  const shoe: Card[] = [];
  for (let i = 0; i < deckCount; i++) shoe.push(...createDeck());
  return shuffleDeck(shoe);
}

export function cardToString(card: Card): string {
  return `${RANK_NAMES[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function handToString(cards: Card[]): string {
  return cards.map(cardToString).join(" ");
}

function getCombinations(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  const result: Card[][] = [];
  for (let i = 0; i <= cards.length - size; i++) {
    const rest = getCombinations(cards.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([cards[i], ...combo]);
    }
  }
  return result;
}

function evaluateFiveCards(cards: Card[]): PokerHandResult {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  let isStraight = false;
  const uniqueRanks = [...new Set(ranks)];
  if (uniqueRanks.length === 5) {
    isStraight = uniqueRanks[0] - uniqueRanks[4] === 4;
    // Ace-low straight (A-2-3-4-5)
    if (!isStraight && uniqueRanks[0] === 14 && uniqueRanks[1] === 5) {
      isStraight = true;
      // Reorder: treat ace as 1
      ranks.push(ranks.shift()!);
    }
  }

  const counts: Map<number, number> = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13) {
    return { rank: 9, name: HAND_NAMES[9], description: "Royal Flush", kickers: ranks };
  }
  if (isFlush && isStraight) {
    return { rank: 8, name: HAND_NAMES[8], description: `Straight Flush, ${RANK_NAMES[ranks[0]]} high`, kickers: ranks };
  }
  if (groups[0][1] === 4) {
    return { rank: 7, name: HAND_NAMES[7], description: `Four ${RANK_NAMES[groups[0][0]]}s`, kickers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 6, name: HAND_NAMES[6], description: `Full House, ${RANK_NAMES[groups[0][0]]}s over ${RANK_NAMES[groups[1][0]]}s`, kickers: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) {
    return { rank: 5, name: HAND_NAMES[5], description: `Flush, ${RANK_NAMES[ranks[0]]} high`, kickers: ranks };
  }
  if (isStraight) {
    return { rank: 4, name: HAND_NAMES[4], description: `Straight, ${RANK_NAMES[ranks[0]]} high`, kickers: ranks };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return { rank: 3, name: HAND_NAMES[3], description: `Three ${RANK_NAMES[groups[0][0]]}s`, kickers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const kicker = groups.find((g) => g[1] === 1)![0];
    return { rank: 2, name: HAND_NAMES[2], description: `Two Pair, ${RANK_NAMES[groups[0][0]]}s and ${RANK_NAMES[groups[1][0]]}s`, kickers: [groups[0][0], groups[1][0], kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return { rank: 1, name: HAND_NAMES[1], description: `Pair of ${RANK_NAMES[groups[0][0]]}s`, kickers: [groups[0][0], ...kickers] };
  }
  return { rank: 0, name: HAND_NAMES[0], description: `${RANK_NAMES[ranks[0]]} high`, kickers: ranks };
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): PokerHandResult {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best: PokerHandResult | null = null;
  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best!;
}

export function compareHands(a: PokerHandResult, b: PokerHandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

export function getHandStrengthDescription(holeCards: Card[], communityCards: Card[]): string {
  if (communityCards.length === 0) {
    const r1 = holeCards[0].rank, r2 = holeCards[1].rank;
    const suited = holeCards[0].suit === holeCards[1].suit;
    if (r1 === r2) {
      if (r1 >= 11) return "Premium pocket pair — very strong starting hand";
      if (r1 >= 7) return "Medium pocket pair — solid starting hand";
      return "Small pocket pair — speculative, needs improvement";
    }
    if (r1 >= 12 && r2 >= 12) return "Big broadway cards — strong starting hand";
    if (suited && Math.abs(r1 - r2) <= 2) return "Suited connectors — good draw potential";
    if (r1 >= 10 && r2 >= 10) return "Face card combo — decent starting hand";
    return "Marginal hand — position-dependent";
  }
  const result = evaluateHand(holeCards, communityCards);
  return `${result.description} (${result.name})`;
}

export function calculatePotOdds(callAmount: number, potSize: number): string {
  if (callAmount <= 0) return "Free to check";
  const ratio = callAmount / (potSize + callAmount);
  const percentage = (ratio * 100).toFixed(1);
  return `Need ${percentage}% equity to call $${callAmount} into $${potSize} pot`;
}
