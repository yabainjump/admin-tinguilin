/**
 * Extrait le message lisible renvoye par l'API NestJS (`error.error.message`,
 * chaine ou tableau de messages de validation). Ne remonte jamais la reponse
 * brute ni une stack trace : seulement des chaines, avec un repli generique.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === 'string' && !!m.trim());
    if (parts.length) return parts.join(', ').slice(0, 500);
  }
  if (typeof message === 'string' && message.trim()) {
    return message.trim().slice(0, 500);
  }
  return fallback;
}
