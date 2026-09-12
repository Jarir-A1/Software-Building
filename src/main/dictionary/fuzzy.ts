// Bounded edit distance utilities used by the fuzzy search path.
//
// Pure, dependency free, and safe to run in any environment. The bounded
// variant lets callers stop early once the distance provably exceeds a
// threshold, which keeps large scans fast.

// Computes the Levenshtein edit distance between two strings using the classic
// dynamic programming algorithm. Runs in O(n * m) time and O(min(n, m)) space.
export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  // Ensure the shorter string drives the row width to minimize memory.
  let source = a;
  let target = b;
  if (source.length > target.length) {
    const swap = source;
    source = target;
    target = swap;
  }

  const sourceChars = Array.from(source);
  const targetChars = Array.from(target);
  const width = sourceChars.length;

  let previous: number[] = new Array<number>(width + 1);
  let current: number[] = new Array<number>(width + 1);

  for (let i = 0; i <= width; i += 1) {
    previous[i] = i;
  }

  for (let j = 1; j <= targetChars.length; j += 1) {
    current[0] = j;
    for (let i = 1; i <= width; i += 1) {
      const substitutionCost = sourceChars[i - 1] === targetChars[j - 1] ? 0 : 1;
      current[i] = Math.min(
        previous[i] + 1, // deletion
        current[i - 1] + 1, // insertion
        previous[i - 1] + substitutionCost, // substitution
      );
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[width];
}

// Computes the Levenshtein distance but returns a value greater than maxDistance
// (specifically maxDistance + 1) as soon as it is certain the true distance
// exceeds the bound. This early exit keeps fuzzy scans over the whole
// dictionary cheap.
export function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) {
    return 0;
  }

  const lengthDelta = Math.abs(a.length - b.length);
  if (lengthDelta > maxDistance) {
    return maxDistance + 1;
  }

  const sourceChars = Array.from(a);
  const targetChars = Array.from(b);
  const width = sourceChars.length;

  let previous: number[] = new Array<number>(width + 1);
  let current: number[] = new Array<number>(width + 1);

  for (let i = 0; i <= width; i += 1) {
    previous[i] = i;
  }

  for (let j = 1; j <= targetChars.length; j += 1) {
    current[0] = j;
    let rowMinimum = current[0];
    for (let i = 1; i <= width; i += 1) {
      const substitutionCost = sourceChars[i - 1] === targetChars[j - 1] ? 0 : 1;
      current[i] = Math.min(
        previous[i] + 1,
        current[i - 1] + 1,
        previous[i - 1] + substitutionCost,
      );
      if (current[i] < rowMinimum) {
        rowMinimum = current[i];
      }
    }
    // If every cell in this row already exceeds the bound, no later row can
    // recover a distance within the bound, so we can stop.
    if (rowMinimum > maxDistance) {
      return maxDistance + 1;
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[width];
}

// Returns true when the edit distance between a and b is within maxDistance.
export function isWithinDistance(a: string, b: string, maxDistance: number): boolean {
  return boundedLevenshtein(a, b, maxDistance) <= maxDistance;
}
