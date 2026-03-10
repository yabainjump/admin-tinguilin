import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './features/auth/login/login.component';
import { AdminLayoutComponent } from './features/layout/admin-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CustomersManagementComponent } from './features/customers/customers-management.component';
import { PaymentsManagementComponent } from './features/payments/payments-management.component';
import { RafflesManagementComponent } from './features/raffles/raffles-management.component';
import { SettingsComponent } from './features/settings/settings.component';
import { UsersManagementComponent } from './features/users/users-management.component';
import { WinnersManagementComponent } from './features/winners/winners-management.component';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    AdminLayoutComponent,
    DashboardComponent,
    CustomersManagementComponent,
    UsersManagementComponent,
    PaymentsManagementComponent,
    WinnersManagementComponent,
    SettingsComponent,
    RafflesManagementComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
