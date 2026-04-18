/**
 * Fuzzy matching utility for search functionality
 */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findWordBoundaryIndex = (target: string, query: string) => {
  if (!query) return -1;
  const pattern = new RegExp(`\\b${escapeRegExp(query)}`);
  return target.search(pattern);
};

/**
 * Fuzzy match - favors starts-with and word boundaries before subsequence matching.
 * Returns match score (higher = better) or 0 if no match.
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Empty query matches everything
  if (q.length === 0) return 1;

  // Exact match gets highest score
  if (t === q) return 300;

  const coverage = Math.min(1, q.length / Math.max(t.length, q.length));

  // Starts with gets strong score
  if (t.startsWith(q)) {
    return 240 + coverage * 60;
  }

  // Word boundary match (e.g., matches start of words)
  const boundaryIndex = findWordBoundaryIndex(t, q);
  if (boundaryIndex >= 0) {
    const proximityBonus = Math.max(0, 40 - boundaryIndex * 1.5);
    return 200 + coverage * 50 + proximityBonus;
  }

  // Contains gets medium score with position penalty
  const containsIndex = t.indexOf(q);
  if (containsIndex >= 0) {
    const positionPenalty = Math.min(40, containsIndex * 1.2);
    return 150 + coverage * 40 - positionPenalty;
  }

  // Fuzzy subsequence match
  let qi = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let lastMatchIndex = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIndex + 1) {
        consecutiveMatches++;
      } else {
        consecutiveMatches = 1;
      }
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      lastMatchIndex = ti;
      qi++;
    }
  }

  // All chars matched
  if (qi === q.length) {
    const spreadPenalty = Math.max(0, lastMatchIndex - maxConsecutive);
    const adjacencyBonus = maxConsecutive * 10;
    const coverageBonus = coverage * 30;
    const base = 80 + adjacencyBonus + coverageBonus - spreadPenalty;
    return Math.max(0, base);
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
