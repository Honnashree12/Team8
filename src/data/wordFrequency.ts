// =============================================================================
// wordFrequency.ts
// Provides a simple vocabulary-difficulty heuristic based on word length
// and a small list of common English words. Returns a 0-1 score where
// higher means the text is likely more difficult to read.
// =============================================================================

const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'is', 'are', 'was', 'were', 'been', 'has', 'had',
]);

/**
 * Returns a 0-1 difficulty score for a block of text based on the
 * proportion of long/uncommon words it contains.
 */
export function getDifficultyIndex(text: string): number {
  const words = text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return 0;

  let difficultCount = 0;
  for (const word of words) {
    const isLong = word.length >= 7;
    const isUncommon = !COMMON_WORDS.has(word);
    if (isLong && isUncommon) difficultCount++;
  }

  return Math.min(1, difficultCount / words.length);
}