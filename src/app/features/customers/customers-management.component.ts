import { Component, OnInit } from '@angular/core';
import { AdminUsersResponseItem } from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { environment } from '../../../environments/environment';

type CustomerTab = 'ALL' | 'ACTIVE' | 'BANNED';

@Component({
  selector: 'app-customers-management',
  templateUrl: './customers-management.component.html',
  styleUrls: ['./customers-management.component.scss'],
})
export class CustomersManagementComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  actionUserId = '';

  customers: AdminUsersResponseItem[] = [];
  searchTerm = '';
  activeTab: CustomerTab = 'ALL';
  page = 1;
  readonly pageSize = 10;
  total = 0;
  totalPages = 1;

  constructor(private readonly adminApi: AdminApiService) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  get fromIndex(): number {
    if (!this.total || !this.customers.length) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get toIndex(): number {
    if (!this.total || !this.customers.length) return 0;
    return (this.page - 1) * this.pageSize + this.customers.length;
  }

  setTab(tab: CustomerTab): void {
    this.activeTab = tab;
    this.page = 1;
    this.loadCustomers();
  }

  onSearch(value: string): void {
    this.searchTerm = value;
    this.page = 1;
    this.loadCustomers();
  }

  previousPage(): void {
    this.page = Math.max(1, this.page - 1);
    this.loadCustomers();
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
    this.loadCustomers();
  }

  avatarUrl(row: AdminUsersResponseItem): string | null {
    return resolveAvatarUrl(row.avatar, environment.apiBaseUrl);
  }

  initials(row: AdminUsersResponseItem): string {
    const full = `${String(row.firstName ?? '').trim()} ${String(row.lastName ?? '').trim()}`.trim();
    if (!full) return 'CU';
    return full
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  fullName(row: AdminUsersResponseItem): string {
    return `${String(row.firstName ?? '').trim()} ${String(row.lastName ?? '').trim()}`.trim() || row.email;
  }

  toggleStatus(row: AdminUsersResponseItem): void {
    const status = row.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    this.actionUserId = row.id;
    this.adminApi.updateUserStatus(row.id, status).subscribe({
      next: () => {
        this.actionUserId = '';
        this.loadCustomers();
      },
      error: () => {
        this.actionUserId = '';
        this.errorMessage = 'Mise a jour du statut client impossible.';
      },
    });
  }

  makeAdmin(row: AdminUsersResponseItem): void {
    this.actionUserId = row.id;
    this.adminApi.updateUserRole(row.id, 'ADMIN').subscribe({
      next: () => {
        this.actionUserId = '';
        this.loadCustomers();
      },
      error: () => {
        this.actionUserId = '';
        this.errorMessage = 'Promotion admin impossible.';
      },
    });
  }

  private loadCustomers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const status =
      this.activeTab === 'ACTIVE'
        ? ('ACTIVE' as const)
        : this.activeTab === 'BANNED'
          ? ('SUSPENDED' as const)
          : ('ALL' as const);

    this.adminApi
      .listUsers({
        search: this.searchTerm,
        role: 'USER',
        status,
        page: this.page,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.customers = res.data;
          this.page = res.page;
          this.total = res.total;
          this.totalPages = res.totalPages;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les customers.';
          this.isLoading = false;
        },
      });
  }
}
