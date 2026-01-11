/**
 * Fuzzy matching utility for search functionality
 */

/**
 * Simple fuzzy match - checks if query chars appear in order in target
 * Returns match score (higher = better) or 0 if no match
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Empty query matches everything
  if (q.length === 0) return 1;

  // Exact match gets highest score
  if (t === q) return 100;

  // Starts with gets high score
  if (t.startsWith(q)) return 90 + (q.length / t.length) * 10;

  // Contains gets medium score
  if (t.includes(q)) return 70 + (q.length / t.length) * 10;

  // Fuzzy match - chars in order
  let qi = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let lastMatchIndex = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIndex + 1) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 1;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }

  // All chars matched
  if (qi === q.length) {
    // Score based on consecutive matches and coverage
    const coverage = q.length / t.length;
    return 30 + maxConsecutive * 10 + coverage * 20;
  }

  return 0;
}

/**
 * Filter and sort items by fuzzy match score
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string | string[],
  minScore = 0,
): Array<T & { score: number }> {
  if (!query) {
    return items.map((item) => ({ ...item, score: 1 }));
  }

  return items
    .map((item) => {
      const searchTexts = getSearchText(item);
      const texts = Array.isArray(searchTexts) ? searchTexts : [searchTexts];

      const scores = texts.map((text, index) => {
        const score = fuzzyMatch(query, text);
        // Secondary fields get reduced weight
        return index === 0 ? score : score * 0.5;
      });

      return { ...item, score: Math.max(...scores) };
    })
    .filter(({ score }) => score > minScore)
    .sort((a, b) => b.score - a.score);
}
