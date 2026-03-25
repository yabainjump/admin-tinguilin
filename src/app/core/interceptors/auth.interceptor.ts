import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.accessToken;
    const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
    const isLoginRequest = req.url.endsWith('/auth/login');
    const isGetRequest = req.method.toUpperCase() === 'GET';

    let requestToHandle = req;

    if (isApiRequest && isGetRequest && !req.params.has('_ts')) {
      requestToHandle = requestToHandle.clone({
        setParams: { _ts: Date.now().toString() },
      });
    }

    if (!token || !isApiRequest || isLoginRequest || req.headers.has('Authorization')) {
      return next.handle(requestToHandle);
    }

    const authorizedRequest = requestToHandle.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });

    return next.handle(authorizedRequest);
  }
}
