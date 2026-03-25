import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardAnalyticsResponse,
  AdminInviteUserPayload,
  AdminInviteUserResponse,
  AdminTransactionItem,
  AdminUsersResponseItem,
  AdminWinnersResponse,
  GlobalSearchResponse,
  PaginatedResponse,
  PaymentsReconciliationResponse,
  PaymentsSummaryResponse,
  WinnerWorkflowStatus,
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listUsers(params?: {
    search?: string;
    role?: 'ALL' | 'USER' | 'ADMIN' | 'MODERATOR';
    status?: 'ALL' | 'ACTIVE' | 'SUSPENDED';
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<AdminUsersResponseItem>> {
    return this.http.get<PaginatedResponse<AdminUsersResponseItem>>(
      `${this.apiBaseUrl}/admin/users`,
      {
        params: {
          search: params?.search ?? '',
          role: params?.role ?? 'ALL',
          status: params?.status ?? 'ALL',
          page: String(params?.page ?? 1),
          limit: String(params?.limit ?? 20),
        },
      },
    );
  }

  updateUserRole(
    userId: string,
    role: 'USER' | 'ADMIN' | 'MODERATOR',
  ): Observable<{ id: string; email: string; role: string }> {
    return this.http.patch<{ id: string; email: string; role: string }>(
      `${this.apiBaseUrl}/admin/users/${userId}/role`,
      { role },
    );
  }

  updateUserStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Observable<{ id: string; email: string; status: string }> {
    return this.http.patch<{ id: string; email: string; status: string }>(
      `${this.apiBaseUrl}/admin/users/${userId}/status`,
      { status },
    );
  }

  deleteUser(
    userId: string,
  ): Observable<{ ok: boolean; id: string; email: string }> {
    return this.http.delete<{ ok: boolean; id: string; email: string }>(
      `${this.apiBaseUrl}/admin/users/${userId}`,
    );
  }

  inviteUser(payload: AdminInviteUserPayload): Observable<AdminInviteUserResponse> {
    return this.http.post<AdminInviteUserResponse>(
      `${this.apiBaseUrl}/admin/users/invite`,
      payload,
    );
  }

  getPaymentsSummary(): Observable<PaymentsSummaryResponse> {
    return this.http.get<PaymentsSummaryResponse>(`${this.apiBaseUrl}/admin/payments/summary`);
  }

  getDashboardAnalytics(params?: {
    granularity?: 'DAY' | 'MONTH' | 'YEAR';
    dateFrom?: string;
    dateTo?: string;
  }): Observable<DashboardAnalyticsResponse> {
    return this.http.get<DashboardAnalyticsResponse>(
      `${this.apiBaseUrl}/admin/payments/dashboard-analytics`,
      {
        params: {
          granularity: params?.granularity ?? 'DAY',
          dateFrom: params?.dateFrom ?? '',
          dateTo: params?.dateTo ?? '',
        },
      },
    );
  }

  getPaymentsReconciliation(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Observable<PaymentsReconciliationResponse> {
    return this.http.get<PaymentsReconciliationResponse>(
      `${this.apiBaseUrl}/admin/payments/reconciliation`,
      {
        params: {
          dateFrom: params?.dateFrom ?? '',
          dateTo: params?.dateTo ?? '',
        },
      },
    );
  }

  listTransactions(params?: {
    status?: 'ALL' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    provider?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResponse<AdminTransactionItem>> {
    return this.http.get<PaginatedResponse<AdminTransactionItem>>(
      `${this.apiBaseUrl}/admin/payments/transactions`,
      {
        params: {
          status: params?.status ?? 'ALL',
          provider: params?.provider ?? '',
          search: params?.search ?? '',
          dateFrom: params?.dateFrom ?? '',
          dateTo: params?.dateTo ?? '',
          page: String(params?.page ?? 1),
          limit: String(params?.limit ?? 20),
        },
      },
    );
  }

  exportTransactionsCsv(params?: {
    status?: 'ALL' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    provider?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/admin/payments/transactions/export.csv`, {
      params: {
        status: params?.status ?? 'ALL',
        provider: params?.provider ?? '',
        search: params?.search ?? '',
        dateFrom: params?.dateFrom ?? '',
        dateTo: params?.dateTo ?? '',
      },
      responseType: 'blob',
    });
  }

  listWinners(params?: {
    status?: 'ALL' | WinnerWorkflowStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<AdminWinnersResponse> {
    return this.http.get<AdminWinnersResponse>(`${this.apiBaseUrl}/admin/raffles/winners`, {
      params: {
        status: params?.status ?? 'ALL',
        search: params?.search ?? '',
        page: String(params?.page ?? 1),
        limit: String(params?.limit ?? 20),
      },
    });
  }

  updateWinnerStatus(
    raffleId: string,
    status: WinnerWorkflowStatus,
  ): Observable<{ raffleId: string; status: WinnerWorkflowStatus; fulfillmentUpdatedAt: string }> {
    return this.http.patch<{
      raffleId: string;
      status: WinnerWorkflowStatus;
      fulfillmentUpdatedAt: string;
    }>(`${this.apiBaseUrl}/admin/raffles/winners/${raffleId}/status`, { status });
  }

  exportWinnersCsv(params?: {
    status?: 'ALL' | WinnerWorkflowStatus;
    search?: string;
  }): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/admin/raffles/winners/export.csv`, {
      params: {
        status: params?.status ?? 'ALL',
        search: params?.search ?? '',
      },
      responseType: 'blob',
    });
  }

  globalSearch(query: string, limit = 5): Observable<GlobalSearchResponse> {
    return this.http.get<GlobalSearchResponse>(`${this.apiBaseUrl}/admin/search`, {
      params: {
        q: query,
        limit: String(limit),
      },
    });
  }
}
