import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginRequest, LoginResponse } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly accessTokenKey = 'admin_access_token';
  private readonly refreshTokenKey = 'admin_refresh_token';
  private readonly sessionKey = 'admin_session';
  private readonly userKey = 'admin_user';

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.readStoredUser());
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  get accessToken(): string | null {
    return sessionStorage.getItem(this.accessTokenKey);
  }

  get refreshToken(): string | null {
    return null;
  }

  /**
   * Echange le refresh token contre une nouvelle paire de tokens.
   * Renvoie le nouvel access token, ou une erreur si aucun refresh token
   * n'est disponible (la session est alors purgee par l'appelant).
   */
  refreshTokens(): Observable<string> {
    if (!this.hasRefreshSession()) {
      return throwError(() => new Error('NO_REFRESH_TOKEN'));
    }

    return this.http
      .post<LoginResponse>(`${this.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map((tokens) => {
          this.persistTokens(tokens);
          return tokens.access_token;
        }),
      );
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value ?? this.readUserFromToken();
  }

  isAdminAuthenticated(): boolean {
    const token = this.accessToken;
    if (!token) {
      return this.hasRefreshSession() && this.currentUser?.role === 'ADMIN';
    }

    const payload = this.parseTokenPayload(token);
    if (!payload || payload.role !== 'ADMIN') {
      return false;
    }

    if (typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp <= nowInSeconds) {
        return this.hasRefreshSession() && this.currentUser?.role === 'ADMIN';
      }
    }

    return true;
  }

  login(credentials: LoginRequest): Observable<void> {
    return this.http
      .post<LoginResponse>(`${this.apiBaseUrl}/auth/admin/login`, credentials, { withCredentials: true })
      .pipe(
        catchError((error) => {
          // Backward compatibility while backend route is being deployed.
          if ((error as any)?.status === 404) {
            return this.http.post<LoginResponse>(
              `${this.apiBaseUrl}/auth/login`,
              credentials,
              { withCredentials: true },
            );
          }
          return throwError(() => error);
        }),
      )
      .pipe(
        switchMap((tokens) => {
          this.persistTokens(tokens);
          return this.fetchMe();
        }),
        map((user) => {
          if (user.role !== 'ADMIN') {
            throw new Error('ADMIN_ONLY');
          }

          this.persistUser(user);
        }),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        }),
      );
  }

  fetchMe(): Observable<AuthUser> {
    return this.http.get<any>(`${this.apiBaseUrl}/auth/me`).pipe(
      map((raw) => ({
        sub: String(raw?.sub ?? raw?._id ?? raw?.id ?? ''),
        email: String(raw?.email ?? ''),
        role: raw?.role as AuthUser['role'],
        username: raw?.username ?? undefined,
        firstName: raw?.firstName ?? undefined,
        lastName: raw?.lastName ?? undefined,
        phone: raw?.phone ?? undefined,
        avatar: raw?.avatar ?? undefined,
        status: raw?.status ?? undefined,
      })),
    );
  }

  refreshCurrentUser(): Observable<AuthUser> {
    return this.fetchMe().pipe(
      map((user) => {
        this.persistUser(user);
        return user;
      }),
    );
  }

  logout(): void {
    const token = this.accessToken;
    this.http.post(
      `${this.apiBaseUrl}/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    ).subscribe({ error: () => undefined });
    this.clearSession();
  }

  private persistTokens(tokens: LoginResponse): void {
    sessionStorage.setItem(this.accessTokenKey, tokens.access_token);
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.setItem(this.sessionKey, '1');
  }

  private persistUser(user: AuthUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.userSubject.next(user);
  }

  private clearSession(): void {
    sessionStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem(this.userKey);
    this.userSubject.next(null);
  }

  private readStoredUser(): AuthUser | null {
    const rawUser = localStorage.getItem(this.userKey);
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      return null;
    }
  }

  private readUserFromToken(): AuthUser | null {
    const token = this.accessToken;
    if (!token) {
      return null;
    }

    const payload = this.parseTokenPayload(token);
    if (!payload?.sub || !payload.email || !payload.role) {
      return null;
    }

    return payload;
  }

  hasRefreshSession(): boolean {
    return localStorage.getItem(this.sessionKey) === '1';
  }

  private parseTokenPayload(token: string): AuthUser | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
      const decoded = atob(payload);
      return JSON.parse(decoded) as AuthUser;
    } catch {
      return null;
    }
  }
}
