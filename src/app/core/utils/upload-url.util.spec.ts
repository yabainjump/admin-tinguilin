import { resolveUploadUrl } from './upload-url.util';
import { validateUploadImage } from './image-file.util';
import { apiErrorMessage } from './api-error.util';

describe('resolveUploadUrl', () => {
  const api = 'https://backend.example.com/api/v1';

  it('joins the API origin with an /uploads/ path', () => {
    expect(resolveUploadUrl('/uploads/deliveries/delivery-abc.webp', api)).toBe(
      'https://backend.example.com/uploads/deliveries/delivery-abc.webp',
    );
  });

  it('enforces the required sub-folder', () => {
    expect(resolveUploadUrl('/uploads/products/p.webp', api, '/uploads/products/')).toBe(
      'https://backend.example.com/uploads/products/p.webp',
    );
    expect(resolveUploadUrl('/uploads/deliveries/d.webp', api, '/uploads/products/')).toBeNull();
  });

  it('rejects anything that is not a plain /uploads/ path', () => {
    for (const bad of [
      '',
      null,
      undefined,
      'https://evil.example.com/uploads/x.webp',
      '//evil.example.com/uploads/x.webp',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/uploads/../secret.webp',
      '/uploads//x.webp',
      '/uploads/x.webp?y=1',
      '/other/x.webp',
      'uploads/x.webp',
    ]) {
      expect(resolveUploadUrl(bad as string, api)).withContext(String(bad)).toBeNull();
    }
  });

  it('refuses a non-HTTPS API origin except on localhost', () => {
    expect(resolveUploadUrl('/uploads/a.webp', 'http://backend.example.com/api/v1')).toBeNull();
    expect(resolveUploadUrl('/uploads/a.webp', 'http://localhost:3001/api/v1')).toBe(
      'http://localhost:3001/uploads/a.webp',
    );
  });
});

describe('validateUploadImage', () => {
  it('accepts a small supported image', () => {
    const file = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });
    expect(validateUploadImage(file)).toBeNull();
  });

  it('rejects non-images, unsupported formats and files over the limit', () => {
    expect(validateUploadImage(null)).not.toBeNull();
    expect(validateUploadImage(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).not.toBeNull();
    expect(validateUploadImage(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).not.toBeNull();
    const big = new File([new Uint8Array(11)], 'big.jpg', { type: 'image/jpeg' });
    expect(validateUploadImage(big, 10)).not.toBeNull();
  });
});

describe('apiErrorMessage', () => {
  it('returns the backend message (string or array) or the fallback', () => {
    expect(apiErrorMessage({ error: { message: 'Seul un brouillon' } }, 'x')).toBe('Seul un brouillon');
    expect(apiErrorMessage({ error: { message: ['a', 'b'] } }, 'x')).toBe('a, b');
    expect(apiErrorMessage({ error: { message: { nested: true } } }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
