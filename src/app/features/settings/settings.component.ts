import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';

interface UserProfileResponse {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  role: string;
  status: string;
  freeTicketsBalance: number;
}

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    standalone: false
})
export class SettingsComponent implements OnInit, OnDestroy {
  isLoading = true;
  errorMessage = '';
  uploadMessage = '';
  isUploadingAvatar = false;
  authUser: AuthUser | null = null;
  profile: UserProfileResponse | null = null;
  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    forkJoin({
      me: this.authService.fetchMe(),
      profile: this.http.get<UserProfileResponse>(`${environment.apiBaseUrl}/users/me`),
    }).subscribe({
      next: ({ me, profile }) => {
        this.authUser = me;
        this.profile = profile;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les parametres.';
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy(): void {
    if (this.avatarPreviewUrl) {
      URL.revokeObjectURL(this.avatarPreviewUrl);
    }
  }

  get profileAvatar(): string | null {
    if (this.avatarPreviewUrl) {
      return this.avatarPreviewUrl;
    }

    return resolveAvatarUrl(this.profile?.avatar, environment.apiBaseUrl);
  }

  get profileInitials(): string {
    const fullName = `${String(this.profile?.firstName ?? '').trim()} ${String(this.profile?.lastName ?? '').trim()}`.trim();
    if (!fullName) return 'AD';

    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadMessage = '';

    if (!file) {
      this.selectedAvatarFile = null;
      if (this.avatarPreviewUrl) {
        URL.revokeObjectURL(this.avatarPreviewUrl);
        this.avatarPreviewUrl = null;
      }
      return;
    }

    this.selectedAvatarFile = file;

    if (this.avatarPreviewUrl) {
      URL.revokeObjectURL(this.avatarPreviewUrl);
    }
    this.avatarPreviewUrl = URL.createObjectURL(file);
  }

  uploadAvatar(): void {
    if (!this.selectedAvatarFile || this.isUploadingAvatar) {
      return;
    }

    this.isUploadingAvatar = true;
    this.uploadMessage = '';

    const body = new FormData();
    body.append('file', this.selectedAvatarFile);

    this.http
      .patch<UserProfileResponse>(`${environment.apiBaseUrl}/users/me/avatar`, body)
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.selectedAvatarFile = null;
          this.isUploadingAvatar = false;
          this.uploadMessage = 'Photo profile mise a jour.';
          this.authService.refreshCurrentUser().subscribe();
        },
        error: () => {
          this.isUploadingAvatar = false;
          this.uploadMessage = 'Upload avatar impossible.';
        },
      });
  }
}
