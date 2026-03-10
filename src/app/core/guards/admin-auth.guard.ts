import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  canActivate(): boolean | UrlTree {
    return this.allowAdminOrRedirect();
  }

  canActivateChild(): boolean | UrlTree {
    return this.allowAdminOrRedirect();
  }

  private allowAdminOrRedirect(): boolean | UrlTree {
    if (this.authService.isAdminAuthenticated()) {
      return true;
    }

    return this.router.createUrlTree(['/login']);
  }
}
