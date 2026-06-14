import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { GlobalSearchResponse } from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { environment } from '../../../environments/environment';

interface MenuItem {
  label: string;
  route: string;
}

@Component({
    selector: 'app-admin-layout',
    templateUrl: './admin-layout.component.html',
    styleUrls: ['./admin-layout.component.scss'],
    standalone: false
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  pageTitle = 'Executive Overview';
  pageSubtitle = "Welcome back. Here is what is happening with your platform today.";

  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', route: '/app/dashboard' },
    { label: 'Raffles', route: '/app/raffles' },
    { label: 'Users', route: '/app/users' },
    { label: 'Customers', route: '/app/customers' },
    { label: 'Finances', route: '/app/payments' },
    { label: 'Winners', route: '/app/winners' },
    { label: 'Settings', route: '/app/settings' },
  ];

  globalSearchQuery = '';
  isSearching = false;
  isSearchOpen = false;
  searchResults: GlobalSearchResponse | null = null;

  private routeSubscription?: Subscription;
  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly adminApi: AdminApiService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.syncRouteMeta();

    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncRouteMeta());
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  get userEmail(): string {
    return this.authService.currentUser?.email ?? 'admin@tinguilin.com';
  }

  get userDisplayName(): string {
    const firstName = String(this.authService.currentUser?.firstName ?? '').trim();
    const lastName = String(this.authService.currentUser?.lastName ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    return 'Admin';
  }

  get userAvatarUrl(): string | null {
    return resolveAvatarUrl(this.authService.currentUser?.avatar, environment.apiBaseUrl);
  }

  get userInitials(): string {
    const full = this.userDisplayName.trim();
    if (!full) return 'A';

    return full
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  get hasSearchResults(): boolean {
    const data = this.searchResults;
    if (!data) return false;
    return (
      data.users.length > 0 ||
      data.customers.length > 0 ||
      data.payments.length > 0 ||
      data.raffles.length > 0 ||
      data.winners.length > 0
    );
  }

  onGlobalSearchInput(value: string): void {
    this.globalSearchQuery = value;
    const query = String(value ?? '').trim();

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.length < 2) {
      this.searchResults = null;
      this.isSearchOpen = false;
      this.isSearching = false;
      return;
    }

    this.isSearching = true;
    this.searchTimeout = setTimeout(() => {
      this.adminApi.globalSearch(query, 5).subscribe({
        next: (res) => {
          this.searchResults = res;
          this.isSearchOpen = true;
          this.isSearching = false;
        },
        error: () => {
          this.searchResults = null;
          this.isSearchOpen = true;
          this.isSearching = false;
        },
      });
    }, 220);
  }

  openSearchPanel(): void {
    if (String(this.globalSearchQuery ?? '').trim().length >= 2) {
      this.isSearchOpen = true;
    }
  }

  closeSearchPanel(): void {
    this.isSearchOpen = false;
  }

  navigateFromSearch(route: string): void {
    this.isSearchOpen = false;
    this.router.navigateByUrl(route);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  onNewRaffleClick(): void {
    this.router.navigate(['/app/raffles'], {
      queryParams: { openCreateRaffle: '1' },
      queryParamsHandling: 'merge',
    });
  }

  private syncRouteMeta(): void {
    let leaf = this.route;
    while (leaf.firstChild) {
      leaf = leaf.firstChild;
    }

    this.pageTitle = leaf.snapshot.data['title'] ?? 'Executive Overview';
    this.pageSubtitle =
      leaf.snapshot.data['subtitle'] ??
      "Welcome back. Here is what is happening with your platform today.";
  }
}
