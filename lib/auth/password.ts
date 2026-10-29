import { randomInt } from "node:crypto";

// Look-alike characters (0/O, 1/l/I) are left out so the password is easy to
// copy off an email.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function pick(set: string): string {
  return set[randomInt(set.length)];
}

// A random initial password for an admin-created account, drawn from a CSPRNG.
// It always contains at least one lowercase, uppercase, digit, and symbol.
export function generatePassword(length = 12): string {
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map(pick);
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher–Yates shuffle so the guaranteed characters aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
