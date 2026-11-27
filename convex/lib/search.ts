// Name search shared by Convex functions and the browser.

// Lowercase, accents and punctuation removed, so "Ödin_99" and "odin 99" compare equal.
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const isSubsequence = (needle: string, haystack: string) => {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i++;
  return i === needle.length;
};

// Forgiving player search over name, alliance tag and game ID. Every word of the query must match.
// Exact pieces ("king", "1001") rank first; words with skipped or missing letters ("tstkng") still match the name.
export function searchPlayers<P extends { name: string; alliance: string; gameId: string }>(players: P[], query: string): P[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean);
  if (words.length === 0) return players;
  const exact: P[] = [];
  const loose: P[] = [];
  for (const p of players) {
    const name = normalize(p.name);
    const all = name + " " + normalize(p.alliance) + " " + normalize(p.gameId);
    if (words.every((w) => all.includes(w))) exact.push(p);
    else if (words.every((w) => all.includes(w) || (w.length >= 3 && isSubsequence(w, name)))) loose.push(p);
  }
  return [...exact, ...loose];
}
