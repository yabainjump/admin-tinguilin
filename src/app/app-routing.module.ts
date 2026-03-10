import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminAuthGuard } from './core/guards/admin-auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { AdminLayoutComponent } from './features/layout/admin-layout.component';
import { CustomersManagementComponent } from './features/customers/customers-management.component';
import { PaymentsManagementComponent } from './features/payments/payments-management.component';
import { RafflesManagementComponent } from './features/raffles/raffles-management.component';
import { SettingsComponent } from './features/settings/settings.component';
import { UsersManagementComponent } from './features/users/users-management.component';
import { WinnersManagementComponent } from './features/winners/winners-management.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    component: AdminLayoutComponent,
    canActivate: [AdminAuthGuard],
    canActivateChild: [AdminAuthGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: {
          title: 'Executive Overview',
          subtitle: "Welcome back. Here is what is happening with your platform today.",
        },
      },
      {
        path: 'raffles',
        component: RafflesManagementComponent,
        data: {
          title: 'Raffles Management',
          subtitle: 'Monitor active campaigns and analyze past performance.',
        },
      },
      {
        path: 'users',
        component: UsersManagementComponent,
        data: { title: 'Users Management', subtitle: 'Manage platform users and roles.' },
      },
      {
        path: 'customers',
        component: CustomersManagementComponent,
        data: { title: 'Customers Management', subtitle: 'Manage customers and account statuses.' },
      },
      {
        path: 'payments',
        component: PaymentsManagementComponent,
        data: { title: 'Finance & Payments', subtitle: 'Track FCFA cash-in and all transaction events.' },
      },
      {
        path: 'winners',
        component: WinnersManagementComponent,
        data: { title: 'Winners', subtitle: 'Published winners feed from backend.' },
      },
      {
        path: 'settings',
        component: SettingsComponent,
        data: { title: 'Settings', subtitle: 'Admin profile and session settings from backend.' },
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
