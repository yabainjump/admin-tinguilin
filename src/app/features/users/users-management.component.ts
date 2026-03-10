import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AdminUsersResponseItem } from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { environment } from '../../../environments/environment';

type UsersTab = 'ALL' | 'ACTIVE' | 'BANNED' | 'ADMIN';

@Component({
  selector: 'app-users-management',
  templateUrl: './users-management.component.html',
  styleUrls: ['./users-management.component.scss'],
})
export class UsersManagementComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  infoMessage = '';
  actionInProgressUserId = '';
  isInviteModalOpen = false;
  isInvitingUser = false;
  inviteErrorMessage = '';

  searchTerm = '';
  activeTab: UsersTab = 'ALL';
  page = 1;
  readonly pageSize = 8;
  total = 0;
  totalPages = 1;

  users: AdminUsersResponseItem[] = [];
  readonly inviteForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+\d{7,15}$/)]],
    username: [''],
    role: ['USER' as 'USER' | 'ADMIN' | 'MODERATOR', [Validators.required]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminApi: AdminApiService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  onSearch(value: string): void {
    this.infoMessage = '';
    this.searchTerm = value;
    this.page = 1;
    this.loadUsers();
  }

  setTab(tab: UsersTab): void {
    this.infoMessage = '';
    this.activeTab = tab;
    this.page = 1;
    this.loadUsers();
  }

  previousPage(): void {
    this.infoMessage = '';
    this.page = Math.max(1, this.page - 1);
    this.loadUsers();
  }

  nextPage(): void {
    this.infoMessage = '';
    this.page = Math.min(this.totalPages, this.page + 1);
    this.loadUsers();
  }

  openInviteModal(): void {
    this.isInviteModalOpen = true;
    this.isInvitingUser = false;
    this.inviteErrorMessage = '';
    this.inviteForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      username: '',
      role: 'USER',
    });
  }

  closeInviteModal(): void {
    if (this.isInvitingUser) {
      return;
    }

    this.isInviteModalOpen = false;
    this.inviteErrorMessage = '';
  }

  createInvitedUser(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.isInvitingUser = true;
    this.inviteErrorMessage = '';
    this.infoMessage = '';

    const value = this.inviteForm.getRawValue();
    this.adminApi
      .inviteUser({
        firstName: String(value.firstName ?? '').trim(),
        lastName: String(value.lastName ?? '').trim(),
        email: String(value.email ?? '').trim().toLowerCase(),
        phone: String(value.phone ?? '').replace(/\s|-/g, '').trim(),
        username: String(value.username ?? '').trim() || undefined,
        role: value.role ?? 'USER',
      })
      .subscribe({
        next: (res) => {
          this.isInvitingUser = false;
          this.isInviteModalOpen = false;
          this.infoMessage = `Compte cree pour ${res.user.email}. Un email de creation/reinitialisation du mot de passe a ete envoye.`;
          this.loadUsers();
        },
        error: (err) => {
          this.isInvitingUser = false;
          const backendMessage = err?.error?.message;
          this.inviteErrorMessage = Array.isArray(backendMessage)
            ? backendMessage.join(', ')
            : String(backendMessage || 'Creation utilisateur echouee.');
        },
      });
  }

  isMe(user: AdminUsersResponseItem): boolean {
    return this.authService.currentUser?.email === user.email;
  }

  displayUsername(user: AdminUsersResponseItem): string {
    const username = String(user.username ?? '').trim();
    if (username) {
      return `@${username}`;
    }

    return `@${String(user.email ?? '').split('@')[0]}`;
  }

  userAvatar(user: AdminUsersResponseItem): string | null {
    return resolveAvatarUrl(user.avatar, environment.apiBaseUrl);
  }

  userInitials(user: AdminUsersResponseItem): string {
    const full = `${String(user.firstName ?? '').trim()} ${String(user.lastName ?? '').trim()}`.trim();
    if (full) {
      return full
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }

    return String(user.email ?? 'U')[0]?.toUpperCase() ?? 'U';
  }

  toggleRole(user: AdminUsersResponseItem): void {
    const targetRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    this.actionInProgressUserId = user.id;
    this.adminApi.updateUserRole(user.id, targetRole).subscribe({
      next: () => {
        this.actionInProgressUserId = '';
        this.loadUsers();
      },
      error: () => {
        this.errorMessage = 'Mise a jour du role echouee.';
        this.actionInProgressUserId = '';
      },
    });
  }

  toggleStatus(user: AdminUsersResponseItem): void {
    if (this.isMe(user)) {
      this.errorMessage = 'Impossible de bloquer votre propre compte.';
      return;
    }

    const targetStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    this.actionInProgressUserId = user.id;
    this.adminApi.updateUserStatus(user.id, targetStatus).subscribe({
      next: () => {
        this.actionInProgressUserId = '';
        this.loadUsers();
      },
      error: () => {
        this.errorMessage = 'Mise a jour du statut echouee.';
        this.actionInProgressUserId = '';
      },
    });
  }

  deleteUser(user: AdminUsersResponseItem): void {
    if (this.isMe(user)) {
      this.errorMessage = 'Impossible de supprimer votre propre compte.';
      return;
    }

    const ok = window.confirm(
      `Supprimer definitivement ${user.firstName} ${user.lastName} ?`,
    );
    if (!ok) {
      return;
    }

    this.actionInProgressUserId = user.id;
    this.infoMessage = '';
    this.errorMessage = '';

    this.adminApi.deleteUser(user.id).subscribe({
      next: () => {
        this.actionInProgressUserId = '';
        this.infoMessage = 'Utilisateur supprime avec succes.';
        this.loadUsers();
      },
      error: (err) => {
        this.actionInProgressUserId = '';
        const backendMessage = err?.error?.message;
        this.errorMessage = Array.isArray(backendMessage)
          ? backendMessage.join(', ')
          : String(backendMessage || 'Suppression utilisateur echouee.');
      },
    });
  }

  private loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const queryRole =
      this.activeTab === 'ADMIN'
        ? ('ADMIN' as const)
        : ('ALL' as const);
    const queryStatus =
      this.activeTab === 'ACTIVE'
        ? ('ACTIVE' as const)
        : this.activeTab === 'BANNED'
          ? ('SUSPENDED' as const)
          : ('ALL' as const);

    this.adminApi
      .listUsers({
        search: this.searchTerm,
        role: queryRole,
        status: queryStatus,
        page: this.page,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.users = res.data;
          this.total = res.total;
          this.totalPages = res.totalPages;
          this.page = res.page;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les utilisateurs.';
          this.isLoading = false;
        },
      });
  }
}
