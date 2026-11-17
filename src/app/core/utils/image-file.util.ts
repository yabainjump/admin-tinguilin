export const MAX_UPLOAD_IMAGE_BYTES = 6 * 1024 * 1024;

/** Formats acceptes par le backend (common/uploads/image-storage.ts). */
export const ALLOWED_UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const UPLOAD_IMAGE_ACCEPT = ALLOWED_UPLOAD_IMAGE_TYPES.join(',');

/** Retourne un message d'erreur (FR) si le fichier est refuse, sinon null. */
export function validateUploadImage(
  file: File | null | undefined,
  maxBytes = MAX_UPLOAD_IMAGE_BYTES,
): string | null {
  if (!file) return 'Sélectionne une image.';
  const mime = String(file.type ?? '').toLowerCase();
  if (!mime.startsWith('image/') || !ALLOWED_UPLOAD_IMAGE_TYPES.includes(mime)) {
    return 'Format non supporté : utilise une image JPEG, PNG, WebP ou GIF.';
  }
  if (file.size > maxBytes) {
    return `Image trop lourde (max ${Math.round(maxBytes / (1024 * 1024))} Mo).`;
  }
  return null;
}
