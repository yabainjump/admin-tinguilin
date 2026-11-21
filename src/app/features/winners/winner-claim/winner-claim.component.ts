import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClaimCodeMatch, ClaimPrizeResponse } from '../../../core/models/admin.models';
import { WinnerClaimApiService } from '../../../core/services/winner-claim-api.service';
import {
  CLAIM_CODE_LENGTH,
  claimErrorMessage,
  fulfillmentStatusLabel,
  isValidClaimCode,
  normalizeClaimCode,
  personInitials,
} from '../../../core/utils/claim-code.util';
import { resolveUploadUrl } from '../../../core/utils/upload-url.util';
import { environment } from '../../../../environments/environment';

export type ClaimStep = 'code' | 'review' | 'done';

export interface ClaimCompletedEvent {
  match: ClaimCodeMatch;
  result: ClaimPrizeResponse;
}

/**
 * Remise d'un lot en main propre a partir du code gagnant presente par le joueur.
 * 1) saisie du code -> lookup (ne consomme pas le code)
 * 2) fiche gagnant + verification de la piece d'identite -> confirmation
 * 3) succes (lot DELIVERED), puis code suivant.
 *
 * Utilisable en page (/app/remise-lot) ou embarque dans une modale (Winners).
 */
@Component({
  selector: 'app-winner-claim',
  templateUrl: './winner-claim.component.html',
  styleUrls: ['./winner-claim.component.scss'],
  standalone: false,
})
export class WinnerClaimComponent implements OnDestroy {
  /** Embarque (modale Winners) : la preuve de remise est geree par le parent. */
  @Input() embedded = false;

  @Output() readonly claimed = new EventEmitter<ClaimCompletedEvent>();
  @Output() readonly proofRequested = new EventEmitter<ClaimCodeMatch>();
  @Output() readonly busyChange = new EventEmitter<boolean>();

  readonly codeLength = CLAIM_CODE_LENGTH;

  step: ClaimStep = 'code';
  code = '';
  codeError = '';
  isLookingUp = false;

  matches: ClaimCodeMatch[] = [];
  selected: ClaimCodeMatch | null = null;
  idChecked = false;
  isClaiming = false;
  claimError = '';

  completed: ClaimCompletedEvent | null = null;

  private codeInputEl: HTMLInputElement | null = null;
  private pending?: Subscription;

  constructor(
    private readonly claimApi: WinnerClaimApiService,
    private readonly router: Router,
  ) {}

  /** Focus automatique a chaque (re)affichage du champ de code. */
  @ViewChild('codeInput')
  set codeInputRef(ref: ElementRef<HTMLInputElement> | undefined) {
    this.codeInputEl = ref?.nativeElement ?? null;
    this.codeInputEl?.focus();
  }

  @ViewChild('successHeading')
  set successHeadingRef(ref: ElementRef<HTMLElement> | undefined) {
    ref?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.pending?.unsubscribe();
    this.code = '';
  }

  get isBusy(): boolean {
    return this.isLookingUp || this.isClaiming;
  }

  get isCodeComplete(): boolean {
    return isValidClaimCode(this.code);
  }

  get isAlreadyDelivered(): boolean {
    return this.selected?.fulfillmentStatus === 'DELIVERED';
  }

  get canConfirm(): boolean {
    return (
      this.step === 'review' &&
      !!this.selected &&
      !this.isAlreadyDelivered &&
      this.idChecked &&
      this.isCodeComplete &&
      !this.isClaiming
    );
  }

