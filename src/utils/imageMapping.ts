export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1000';

export function getDeckCoverImage(deck: any) {
  return deck.cover_url || FALLBACK_IMAGE;
}
