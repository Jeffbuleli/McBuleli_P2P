/** Mappe un code d’erreur API (`INVALID_CREDENTIALS`) vers `auth.errors.*` si présent */
export function translateAuthApiMessage(message: string, t: (key: string) => string): string {
  const code = message.trim();
  const key = `auth.errors.${code}`;
  const out = t(key);
  if (out !== key) return out;
  return message;
}
