import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AdminRaffle,
} from '../../core/models/raffle.models';
import {
  AdminWinnerItem,
  AdminWinnersSummary,
  WinnerWorkflowStatus,
} from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { RafflesApiService } from '../../core/services/raffles-api.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { apiErrorMessage } from '../../core/utils/api-error.util';
import { UPLOAD_IMAGE_ACCEPT, validateUploadImage } from '../../core/utils/image-file.util';
import { resolveUploadUrl } from '../../core/utils/upload-url.util';
import { environment } from '../../../environments/environment';

type WinnersTab = 'ALL' | 'PENDING_VERIFICATION' | 'IN_SHIPPING' | 'DELIVERED';

@Component({
    selector: 'app-winners-management',
    templateUrl: './winners-management.component.html',
    styleUrls: ['./winners-management.component.scss'],
    standalone: false
})
export class WinnersManagementComponent implements OnInit, OnDestroy {
  isLoading = true;
  isExporting = false;
  errorMessage = '';
  infoMessage = '';
  actionInProgressRaffleId = '';
  isAddWinnerModalOpen = false;
  isLoadingDrawCandidates = false;
  isDrawingWinner = false;
  drawErrorMessage = '';
  selectedDrawRaffleId = '';
  drawCandidates: AdminRaffle[] = [];
  selectedWinnerContact: AdminWinnerItem | null = null;
  statusTargetWinner: AdminWinnerItem | null = null;
  statusTargetNext: WinnerWorkflowStatus | null = null;
  statusConfirmErrorMessage = '';

  // Preuve de remise (photo + temoignage) d'un gagnant livre.
  readonly testimonialMaxLength = 280;
  readonly proofImageAccept = UPLOAD_IMAGE_ACCEPT;
  proofTarget: AdminWinnerItem | null = null;
  proofFile: File | null = null;
  proofFileName = '';
  proofPreviewUrl = '';
  proofTestimonial = '';
  proofConsent = false;
  isSubmittingProof = false;
  isRemovingProof = false;
  isConfirmingProofRemoval = false;
  proofErrorMessage = '';

  searchTerm = '';
  activeTab: WinnersTab = 'ALL';
  page = 1;
  readonly pageSize = 8;
  total = 0;
  totalPages = 1;

  winners: AdminWinnerItem[] = [];
  summary: AdminWinnersSummary = {
    currency: 'XAF',
    pendingActions: 0,
    totalRewardsXaf: 0,
    deliveriesRate: 0,
    deliveredCount: 0,
    totalWinners: 0,
  };

  private readonly searchTerms = new Subject<string>();

