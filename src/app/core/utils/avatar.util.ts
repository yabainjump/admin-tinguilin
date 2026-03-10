export function resolveAvatarUrl(
  avatar: string | null | undefined,
  apiBaseUrl: string,
): string | null {
  const raw = String(avatar ?? '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('./') || raw.startsWith('../')) return null;

  const origin = String(apiBaseUrl ?? '')
    .trim()
    .replace(/\/api\/v\d+\/?$/i, '')
    .replace(/\/+$/, '');
  if (!origin) return null;

  if (raw.startsWith('/')) {
    return `${origin}${raw}`;
  }

  // Plain filenames like "profile.svg" are usually placeholders from mobile app
  // and not resolvable in admin web.
  if (!raw.includes('/')) {
    return null;
  }

  return `${origin}/${raw}`;
}
