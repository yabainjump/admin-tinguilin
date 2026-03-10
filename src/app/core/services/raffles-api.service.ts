import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminRaffle, WinnersResponse, WinnersResponseItem } from '../models/raffle.models';

@Injectable({ providedIn: 'root' })
export class RafflesApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getAdminRaffles(): Observable<AdminRaffle[]> {
    return this.http
      .get<Array<Record<string, unknown>>>(`${this.apiBaseUrl}/admin/raffles`)
      .pipe(map((items) => items.map((item) => this.normalizeRaffle(item))));
  }

  getRecentWinners(limit = 5): Observable<WinnersResponseItem[]> {
    return this.http
      .get<WinnersResponse>(`${this.apiBaseUrl}/raffles/winners`, {
        params: { limit: String(limit) },
      })
      .pipe(map((res) => res?.data ?? []));
  }

  drawWinner(raffleId: string): Observable<{
    ok: boolean;
    status: string;
    winner?: { userId: string; ticketId: string; drawnAt: string };
  }> {
    return this.http.patch<{
      ok: boolean;
      status: string;
      winner?: { userId: string; ticketId: string; drawnAt: string };
    }>(`${this.apiBaseUrl}/admin/raffles/${raffleId}/draw`, {});
  }

  createRaffleWithProduct(payload: {
    product: {
      title: string;
      description?: string;
      imageUrl: string;
      categoryId?: string;
      realValue?: number;
    };
    raffle: {
      ticketPrice: number;
      totalTickets?: number;
      currency?: string;
      rules?: string;
      endAt: string;
      badge?: string;
    };
    publishNow?: boolean;
  }): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/raffles/admin/create-with-product`,
      payload,
    );
  }

  uploadProductImage(file: File): Observable<{ ok: boolean; imageUrl: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ ok: boolean; imageUrl: string }>(
      `${this.apiBaseUrl}/admin/products/upload-image`,
      body,
    );
  }

  getAdminRaffleById(raffleId: string): Observable<AdminRaffle> {
    return this.http
      .get<Record<string, unknown>>(`${this.apiBaseUrl}/admin/raffles/${raffleId}`)
      .pipe(map((item) => this.normalizeRaffle(item)));
  }

  updateAdminRaffle(
    raffleId: string,
    payload: {
      ticketPrice?: number;
      currency?: string;
      startAt?: string;
      endAt?: string;
      rules?: string;
      status?: 'DRAFT' | 'LIVE' | 'CLOSED' | 'DRAWN';
    },
  ): Observable<AdminRaffle> {
    return this.http
      .patch<Record<string, unknown>>(
        `${this.apiBaseUrl}/admin/raffles/${raffleId}`,
        payload,
      )
      .pipe(map((item) => this.normalizeRaffle(item)));
  }

  deleteAdminRaffle(raffleId: string): Observable<{ ok: boolean; id: string }> {
    return this.http.delete<{ ok: boolean; id: string }>(
      `${this.apiBaseUrl}/admin/raffles/${raffleId}`,
    );
  }

  private normalizeRaffle(input: Record<string, unknown>): AdminRaffle {
    const productIdRaw = (input['productId'] ?? null) as
      | Record<string, unknown>
      | string
      | null;
    const productRaw =
      (input['product'] as Record<string, unknown> | null) ??
      (productIdRaw && typeof productIdRaw === 'object'
        ? (productIdRaw as Record<string, unknown>)
        : null);

    const product =
      productRaw && typeof productRaw === 'object'
        ? {
            id: String(productRaw['id'] ?? productRaw['_id'] ?? ''),
            title: String(productRaw['title'] ?? ''),
            realValue: Number(productRaw['realValue'] ?? 0),
            imageUrl: this.resolveImageUrl(productRaw['imageUrl']),
          }
        : null;

    const productId =
      typeof productIdRaw === 'string'
        ? productIdRaw
        : String(
            (productIdRaw as Record<string, unknown> | null)?.['_id'] ??
              (productIdRaw as Record<string, unknown> | null)?.['id'] ??
              product?.id ??
              '',
          );

    return {
      id: String(input['id'] ?? input['_id'] ?? ''),
      status: String(input['status'] ?? 'DRAFT') as AdminRaffle['status'],
      ticketPrice: Number(input['ticketPrice'] ?? 0),
      currency: String(input['currency'] ?? 'XAF'),
      totalTickets: Number(input['totalTickets'] ?? 0),
      ticketsSold: Number(input['ticketsSold'] ?? 0),
      participantsCount: Number(input['participantsCount'] ?? 0),
      startAt: (input['startAt'] as string | null | undefined) ?? null,
      endAt: (input['endAt'] as string | null | undefined) ?? null,
      rules: String(input['rules'] ?? ''),
      badge: String(input['badge'] ?? ''),
      createdAt: (input['createdAt'] as string | undefined) ?? undefined,
      productId,
      product,
      winnerUserId:
        input['winnerUserId'] == null ? null : String(input['winnerUserId']),
      winnerTicketId:
        input['winnerTicketId'] == null ? null : String(input['winnerTicketId']),
      winner:
        input['winner'] && typeof input['winner'] === 'object'
          ? {
              userId: String((input['winner'] as Record<string, unknown>)['userId'] ?? ''),
              ticketId: String((input['winner'] as Record<string, unknown>)['ticketId'] ?? ''),
              drawnAt: String((input['winner'] as Record<string, unknown>)['drawnAt'] ?? ''),
            }
          : null,
    };
  }

  private resolveImageUrl(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

    const origin = String(this.apiBaseUrl ?? '')
      .trim()
      .replace(/\/api\/v\d+\/?$/i, '')
      .replace(/\/+$/, '');
    if (!origin) return raw;

    if (raw.startsWith('/')) {
      return `${origin}${raw}`;
    }

    if (raw.startsWith('./') || raw.startsWith('../')) {
      return '';
    }

    if (raw.includes('/')) {
      return `${origin}/${raw}`;
    }

    return raw;
  }
}
