import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize, switchMap } from 'rxjs';
import { AdminRaffle } from '../../core/models/raffle.models';
import { RafflesApiService } from '../../core/services/raffles-api.service';

type RafflesFilter = 'ALL' | 'LIVE' | 'ENDED';

interface RaffleRowView {
  id: string;
  productName: string;
  imageUrl: string;
  realPrice: string;
  ticketPrice: string;
  progress: number;
  soldText: string;
  statusLabel: string;
  statusTone: 'live' | 'ended' | 'draft';
}

@Component({
  selector: 'app-raffles-management',
  templateUrl: './raffles-management.component.html',
  styleUrls: ['./raffles-management.component.scss'],
})
export class RafflesManagementComponent implements OnInit, OnDestroy {
  isLoading = true;
  isDetailsLoading = false;
  errorMessage = '';
  successMessage = '';
  activeFilter: RafflesFilter = 'ALL';
  searchTerm = '';
  page = 1;
  readonly pageSize = 6;

  isCreateModalOpen = false;
  isViewModalOpen = false;
  isEditModalOpen = false;
  isCreating = false;
  isUpdating = false;
  isDeletingRaffleId = '';
  isUploadingCreateImage = false;
  createErrorMessage = '';
  updateErrorMessage = '';
  selectedRaffle: AdminRaffle | null = null;
  selectedCreateImageFile: File | null = null;
  createImagePreviewUrl: string | null = null;
  createImageFileName = '';

