import { Component, OnInit } from '@angular/core';
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
import { environment } from '../../../environments/environment';

type WinnersTab = 'ALL' | 'PENDING_VERIFICATION' | 'IN_SHIPPING' | 'DELIVERED';

@Component({
    selector: 'app-winners-management',
    templateUrl: './winners-management.component.html',
    styleUrls: ['./winners-management.component.scss'],
    standalone: false
})
export class WinnersManagementComponent implements OnInit {
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

  constructor(
    private readonly adminApi: AdminApiService,
    private readonly rafflesApi: RafflesApiService,
  ) {}

  ngOnInit(): void {
    this.loadWinners();
  }

  onSearch(value: string): void {
    this.infoMessage = '';
    this.searchTerm = value;
    this.page = 1;
    this.loadWinners();
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
