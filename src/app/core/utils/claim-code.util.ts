import { HttpErrorResponse } from '@angular/common/http';
import { WinnerClaimInfo, WinnerWorkflowStatus } from '../models/admin.models';
import { apiErrorMessage } from './api-error.util';

export const CLAIM_CODE_LENGTH = 6;

const CLAIM_CODE_PATTERN = /^\d{6}$/;

/**
 * Nettoie une saisie (frappe ou collage) : ne garde que les chiffres ASCII et
 * tronque a 6. Accepte donc « 123 456 », « 123-456 » ou « Code : 123456 ».
 */
export function normalizeClaimCode(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, CLAIM_CODE_LENGTH);
}

export function isValidClaimCode(code: unknown): code is string {
  return typeof code === 'string' && CLAIM_CODE_PATTERN.test(code);
}

export type ClaimAction = 'lookup' | 'claim' | 'regenerate';

/**
 * Message d'erreur en francais pour les appels "code gagnant". On ne remonte
 * jamais la reponse brute : statuts connus -> message fixe, 404 -> message de
 * l'API (francais par contrat) avec repli.
 */
export function claimErrorMessage(err: unknown, action: ClaimAction): string {
  const status = err instanceof HttpErrorResponse ? err.status : (err as { status?: number } | null)?.status;

  switch (status) {
    case 0:
      return 'Serveur injoignable. Vérifie la connexion puis réessaie.';
    case 400:
      return action === 'regenerate'
        ? 'Impossible de générer un nouveau code : ce lot a déjà été remis.'
        : 'Le code doit contenir exactement 6 chiffres.';
    case 401:
    case 403:
      return "Session expirée ou droits insuffisants pour cette action.";
    case 404:
      return action === 'regenerate'
        ? 'Gagnant introuvable pour ce lot.'
        : apiErrorMessage(err, 'Code inconnu ou déjà utilisé.');
    case 409:
      return 'Ce lot a déjà été remis.';
    case 429:
      return 'Trop de tentatives. Patiente une minute avant de réessayer.';
    default:
      switch (action) {
        case 'lookup':
          return 'Vérification du code impossible pour le moment. Réessaie.';
        case 'claim':
          return 'Confirmation de la remise impossible pour le moment. Réessaie.';
        default:
          return 'Génération du code impossible pour le moment. Réessaie.';
      }
  }
}

export function fulfillmentStatusLabel(status: WinnerWorkflowStatus | string | null | undefined): string {
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'En attente de vérification';
    case 'VERIFIED':
      return 'Vérifié';
    case 'IN_SHIPPING':
      return 'En cours de livraison';
    case 'DELIVERED':
      return 'Remis';
    default:
      return 'Inconnu';
  }
}

export type ClaimBadgeKind = 'claimed' | 'issued' | 'none';

export interface ClaimBadge {
  kind: ClaimBadgeKind;
  /** Libelle sans la date (la date est formatee dans le template). */
  label: string;
  date: string | null;
}

/** Badge "code gagnant" d'une ligne : un `claim` absent vaut "pas de code". */
export function claimBadge(claim: WinnerClaimInfo | null | undefined): ClaimBadge {
  if (claim?.claimedAt) {
    return { kind: 'claimed', label: 'Remis le', date: claim.claimedAt };
  }
  if (claim?.issued) {
    return { kind: 'issued', label: 'Code envoyé', date: claim.issuedAt ?? null };
  }
  return { kind: 'none', label: 'Pas de code', date: null };
}

export function personInitials(firstName: unknown, lastName: unknown): string {
  const letters = [firstName, lastName]
    .map((part) => String(part ?? '').trim()[0]?.toUpperCase() ?? '')
    .join('');
  return letters || 'G';
}
