export declare const COMMON_WORDS: Set<string>;
/**
 * Check if a word is common (easy).
 * Returns true  → word is in the top 5000, probably easy
 * Returns false → word is NOT common, probably difficult
 *
 * Example:
 *   isCommonWord("the")        → true
 *   isCommonWord("exacerbate") → false
 */
export declare function isCommonWord(word: string): boolean;
/**
 * Given a full block of text, returns a score from 0 to 1.
 * 0 = all simple words (easy page)
 * 1 = all difficult words (very hard page)
 *
 * This is what feeds into vocabularyDifficultyIndex in FeatureVector.
 *
 * Example:
 *   getDifficultyIndex("The cat sat on the mat") → ~0.0 (all common)
 *   getDifficultyIndex("The neurological manifestation...") → ~0.4 (many hard words)
 */
export declare function getDifficultyIndex(text: string): number;
//# sourceMappingURL=wordFrequency.d.ts.map