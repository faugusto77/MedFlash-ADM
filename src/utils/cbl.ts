import { Flashcard } from '../types';

export function calculateCBL(card: Flashcard, confidence: number) {
  // Simplified CBL calculation for the admin view
  return {
    confidence,
    repetition: (card.repetition || 0) + 1,
  };
}

export function calculateDeckMastery(cards: Flashcard[]) {
  if (!cards || cards.length === 0) return 0;
  
  let totalScore = 0;
  cards.forEach(c => {
    if (c.confidence && c.confidence >= 1 && c.confidence <= 5) {
      totalScore += c.confidence;
    }
  });
  
  const maxScore = cards.length * 5;
  return Math.round((totalScore / maxScore) * 100);
}