  readonly createForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    imageUrl: [''],
    categoryId: ['GENERAL'],
    realValue: [0, [Validators.required, Validators.min(0)]],
    ticketPrice: [100, [Validators.required, Validators.min(1)]],
    totalTickets: [1000, [Validators.required, Validators.min(1)]],
    endAt: ['', [Validators.required]],
    rules: [''],
    badge: [''],
    publishNow: [true],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    ticketPrice: [100, [Validators.required, Validators.min(1)]],
    currency: ['XAF', [Validators.required]],
    startAt: [''],
    endAt: ['', [Validators.required]],
    rules: [''],
    status: ['DRAFT' as 'DRAFT' | 'LIVE' | 'CLOSED' | 'DRAWN', [Validators.required]],
  });

  private allRaffles: AdminRaffle[] = [];
  private querySubscription?: Subscription;
  private detailsRequestSeq = 0;

  constructor(
    private readonly rafflesApi: RafflesApiService,
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadRaffles();
    this.querySubscription = this.route.queryParamMap.subscribe((params) => {
      if (params.get('openCreateRaffle') === '1') {
        this.openCreateModal();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { openCreateRaffle: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
    this.clearCreateImageSelection();
  }

  get activeRafflesCount(): number {
    return this.allRaffles.filter((raffle) => raffle.status === 'LIVE').length;
  }

  get totalTicketsSold(): number {
    return this.allRaffles.reduce((sum, raffle) => sum + raffle.ticketsSold, 0);
  }

  get totalRevenue(): number {
    return this.allRaffles.reduce(
      (sum, raffle) => sum + raffle.ticketsSold * raffle.ticketPrice,
      0,
    );
  }

  get filteredRows(): RaffleRowView[] {
    const byStatus = this.allRaffles.filter((raffle) => {
      if (this.activeFilter === 'LIVE') {
        return raffle.status === 'LIVE';
      }
      if (this.activeFilter === 'ENDED') {
        return raffle.status === 'CLOSED' || raffle.status === 'DRAWN';
      }
      return true;
    });

    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    const bySearch = normalizedSearch
      ? byStatus.filter((raffle) =>
          (raffle.product?.title ?? '').toLowerCase().includes(normalizedSearch),
        )
      : byStatus;

    return bySearch.map((raffle) => this.toRow(raffle));
  }

  get pagedRows(): RaffleRowView[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  formatFcfa(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(value)} FCFA`;
  }

  setFilter(filter: RafflesFilter): void {
    this.activeFilter = filter;
    this.page = 1;
  }

  onSearch(inputValue: string): void {
    this.searchTerm = inputValue;
    this.page = 1;
  }

  previousPage(): void {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
  }

  openCreateModal(): void {
    this.successMessage = '';
    this.createErrorMessage = '';
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    if (this.isCreating) return;
    this.isCreateModalOpen = false;
    this.createErrorMessage = '';
    this.isUploadingCreateImage = false;
    this.clearCreateImageSelection();
    this.createForm.reset({
      title: '',
      description: '',
      imageUrl: '',
      categoryId: 'GENERAL',
      realValue: 0,
      ticketPrice: 100,
      totalTickets: 1000,
      endAt: '',
      rules: '',
      badge: '',
      publishNow: true,
    });
  }

  onCreateImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.createErrorMessage = '';

    if (!file) {
      this.clearCreateImageSelection();
      return;
    }

    const mime = String(file.type ?? '').toLowerCase();
    if (!mime.startsWith('image/')) {
      this.clearCreateImageSelection();
      if (input) input.value = '';
      this.createErrorMessage = 'Selectionne un fichier image valide.';
      return;
    }

    this.selectedCreateImageFile = file;
    this.createImageFileName = file.name;
    if (this.createImagePreviewUrl) {
      URL.revokeObjectURL(this.createImagePreviewUrl);
    }
    this.createImagePreviewUrl = URL.createObjectURL(file);
  }

  submitCreateRaffle(): void {
    if (this.isCreating) return;
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isCreating = true;
    this.createErrorMessage = '';
    this.successMessage = '';
    this.errorMessage = '';
    this.isUploadingCreateImage = false;

    const formValue = this.createForm.getRawValue();
    const endAtIso = this.toIsoString(formValue.endAt);
    if (!endAtIso) {
      this.isCreating = false;
      this.createErrorMessage = 'Date de fin invalide.';
      return;
    }

    const selectedFile = this.selectedCreateImageFile;
    if (!selectedFile) {
      this.isCreating = false;
      this.createErrorMessage =
        'Selectionne une image depuis tes fichiers pour ce raffle.';
      return;
    }

    this.isUploadingCreateImage = true;

    this.rafflesApi
      .uploadProductImage(selectedFile)
      .pipe(
        switchMap((uploadRes) => {
          const imageUrl = String(uploadRes?.imageUrl ?? '').trim();
          if (!imageUrl) {
            throw new Error('UPLOAD_IMAGE_URL_MISSING');
          }

          return this.rafflesApi.createRaffleWithProduct({
            product: {
              title: formValue.title.trim(),
              description: formValue.description.trim() || undefined,
              imageUrl,
              categoryId: formValue.categoryId.trim() || 'GENERAL',
              realValue: Number(formValue.realValue),
            },
            raffle: {
              ticketPrice: Number(formValue.ticketPrice),
              totalTickets: Number(formValue.totalTickets),
              currency: 'XAF',
              rules: formValue.rules.trim() || undefined,
              endAt: endAtIso,
              badge: formValue.badge.trim() || undefined,
            },
            publishNow: Boolean(formValue.publishNow),
          });
        }),
        finalize(() => {
          this.isCreating = false;
          this.isUploadingCreateImage = false;
        }),
      )
      .subscribe({
        next: () => {
          this.closeCreateModal();
          this.successMessage = 'Raffle cree avec succes.';
          this.activeFilter = 'ALL';
          this.page = 1;
          this.loadRaffles();
        },
        error: (error) => {
          const message = Array.isArray(error?.error?.message)
            ? error.error.message.join(', ')
            : error?.error?.message;
          this.createErrorMessage =
            typeof message === 'string' && message.trim().length > 0
              ? message
              : 'Impossible de creer le raffle (upload image ou creation).';
        },
      });
  }

  openViewModal(raffleId: string): void {
    const raffle = this.findRaffleById(raffleId);
    if (!raffle) return;
    this.selectedRaffle = raffle;
    this.errorMessage = '';
    this.isViewModalOpen = true;
    this.fetchRaffleDetails(raffleId, 'view');
  }

  closeViewModal(): void {
    this.detailsRequestSeq += 1;
    this.isDetailsLoading = false;
    this.isViewModalOpen = false;
  }

  openEditModal(raffleId: string): void {
    const raffle = this.findRaffleById(raffleId);
    if (!raffle) return;

    this.selectedRaffle = raffle;
    this.patchEditForm(raffle);
    this.updateErrorMessage = '';
    this.isEditModalOpen = true;
    this.fetchRaffleDetails(raffleId, 'edit');
  }

  closeEditModal(): void {
    if (this.isUpdating) return;
    this.detailsRequestSeq += 1;
    this.isDetailsLoading = false;
    this.isEditModalOpen = false;
    this.updateErrorMessage = '';
  }

  submitEditRaffle(): void {
    if (this.isUpdating || !this.selectedRaffle) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isUpdating = true;
    this.updateErrorMessage = '';
    this.successMessage = '';
    this.errorMessage = '';

    const value = this.editForm.getRawValue();
    const payload: {
      ticketPrice?: number;
      currency?: string;
      startAt?: string;
      endAt?: string;
      rules?: string;
      status?: 'DRAFT' | 'LIVE' | 'CLOSED' | 'DRAWN';
    } = {
      ticketPrice: Number(value.ticketPrice),
      currency: String(value.currency ?? 'XAF').trim() || 'XAF',
      rules: String(value.rules ?? '').trim(),
      status: value.status,
    };

    const startAtIso = this.toIsoString(value.startAt);
    const endAtIso = this.toIsoString(value.endAt);
    if (value.startAt && !startAtIso) {
      this.isUpdating = false;
      this.updateErrorMessage = 'Date de debut invalide.';
      return;
    }
    if (!endAtIso) {
      this.isUpdating = false;
      this.updateErrorMessage = 'Date de fin invalide.';
      return;
    }
    if (startAtIso) payload.startAt = startAtIso;
    payload.endAt = endAtIso;

    this.rafflesApi.updateAdminRaffle(this.selectedRaffle.id, payload).subscribe({
      next: () => {
        this.isUpdating = false;
        this.closeEditModal();
        this.successMessage = 'Raffle mise a jour avec succes.';
        this.loadRaffles();
      },
      error: (error) => {
        this.isUpdating = false;
        const message = Array.isArray(error?.error?.message)
          ? error.error.message.join(', ')
          : error?.error?.message;
        this.updateErrorMessage =
          typeof message === 'string' && message.trim().length > 0
            ? message
            : 'Impossible de mettre a jour le raffle.';
      },
    });
  }

  deleteRaffle(raffleId: string): void {
    const raffle = this.findRaffleById(raffleId);
    if (!raffle) return;

    const ok = window.confirm(
      `Supprimer definitivement le raffle "${raffle.product?.title ?? 'Raffle'}" ?`,
    );
    if (!ok) return;

    this.isDeletingRaffleId = raffleId;
    this.successMessage = '';
    this.errorMessage = '';

    this.rafflesApi.deleteAdminRaffle(raffleId).subscribe({
      next: () => {
        this.isDeletingRaffleId = '';
        this.successMessage = 'Raffle supprime avec succes.';
        this.isViewModalOpen = false;
        this.isEditModalOpen = false;
        this.selectedRaffle = null;
        this.loadRaffles();
      },
      error: (error) => {
        this.isDeletingRaffleId = '';
        const message = Array.isArray(error?.error?.message)
          ? error.error.message.join(', ')
          : error?.error?.message;
        this.errorMessage =
          typeof message === 'string' && message.trim().length > 0
            ? message
            : 'Suppression raffle echouee.';
      },
    });
  }

  private findRaffleById(raffleId: string): AdminRaffle | null {
    return this.allRaffles.find((row) => row.id === raffleId) ?? null;
  }

  private fetchRaffleDetails(raffleId: string, mode: 'view' | 'edit'): void {
    const requestId = ++this.detailsRequestSeq;
    this.isDetailsLoading = true;

    this.rafflesApi.getAdminRaffleById(raffleId).subscribe({
      next: (raffle) => {
        if (requestId !== this.detailsRequestSeq) return;
        this.isDetailsLoading = false;
        this.selectedRaffle = raffle;
        this.upsertRaffle(raffle);
        if (mode === 'edit') {
          this.patchEditForm(raffle);
        }
      },
      error: (error) => {
        if (requestId !== this.detailsRequestSeq) return;
        this.isDetailsLoading = false;
        const message = Array.isArray(error?.error?.message)
          ? error.error.message.join(', ')
          : error?.error?.message;
        const fallbackMessage =
          typeof message === 'string' && message.trim().length > 0
            ? message
            : 'Impossible de charger les details du raffle.';

        if (mode === 'edit') {
          this.updateErrorMessage = fallbackMessage;
        } else {
          this.errorMessage = fallbackMessage;
        }
      },
    });
  }

  private patchEditForm(raffle: AdminRaffle): void {
    this.editForm.reset({
      ticketPrice: Number(raffle.ticketPrice ?? 100),
      currency: String(raffle.currency ?? 'XAF'),
      startAt: this.toInputDateTime(raffle.startAt),
      endAt: this.toInputDateTime(raffle.endAt),
      rules: String(raffle.rules ?? ''),
      status: raffle.status,
    });
  }

  private upsertRaffle(raffle: AdminRaffle): void {
    const index = this.allRaffles.findIndex((item) => item.id === raffle.id);
    if (index === -1) {
      this.allRaffles = [raffle, ...this.allRaffles];
      return;
    }

    const next = [...this.allRaffles];
    next[index] = raffle;
    this.allRaffles = next;
  }

  private loadRaffles(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.rafflesApi.getAdminRaffles().subscribe({
      next: (raffles) => {
        this.allRaffles = raffles;
        if (this.selectedRaffle) {
          this.selectedRaffle = this.findRaffleById(this.selectedRaffle.id);
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la liste des raffles.';
        this.isLoading = false;
      },
    });
  }

  private toRow(raffle: AdminRaffle): RaffleRowView {
    const total = raffle.totalTickets > 0 ? raffle.totalTickets : 1;
    const progress = Math.max(
      0,
      Math.min(100, Math.round((raffle.ticketsSold / total) * 100)),
    );

    return {
      id: raffle.id,
      productName: raffle.product?.title || 'Raffle',
      imageUrl: raffle.product?.imageUrl || '',
      realPrice: this.toMoney(raffle.product?.realValue ?? 0),
      ticketPrice: this.toMoney(raffle.ticketPrice),
      progress,
      soldText: `${raffle.ticketsSold}/${raffle.totalTickets}`,
      statusLabel: this.toStatusLabel(raffle.status),
      statusTone: this.toStatusTone(raffle.status),
    };
  }

  private toStatusLabel(status: AdminRaffle['status']): string {
    switch (status) {
      case 'LIVE':
        return 'Live';
      case 'CLOSED':
      case 'DRAWN':
        return 'Ended';
      default:
        return 'Draft';
    }
  }

  private toStatusTone(status: AdminRaffle['status']): 'live' | 'ended' | 'draft' {
    if (status === 'LIVE') return 'live';
    if (status === 'CLOSED' || status === 'DRAWN') return 'ended';
    return 'draft';
  }

  private toMoney(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(value)} FCFA`;
  }

  private toIsoString(value: string): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private toInputDateTime(value?: string | null): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private clearCreateImageSelection(): void {
    this.selectedCreateImageFile = null;
    this.createImageFileName = '';
    if (this.createImagePreviewUrl) {
      URL.revokeObjectURL(this.createImagePreviewUrl);
    }
    this.createImagePreviewUrl = null;
  }
}
