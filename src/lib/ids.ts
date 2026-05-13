const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

export function uid(prefix = ""): string {
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return prefix ? `${prefix}_${s}` : s;
}
