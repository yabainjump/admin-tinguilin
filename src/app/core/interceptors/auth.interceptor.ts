import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  // Refresh en cours partage entre toutes les requetes concurrentes
  // pour eviter une rafale d'appels a /auth/refresh.
  private refreshInProgress$: Observable<string> | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.accessToken;
    const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
    const isLoginRequest = req.url.endsWith('/auth/login') || req.url.endsWith('/auth/admin/login');
    const isRefreshRequest = req.url.endsWith('/auth/refresh');
    const isGetRequest = req.method.toUpperCase() === 'GET';

    let requestToHandle = req;

    if (isApiRequest && isGetRequest && !req.params.has('_ts')) {
      requestToHandle = requestToHandle.clone({
        setParams: { _ts: Date.now().toString() },
      });
    }

    const skipAuthHeader =
      !token || !isApiRequest || isLoginRequest || req.headers.has('Authorization');

    if (!skipAuthHeader) {
      requestToHandle = requestToHandle.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }

    return next.handle(requestToHandle).pipe(
      catchError((error: unknown) => {
        const is401 = error instanceof HttpErrorResponse && error.status === 401;
        const alreadyRetried = req.headers.has('X-Auth-Retry');

        // On ne tente le refresh que pour une requete API authentifiee
        // qui n'est ni le login, ni le refresh lui-meme, et pas deja rejouee.
        const shouldAttemptRefresh =
          is401 &&
          isApiRequest &&
          !isLoginRequest &&
          !isRefreshRequest &&
          !alreadyRetried &&
          !!this.authService.refreshToken;

        if (!shouldAttemptRefresh) {
          if (is401 && (isRefreshRequest || alreadyRetried)) {
            this.forceLogout();
          }
          return throwError(() => error);
        }

        return this.getRefresh().pipe(
          switchMap((freshToken) => {
            const retried = req.clone({
              setHeaders: {
                Authorization: `Bearer ${freshToken}`,
                'X-Auth-Retry': '1',
              },
            });
            return next.handle(retried);
          }),
          catchError((refreshError: unknown) => {
            this.forceLogout();
            return throwError(() => refreshError);
          }),
        );
      }),
    );
  }

  private getRefresh(): Observable<string> {
    if (!this.refreshInProgress$) {
      this.refreshInProgress$ = this.authService.refreshTokens().pipe(
        shareReplay(1),
        catchError((error: unknown) => {
          this.refreshInProgress$ = null;
          return throwError(() => error);
        }),
      );

      // Libere le verrou une fois le refresh resolu pour que le prochain
      // 401 (apres une nouvelle expiration) puisse relancer un refresh.
      this.refreshInProgress$.subscribe({
        next: () => (this.refreshInProgress$ = null),
        error: () => (this.refreshInProgress$ = null),
      });
    }

    return this.refreshInProgress$;
  }

  private forceLogout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