  constructor(
    private readonly adminApi: AdminApiService,
    private readonly rafflesApi: RafflesApiService,
  ) {
    this.searchTerms
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.infoMessage = '';
        this.searchTerm = value;
        this.page = 1;
        this.loadWinners();
      });
  }

  ngOnInit(): void {
    this.loadWinners();
  }

  ngOnDestroy(): void {
    this.revokeProofPreview();
  }

  onSearch(value: string): void {
    this.searchTerms.next(value);
  }

  setTab(tab: WinnersTab): void {
    this.infoMessage = '';
    this.activeTab = tab;
    this.page = 1;
    this.loadWinners();
  }

  previousPage(): void {
    this.infoMessage = '';
    this.page = Math.max(1, this.page - 1);
    this.loadWinners();
  }

  nextPage(): void {
    this.infoMessage = '';
    this.page = Math.min(this.totalPages, this.page + 1);
    this.loadWinners();
  }

  get eligibleDrawRaffles(): AdminRaffle[] {
    return this.drawCandidates.filter(
      (raffle) =>
        raffle.status === 'CLOSED' &&
        !raffle.winnerTicketId &&
        !raffle.winner?.ticketId,
    );
  }

  openAddWinnerModal(): void {
    this.isAddWinnerModalOpen = true;
    this.drawErrorMessage = '';
    this.selectedDrawRaffleId = '';
    this.loadDrawCandidates();
  }

  closeAddWinnerModal(): void {
    if (this.isDrawingWinner) {
      return;
    }

    this.isAddWinnerModalOpen = false;
    this.drawErrorMessage = '';
    this.selectedDrawRaffleId = '';
  }

  createWinnerFromSelection(): void {
    if (!this.selectedDrawRaffleId) {
      this.drawErrorMessage = 'Selectionne un raffle ferme pour lancer le tirage.';
      return;
    }

    this.isDrawingWinner = true;
    this.drawErrorMessage = '';
    this.infoMessage = '';

    this.rafflesApi.drawWinner(this.selectedDrawRaffleId).subscribe({
      next: () => {
        this.isDrawingWinner = false;
        this.isAddWinnerModalOpen = false;
        this.infoMessage = 'Winner tire avec succes et ajoute dans la liste.';
        this.loadWinners();
      },
      error: (err) => {
        this.isDrawingWinner = false;
        const backendMessage = err?.error?.message;
        this.drawErrorMessage = Array.isArray(backendMessage)
          ? backendMessage.join(', ')
          : String(backendMessage || 'Tirage du gagnant impossible.');
      },
    });
  }

  openWinnerContact(row: AdminWinnerItem): void {
    this.selectedWinnerContact = row;
  }

  closeWinnerContact(): void {
    this.selectedWinnerContact = null;
  }

  // ------------------------------------------------------ preuve de remise

  get isProofBusy(): boolean {
    return this.isSubmittingProof || this.isRemovingProof;
  }

  get canSubmitProof(): boolean {
    return (
      !!this.proofTarget &&
      this.proofTarget.status === 'DELIVERED' &&
      !!this.proofFile &&
      this.proofConsent &&
      this.proofTestimonial.length <= this.testimonialMaxLength &&
      !this.isProofBusy
    );
  }

  openDeliveryProof(row: AdminWinnerItem): void {
    this.resetProofForm();
    this.proofTarget = row;
  }

  closeDeliveryProof(): void {
    if (this.isProofBusy) {
      return;
    }
    this.resetProofForm();
    this.proofTarget = null;
  }

  onProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.proofErrorMessage = '';

    if (!file) {
      this.clearProofFile();
      return;
    }

    const validationError = validateUploadImage(file);
    if (validationError) {
      this.clearProofFile();
      if (input) input.value = '';
      this.proofErrorMessage = validationError;
      return;
    }

    this.revokeProofPreview();
    this.proofFile = file;
    this.proofFileName = file.name;
    this.proofPreviewUrl = URL.createObjectURL(file);
  }

  onProofTestimonialInput(value: string): void {
    this.proofTestimonial = String(value ?? '').slice(0, this.testimonialMaxLength);
  }

  submitDeliveryProof(): void {
    const row = this.proofTarget;
    const file = this.proofFile;
    if (!row || !file || !this.canSubmitProof) {
      if (row && !this.proofConsent) {
        this.proofErrorMessage = "L'accord du gagnant est obligatoire pour publier la preuve.";
      }
      return;
    }

    this.isSubmittingProof = true;
    this.proofErrorMessage = '';
    this.infoMessage = '';

    this.adminApi
      .uploadWinnerDeliveryProof(row.raffleId, {
        file,
        testimonial: this.proofTestimonial,
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingProof = false;
          row.deliveryProof = res?.deliveryProof ?? null;
          this.resetProofForm();
          this.proofTarget = null;
          this.infoMessage = `Preuve de remise publiée pour ${row.winnerName}.`;
          this.loadWinners();
        },
        error: (err) => {
          this.isSubmittingProof = false;
          this.proofErrorMessage = apiErrorMessage(
            err,
            'Publication de la preuve de remise impossible.',
          );
        },
      });
  }

  askRemoveDeliveryProof(): void {
    this.proofErrorMessage = '';
    this.isConfirmingProofRemoval = true;
  }

  cancelRemoveDeliveryProof(): void {
    if (this.isRemovingProof) return;
    this.isConfirmingProofRemoval = false;
  }

  confirmRemoveDeliveryProof(): void {
    const row = this.proofTarget;
    if (!row || this.isProofBusy) {
      return;
    }

    this.isRemovingProof = true;
    this.proofErrorMessage = '';
    this.infoMessage = '';

    this.adminApi.removeWinnerDeliveryProof(row.raffleId).subscribe({
      next: () => {
        this.isRemovingProof = false;
        this.isConfirmingProofRemoval = false;
        row.deliveryProof = null;
        this.infoMessage = `Preuve de remise retirée pour ${row.winnerName}.`;
        this.loadWinners();
      },
      error: (err) => {
        this.isRemovingProof = false;
        this.proofErrorMessage = apiErrorMessage(err, 'Retrait de la preuve de remise impossible.');
      },
    });
  }

  deliveryProofImage(row: AdminWinnerItem | null): string | null {
    return resolveUploadUrl(row?.deliveryProof?.imageUrl, environment.apiBaseUrl, '/uploads/');
  }

  private clearProofFile(): void {
    this.revokeProofPreview();
    this.proofFile = null;
    this.proofFileName = '';
  }

  private revokeProofPreview(): void {
    if (this.proofPreviewUrl) {
      URL.revokeObjectURL(this.proofPreviewUrl);
    }
    this.proofPreviewUrl = '';
  }

  private resetProofForm(): void {
    this.clearProofFile();
    this.proofTestimonial = '';
    this.proofConsent = false;
    this.proofErrorMessage = '';
    this.isConfirmingProofRemoval = false;
  }

  statusLabel(status: WinnerWorkflowStatus): string {
    switch (status) {
      case 'PENDING_VERIFICATION':
        return 'Pending';
      case 'VERIFIED':
        return 'Verified';
      case 'IN_SHIPPING':
        return 'In Shipping';
      case 'DELIVERED':
        return 'Delivered';
      default:
        return status;
    }
  }

  actionLabel(status: WinnerWorkflowStatus): string {
    switch (status) {
      case 'PENDING_VERIFICATION':
        return 'Verify';
      case 'VERIFIED':
        return 'Mark as Shipping';
      case 'IN_SHIPPING':
        return 'Mark as Delivered';
      case 'DELIVERED':
        return 'View Details';
      default:
        return 'Update';
    }
  }

  runPrimaryAction(row: AdminWinnerItem): void {
    const nextStatus = this.nextStatusFor(row.status);
    if (!nextStatus) {
      this.openWinnerContact(row);
      return;
    }

    this.statusTargetWinner = row;
    this.statusTargetNext = nextStatus;
    this.statusConfirmErrorMessage = '';
  }

  closeStatusConfirmModal(): void {
    if (
      this.statusTargetWinner &&
      this.actionInProgressRaffleId === this.statusTargetWinner.raffleId
    ) {
      return;
    }

    this.statusTargetWinner = null;
    this.statusTargetNext = null;
    this.statusConfirmErrorMessage = '';
  }

  confirmPrimaryAction(): void {
    if (!this.statusTargetWinner || !this.statusTargetNext) {
      return;
    }

    const row = this.statusTargetWinner;
    const nextStatus = this.statusTargetNext;
    this.actionInProgressRaffleId = row.raffleId;
    this.statusConfirmErrorMessage = '';
    this.infoMessage = '';
    this.errorMessage = '';

    this.adminApi.updateWinnerStatus(row.raffleId, nextStatus).subscribe({
      next: () => {
        this.actionInProgressRaffleId = '';
        this.closeStatusConfirmModal();
        this.infoMessage = `Statut du gagnant mis a jour vers ${this.statusLabel(nextStatus)}.`;
        this.loadWinners();
      },
      error: (err) => {
        this.actionInProgressRaffleId = '';
        const backendMessage = err?.error?.message;
        const message = Array.isArray(backendMessage)
          ? backendMessage.join(', ')
          : String(backendMessage || 'Mise a jour du gagnant echouee.');
        this.statusConfirmErrorMessage = message;
      },
    });
  }

  exportCsv(): void {
    if (this.isExporting) {
      return;
    }

    this.isExporting = true;
    this.errorMessage = '';
    const status =
      this.activeTab === 'ALL' ? 'ALL' : this.activeTab;

    this.adminApi
      .exportWinnersCsv({
        status,
        search: this.searchTerm,
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `winners-${new Date().toISOString().slice(0, 10)}.csv`;
          anchor.click();
          window.URL.revokeObjectURL(url);
          this.isExporting = false;
        },
        error: () => {
          this.errorMessage = "Export CSV des gagnants impossible.";
          this.isExporting = false;
        },
      });
  }

  userInitials(row: AdminWinnerItem): string {
    const parts = String(row.winnerName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return 'WN';
    return parts.map((x) => x[0]?.toUpperCase() ?? '').join('');
  }

  winnerAvatar(row: AdminWinnerItem): string | null {
    return resolveAvatarUrl(row.winnerAvatar, environment.apiBaseUrl);
  }

  winnerPhoneLink(row: AdminWinnerItem): string {
    return `tel:${String(row.winnerPhone ?? '').replace(/\s+/g, '')}`;
  }

  private nextStatusFor(
    current: WinnerWorkflowStatus,
  ): WinnerWorkflowStatus | null {
    switch (current) {
      case 'PENDING_VERIFICATION':
        return 'VERIFIED';
      case 'VERIFIED':
        return 'IN_SHIPPING';
      case 'IN_SHIPPING':
        return 'DELIVERED';
      default:
        return null;
    }
  }

  private loadWinners(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const status =
      this.activeTab === 'ALL' ? 'ALL' : this.activeTab;

    this.adminApi
      .listWinners({
        status,
        search: this.searchTerm,
        page: this.page,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.winners = res.data;
          this.syncProofTarget();
          this.total = res.total;
          this.totalPages = res.totalPages;
          this.page = res.page;
          this.summary = res.summary;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les gagnants.';
          this.isLoading = false;
        },
      });
  }

  /** Garde la modale de preuve alignee sur la ligne rechargee. */
  private syncProofTarget(): void {
    if (!this.proofTarget) return;
    const fresh = this.winners.find((w) => w.raffleId === this.proofTarget?.raffleId);
    if (fresh) this.proofTarget = fresh;
  }

  private loadDrawCandidates(): void {
    this.isLoadingDrawCandidates = true;
    this.drawErrorMessage = '';

    this.rafflesApi.getAdminRaffles().subscribe({
      next: (rows) => {
        this.drawCandidates = rows;
        this.isLoadingDrawCandidates = false;
      },
      error: () => {
        this.isLoadingDrawCandidates = false;
        this.drawErrorMessage = 'Impossible de charger les raffles eligibles.';
      },
    });
  }
}
