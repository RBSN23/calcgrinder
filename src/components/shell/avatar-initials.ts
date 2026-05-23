// PROJ-4 — Avatar initials helper.
// Pure function. Given a profile `{name, email}`, return 1–2 character
// initials suitable for the avatar circle.
//
// Rules (from the PROJ-4 spec):
//   - Name with 2+ words → first letter of each space-split word, capped at 2.
//   - Name with 1 word → first letter.
//   - Empty / whitespace-only name → first 2 chars of the email local-part.
//   - Single-char local-part → that single letter.
//   - Accented characters are preserved ("Łukasz Świątek" → "ŁŚ").
//   - Everything empty → "?" (defensive; impossible in practice).
//
// Output is uppercased via `toLocaleUpperCase()` so locale-specific casing
// is respected (e.g. Turkish dotless İ).

export interface InitialsInput {
  name: string | null;
  email: string;
}

function firstGrapheme(input: string): string {
  // `Array.from` iterates by code points, so surrogate pairs and
  // combining marks past the first base character are still safe.
  return Array.from(input)[0] ?? '';
}

export function deriveInitials({ name, email }: InitialsInput): string {
  const normalisedName = (name ?? '').normalize('NFC').trim();
  if (normalisedName.length > 0) {
    const words = normalisedName.split(/\s+/).filter(Boolean);
    const letters = words.slice(0, 2).map(firstGrapheme).join('');
    if (letters.length > 0) return letters.toLocaleUpperCase();
  }

  const localPart = (email ?? '').split('@')[0] ?? '';
  if (localPart.length === 0) return '?';

  const chars = Array.from(localPart);
  return chars.slice(0, 2).join('').toLocaleUpperCase();
}

// Deterministic hash → oklch hue. Ported verbatim from chrome.jsx so
// the avatar background colour is stable per user across sessions.
export function cgAvatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
