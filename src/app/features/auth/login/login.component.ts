import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent implements OnInit {
  readonly currentYear = new Date().getFullYear();
  authMethod: 'email' | 'phone' = 'email';
  showPassword = false;
  isSubmitting = false;
  errorMessage = '';

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    if (this.authService.isAdminAuthenticated()) {
      this.router.navigateByUrl('/app/dashboard');
    }
  }

  setAuthMethod(method: 'email' | 'phone'): void {
    this.authMethod = method;
    this.errorMessage = '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    this.errorMessage = '';
    if (this.authMethod === 'phone') {
      this.errorMessage = 'Connexion par numero Whatsapp non disponible pour le moment.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const credentials = this.form.getRawValue();

    this.authService
      .login({ email: credentials.email, password: credentials.password })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.router.navigateByUrl('/app/dashboard');
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          this.errorMessage = this.resolveErrorMessage(error);
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message === 'ADMIN_ONLY') {
      return 'Acces refuse. Seuls les comptes ADMIN peuvent se connecter.';
    }

    if (error instanceof HttpErrorResponse) {
      const backendMessage = Array.isArray(error.error?.message)
        ? error.error.message.join(' ')
        : error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage;
      }

      if (error.status === 401) {
        return 'Identifiants invalides.';
      }

      if (error.status === 0) {
        return 'Impossible de joindre le backend. Verifie que l API est demarree.';
      }
    }

    return 'Echec de connexion. Reessaie dans quelques instants.';
  }
}