  // ------------------------------------------------------------ etape 1

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.setCode(input?.value ?? '');
    if (input && input.value !== this.code) {
      input.value = this.code;
    }
    if (this.isCodeComplete && !this.isLookingUp) {
      this.submitCode();
    }
  }

  /** Met a jour le code saisi (nettoye) et efface l'erreur affichee. */
  setCode(raw: unknown): void {
    this.code = normalizeClaimCode(raw);
    this.codeError = '';
  }

  submitCode(): void {
    if (this.isLookingUp) return;
    if (!this.isCodeComplete) {
      this.codeError = `Saisis les ${CLAIM_CODE_LENGTH} chiffres du code gagnant.`;
      return;
    }

    const code = this.code;
    this.codeError = '';
    this.setLookingUp(true);
    this.pending?.unsubscribe();
    this.pending = this.claimApi.lookup(code).subscribe({
      next: (matches) => {
        this.setLookingUp(false);
        if (!matches.length) {
          this.codeError = 'Code inconnu ou déjà utilisé.';
          return;
        }
        this.matches = matches;
        this.selectMatch(matches.length === 1 ? matches[0] : null);
        this.claimError = '';
        this.step = 'review';
      },
      error: (err: unknown) => {
        this.setLookingUp(false);
        this.codeError = claimErrorMessage(err, 'lookup');
      },
    });
  }

  // ------------------------------------------------------------ etape 2

  selectMatch(match: ClaimCodeMatch | null): void {
    if (this.isClaiming) return;
    this.selected = match;
    this.idChecked = false;
    this.claimError = '';
  }

  confirmClaim(): void {
    const match = this.selected;
    if (!match || !this.canConfirm) {
      if (match && !this.idChecked && !this.isAlreadyDelivered) {
        this.claimError = "Coche la vérification de la pièce d'identité avant de confirmer.";
      }
      return;
    }

    this.claimError = '';
    this.setClaiming(true);
    this.pending?.unsubscribe();
    this.pending = this.claimApi.claim(match.raffleId, this.code).subscribe({
      next: (result) => {
        this.setClaiming(false);
        const delivered: ClaimCodeMatch = { ...match, fulfillmentStatus: 'DELIVERED' };
        this.completed = { match: delivered, result };
        // Le code est consomme : on ne le garde pas en memoire.
        this.code = '';
        this.matches = [];
        this.selected = null;
        this.idChecked = false;
        this.step = 'done';
        this.claimed.emit(this.completed);
      },
      error: (err: unknown) => {
        this.setClaiming(false);
        if ((err as { status?: number } | null)?.status === 409) {
          match.fulfillmentStatus = 'DELIVERED';
        }
        this.claimError = claimErrorMessage(err, 'claim');
      },
    });
  }

  // ------------------------------------------------------------ etape 3

  requestProof(): void {
    const match = this.completed?.match;
    if (!match) return;
    if (this.embedded) {
      this.proofRequested.emit(match);
      return;
    }
    const fullName = `${match.winner.firstName} ${match.winner.lastName}`.trim();
    void this.router.navigate(['/app/winners'], {
      queryParams: { proof: match.raffleId, q: match.ticketCode || fullName || null },
    });
  }

  /** Repart de zero pour le code suivant. */
  reset(): void {
    if (this.isClaiming) return;
    this.pending?.unsubscribe();
    this.setLookingUp(false);
    this.step = 'code';
    this.code = '';
    this.codeError = '';
    this.matches = [];
    this.selected = null;
    this.idChecked = false;
    this.claimError = '';
    this.completed = null;
    this.codeInputEl?.focus();
  }

  // ------------------------------------------------------------ affichage

  statusLabel(status: string | null | undefined): string {
    return fulfillmentStatusLabel(status);
  }

  fullName(match: ClaimCodeMatch): string {
    return `${match.winner.firstName ?? ''} ${match.winner.lastName ?? ''}`.trim() || 'Gagnant';
  }

  initials(match: ClaimCodeMatch): string {
    return personInitials(match.winner.firstName, match.winner.lastName);
  }

  /** Seuls les chemins /uploads/ valides de l'API sont affiches. */
  avatarUrl(match: ClaimCodeMatch): string | null {
    return resolveUploadUrl(match.winner.avatar, environment.apiBaseUrl, '/uploads/');
  }

  prizeImageUrl(match: ClaimCodeMatch): string | null {
    return resolveUploadUrl(match.prizeImageUrl, environment.apiBaseUrl, '/uploads/');
  }

  private setLookingUp(value: boolean): void {
    if (this.isLookingUp === value) return;
    this.isLookingUp = value;
    this.busyChange.emit(this.isBusy);
  }

  private setClaiming(value: boolean): void {
    if (this.isClaiming === value) return;
    this.isClaiming = value;
    this.busyChange.emit(this.isBusy);
  }
}
