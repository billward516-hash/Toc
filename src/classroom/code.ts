// Class codes are six digits, like a game PIN: easy to read off a TV and type on a phone's number pad,
// and no letters that could spell something in front of a class.
export const CODE_DIGITS = 6

export function newClassCode(random: () => number = secureRandom): string {
  return Array.from({ length: CODE_DIGITS }, () => Math.min(9, Math.floor(random() * 10))).join('')
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

// "482915" reads better from the back of the room as "482 915".
export const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

// What a student typed, as a class code: only the digits count, so "482 915" and "482-915" both work.
export function cleanCode(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  return digits.length === CODE_DIGITS ? digits : null
}

// The game's address with the class code in it, for the QR code on the TV.
export function joinLink(page: string, code: string): string {
  const url = new URL(page)
  url.search = ''
  url.hash = ''
  url.searchParams.set('class', code)
  return url.toString()
}

// The class code in the address the game opened with, if it came from a class's QR code.
export function codeInLink(search: string): string | null {
  return cleanCode(new URLSearchParams(search).get('class') ?? '')
}
