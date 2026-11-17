/**
 * Construit l'URL absolue d'un fichier servi par l'API (dossier /uploads/).
 *
 * Seuls les chemins relatifs commencant par `/uploads/` (et, si fourni, par un
 * sous-dossier precis) sont acceptes : pas d'URL externe, pas de schema
 * (javascript:, data:, http:), pas de remontee de dossier ni de query string.
 * L'origine est derivee de `apiBaseUrl` (configuration HTTPS de l'environnement).
 */
const SAFE_UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._\-/]+$/;

export function resolveUploadUrl(
  path: string | null | undefined,
  apiBaseUrl: string,
  requiredPrefix = '/uploads/',
): string | null {
  const raw = String(path ?? '').trim();
  if (!raw) return null;
  if (!raw.startsWith('/uploads/') || !raw.startsWith(requiredPrefix)) return null;
  if (!SAFE_UPLOAD_PATH.test(raw)) return null;
  if (raw.includes('..') || raw.includes('//')) return null;

  const origin = apiOrigin(apiBaseUrl);
  if (!origin) return null;
  return `${origin}${raw}`;
}

/**
 * Meme derivation que `resolveAvatarUrl` : on retire le suffixe `/api/vN` de
 * l'URL de base. On exige en plus HTTPS (HTTP tolere seulement en localhost).
 */
export function apiOrigin(apiBaseUrl: string): string | null {
  const base = String(apiBaseUrl ?? '')
    .trim()
    .replace(/\/api\/v\d+\/?$/i, '')
    .replace(/\/+$/, '');
  if (!base) return null;

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return null;
  }
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
    return null;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  return base;
}
