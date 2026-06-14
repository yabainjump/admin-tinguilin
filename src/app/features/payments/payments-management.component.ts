import { Component, OnInit } from '@angular/core';
import {
  AdminTransactionItem,
  PaymentsReconciliationResponse,
  PaymentsSummaryResponse,
} from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { environment } from '../../../environments/environment';

type TxStatusFilter = 'ALL' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
type DateRangeFilter = 'ALL' | '7D' | '30D' | '90D';

@Component({
    selector: 'app-payments-management',
    templateUrl: './payments-management.component.html',
    styleUrls: ['./payments-management.component.scss'],
    standalone: false
})
export class PaymentsManagementComponent implements OnInit {
  summary: PaymentsSummaryResponse | null = null;
  reconciliation: PaymentsReconciliationResponse | null = null;
  transactions: AdminTransactionItem[] = [];
  selectedTransaction: AdminTransactionItem | null = null;
  isLoading = true;
  isLoadingReconciliation = false;
  isExporting = false;
  errorMessage = '';

  statusFilter: TxStatusFilter = 'ALL';
  dateRangeFilter: DateRangeFilter = '30D';
  providerFilter = 'ALL';
  searchTerm = '';
  page = 1;
  readonly pageSize = 10;
  total = 0;
  totalPages = 1;

  constructor(private readonly adminApi: AdminApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  get providerOptions(): string[] {
    const fromSummary = Object.keys(this.summary?.byProvider ?? {}).map((x) =>
      String(x).toUpperCase(),
    );
    const fromRows = this.transactions.map((tx) => String(tx.provider ?? '').toUpperCase());
    const merged = Array.from(new Set([...fromSummary, ...fromRows].filter(Boolean)));
    merged.sort((a, b) => a.localeCompare(b));
    return merged;
  }

  get fromIndex(): number {
    if (!this.total || !this.transactions.length) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get toIndex(): number {
    if (!this.total || !this.transactions.length) return 0;
    return (this.page - 1) * this.pageSize + this.transactions.length;
  }

  get reconciliationGapAbs(): number {
    return Math.abs(Number(this.reconciliation?.reconciliationGapXaf ?? 0));
  }

  get reconciliationGapLabel(): string {
    const gap = Number(this.reconciliation?.reconciliationGapXaf ?? 0);
    if (gap > 0) return 'Gap (Intents > Confirmed)';
    if (gap < 0) return 'Gap (Confirmed > Intents)';
    return 'Fully Reconciled';
  }

  get reconciliationGapTone(): 'positive' | 'negative' {
    return this.reconciliationGapAbs === 0 ? 'positive' : 'negative';
  }

  onStatusChange(status: TxStatusFilter): void {
    this.statusFilter = status;
    this.page = 1;
    this.loadTransactions();
  }

  onDateRangeChange(range: DateRangeFilter): void {
    this.dateRangeFilter = range;
    this.page = 1;
    this.loadTransactions();
  }

  onProviderChange(provider: string): void {
    this.providerFilter = provider;
    this.page = 1;
    this.loadTransactions();
  }

  onSearch(value: string): void {
    this.searchTerm = value;
    this.page = 1;
    this.loadTransactions();
  }

  previousPage(): void {
    this.page = Math.max(1, this.page - 1);
    this.loadTransactions();
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
    this.loadTransactions();
  }

  providerLabel(provider: string): string {
    const raw = String(provider ?? '').trim().toUpperCase();
    if (!raw) return 'Unknown';
    if (raw === 'OM') return 'Orange Money';
    if (raw === 'MOMO') return 'MTN MoMo';
    return raw.replace(/_/g, ' ');
  }

  customerInitials(tx: AdminTransactionItem): string {
    const first = String(tx.user?.firstName ?? '').trim();
    const last = String(tx.user?.lastName ?? '').trim();
    const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
    if (initials) return initials;

    const email = String(tx.user?.email ?? '').trim();
    return (email[0] ?? 'U').toUpperCase();
  }

  customerName(tx: AdminTransactionItem): string {
    const name = `${String(tx.user?.firstName ?? '').trim()} ${String(tx.user?.lastName ?? '').trim()}`.trim();
    return name || 'Unknown Customer';
  }

  customerAvatar(tx: AdminTransactionItem): string | null {
    return resolveAvatarUrl(tx.user?.avatar, environment.apiBaseUrl);
  }

  providerBadge(provider: string): string {
    const raw = String(provider ?? '').trim().toUpperCase();
    if (raw.includes('ORANGE') || raw === 'OM') return 'OM';
    if (raw.includes('MTN') || raw.includes('MOMO')) return 'MoMo';
    return raw.slice(0, 3) || 'PAY';
  }

  statusLabel(status: TxStatusFilter): string {
    switch (status) {
      case 'SUCCESS':
        return 'Success';
      case 'PENDING':
        return 'Pending';
      case 'FAILED':
        return 'Failed';
      case 'REFUNDED':
        return 'Refunded';
      default:
        return status;
    }
  }

  isPositive(value: number): boolean {
    return Number(value ?? 0) >= 0;
  }

  formatFcfa(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  openTransactionDetails(tx: AdminTransactionItem): void {
    this.selectedTransaction = tx;
  }

  closeTransactionDetails(): void {
    this.selectedTransaction = null;
  }

  exportCsv(): void {
    this.isExporting = true;
    this.adminApi
      .exportTransactionsCsv(this.buildQuery())
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const date = new Date();
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          link.href = url;
          link.download = `transactions-${year}${month}${day}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          this.isExporting = false;
        },
        error: () => {
          this.errorMessage = 'Export CSV echoue.';
          this.isExporting = false;
        },
      });
  }

  private loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminApi.getPaymentsSummary().subscribe({
      next: (summary) => {
        this.summary = summary;
        this.loadTransactions();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les donnees finance.';
        this.isLoading = false;
      },
    });
  }

  private loadTransactions(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminApi
      .listTransactions(this.buildQuery())
      .subscribe({
        next: (res) => {
          this.transactions = res.data;
          this.total = res.total;
          this.page = res.page;
          this.totalPages = res.totalPages;
          this.isLoading = false;
          this.loadReconciliation();
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les transactions.';
          this.isLoading = false;
        },
      });
  }

  private loadReconciliation(): void {
    const query = this.buildQuery();
    this.isLoadingReconciliation = true;
    this.adminApi
      .getPaymentsReconciliation({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      })
      .subscribe({
        next: (reconciliation) => {
          this.reconciliation = reconciliation;
          this.isLoadingReconciliation = false;
        },
        error: () => {
          this.reconciliation = null;
          this.isLoadingReconciliation = false;
        },
      });
  }

  private buildQuery() {
    const now = new Date();
    let dateFrom = '';
    let dateTo = '';

    if (this.dateRangeFilter !== 'ALL') {
      const from = new Date(now);
      const deltaDays =
        this.dateRangeFilter === '7D'
          ? 7
          : this.dateRangeFilter === '30D'
            ? 30
            : 90;
      from.setDate(now.getDate() - deltaDays);
      dateFrom = from.toISOString();
      dateTo = now.toISOString();
    }

    return {
      status: this.statusFilter,
      provider: this.providerFilter === 'ALL' ? '' : this.providerFilter,
      search: this.searchTerm,
      dateFrom,
      dateTo,
      page: this.page,
      limit: this.pageSize,
    };
  }
}
