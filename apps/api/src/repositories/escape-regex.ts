// Escape regex metacharacters so a raw client search string can't inject an
// evil-regex (catastrophic backtracking / full-scan DoS) when used in $regex.
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
