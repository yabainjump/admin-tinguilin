import { HttpErrorResponse } from '@angular/common/http';
import {
  claimBadge,
  claimErrorMessage,
  fulfillmentStatusLabel,
  isValidClaimCode,
  normalizeClaimCode,
  personInitials,
} from './claim-code.util';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('claim code utils', () => {
  describe('normalizeClaimCode', () => {
    it('keeps digits only and truncates to 6', () => {
      expect(normalizeClaimCode('123456')).toBe('123456');
      expect(normalizeClaimCode('123 456')).toBe('123456');
      expect(normalizeClaimCode('123-456')).toBe('123456');
      expect(normalizeClaimCode(' Code : 12 34 56 \n')).toBe('123456');
      expect(normalizeClaimCode('12345678')).toBe('123456');
      expect(normalizeClaimCode('12a3')).toBe('123');
    });

    it('handles empty / non-string input', () => {
      expect(normalizeClaimCode('')).toBe('');
      expect(normalizeClaimCode(null)).toBe('');
      expect(normalizeClaimCode(undefined)).toBe('');
      expect(normalizeClaimCode('abc')).toBe('');
    });

    it('drops non-ASCII digits', () => {
      expect(normalizeClaimCode('١٢٣٤٥٦')).toBe('');
    });
  });

  describe('isValidClaimCode', () => {
    it('accepts exactly 6 ASCII digits', () => {
      expect(isValidClaimCode('000000')).toBeTrue();
      expect(isValidClaimCode('123456')).toBeTrue();
    });

    it('rejects everything else', () => {
      for (const bad of ['', '12345', '1234567', '12345a', ' 123456', '123 456', null, undefined, 123456]) {
        expect(isValidClaimCode(bad)).withContext(String(bad)).toBeFalse();
      }
    });
  });

  describe('claimErrorMessage', () => {
    it('uses the French API message for an unknown/used code', () => {
      expect(claimErrorMessage(httpError(404, { message: 'Code inconnu ou déjà utilisé' }), 'lookup')).toBe(
        'Code inconnu ou déjà utilisé',
      );
      expect(claimErrorMessage(httpError(404), 'claim')).toBe('Code inconnu ou déjà utilisé.');
    });

    it('maps known statuses to fixed French messages', () => {
      expect(claimErrorMessage(httpError(429), 'lookup')).toContain('Trop de tentatives');
      expect(claimErrorMessage(httpError(400, { message: 'code must be 6 digits' }), 'lookup')).toBe(
        'Le code doit contenir exactement 6 chiffres.',
      );
      expect(claimErrorMessage(httpError(409), 'claim')).toBe('Ce lot a déjà été remis.');
      expect(claimErrorMessage(httpError(400), 'regenerate')).toContain('déjà été remis');
      expect(claimErrorMessage(httpError(0), 'lookup')).toContain('Serveur injoignable');
    });

    it('never echoes raw server errors for 5xx', () => {
      const msg = claimErrorMessage(httpError(500, { message: 'MongoServerError at /srv/app.js:12' }), 'claim');
      expect(msg).not.toContain('Mongo');
      expect(msg).toContain('Confirmation de la remise impossible');
    });
  });

  describe('claimBadge', () => {
    it('treats a missing claim as "no code"', () => {
      expect(claimBadge(undefined)).toEqual({ kind: 'none', label: 'Pas de code', date: null });
      expect(claimBadge(null).kind).toBe('none');
      expect(claimBadge({ issued: false, issuedAt: null, claimedAt: null }).kind).toBe('none');
    });

    it('shows "Code envoyé" when issued and "Remis le" once claimed', () => {
      expect(claimBadge({ issued: true, issuedAt: '2026-11-01', claimedAt: null })).toEqual({
        kind: 'issued',
        label: 'Code envoyé',
        date: '2026-11-01',
      });
      expect(claimBadge({ issued: true, issuedAt: '2026-11-01', claimedAt: '2026-11-02' })).toEqual({
        kind: 'claimed',
        label: 'Remis le',
        date: '2026-11-02',
      });
    });
  });

  it('labels statuses in French and builds initials', () => {
    expect(fulfillmentStatusLabel('DELIVERED')).toBe('Remis');
    expect(fulfillmentStatusLabel('PENDING_VERIFICATION')).toBe('En attente de vérification');
    expect(personInitials('awa', 'ngono')).toBe('AN');
    expect(personInitials('', null)).toBe('G');
  });
});
