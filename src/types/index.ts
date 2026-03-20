export interface DeckTemplate {
  id: string;
  created_at: string;
  title: string;
  parent_id: string | null;
  is_folder: boolean;
  tags: string[];
  // Additional fields based on UI
  studied_count?: number;
  total_count?: number;
  mastery_score?: number;
  icon?: string;
  cover_url?: string;
}

export interface FlashcardTemplate {
  id: string;
  created_at: string;
  deck_id: string;
  front: string;
  back: string;
  type?: string;
  front_image?: string | null;
  back_image?: string | null;
  // Mapped fields for UI
  frontImage?: string | null;
  backImage?: string | null;
  confidence?: number;
  repetition?: number;
  history?: any[];
  is_validated?: boolean;
}

// Aliases to match the new component's expected types
export type Deck = DeckTemplate & {
  cards: Flashcard[];
  stats: {
    masteryPercentage: number;
    lastSession?: {
      date: string;
      totalCards: number;
      completedCards: number;
    };
    totalReviews: number;
    lastPlayedAt?: string;
  };
};

export type Flashcard = FlashcardTemplate;

export interface AppState {
  decks: Deck[];
}
