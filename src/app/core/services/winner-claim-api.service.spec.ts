import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ClaimCodeMatch } from '../models/admin.models';
import { WinnerClaimApiService } from './winner-claim-api.service';

describe('WinnerClaimApiService', () => {
  const api = environment.apiBaseUrl;
  let http: HttpTestingController;
  let service: WinnerClaimApiService;

  const match: ClaimCodeMatch = {
    raffleId: 'r1',
    prizeTitle: 'iPhone 15',
    prizeImageUrl: '/uploads/products/p.webp',
    ticketCode: 'TK-001',
    drawnAt: '2026-11-18T10:00:00.000Z',
    fulfillmentStatus: 'PENDING_VERIFICATION',
    winner: {
      firstName: 'Awa',
      lastName: 'Ngono',
      email: 'awa@example.com',
      phone: '+237600000000',
      avatar: null,
      region: 'Centre',
      memberSince: '2025-01-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WinnerClaimApiService);
  });

  afterEach(() => http.verify());

  it('looks up a code with POST (code in the body, never in the URL) and unwraps matches', () => {
    let result: ClaimCodeMatch[] | null = null;
    service.lookup('123456').subscribe((rows) => (result = rows));

    const req = http.expectOne(`${api}/admin/raffles/winners/claim-code/lookup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    expect(req.request.urlWithParams).not.toContain('123456');
    req.flush({ matches: [match] });

    expect(result!).toEqual([match]);
  });

  it('returns an empty list when the lookup payload has no matches array', () => {
    let result: ClaimCodeMatch[] | null = null;
    service.lookup('123456').subscribe((rows) => (result = rows));
    http.expectOne(`${api}/admin/raffles/winners/claim-code/lookup`).flush({});
    expect(result!).toEqual([]);
  });

  it('propagates lookup errors (404 / 429) to the caller', () => {
    let status = -1;
    service.lookup('000000').subscribe({ error: (err) => (status = err.status) });
    http
      .expectOne(`${api}/admin/raffles/winners/claim-code/lookup`)
      .flush({ message: 'Code inconnu ou déjà utilisé' }, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });

  it('claims a prize with POST /:raffleId/claim and the code in the body', () => {
    let claimedAt = '';
    service.claim('r1', '123456').subscribe((res) => (claimedAt = res.claimedAt));

    const req = http.expectOne(`${api}/admin/raffles/winners/r1/claim`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ raffleId: 'r1', status: 'DELIVERED', claimedAt: '2026-11-20T09:00:00.000Z' });

    expect(claimedAt).toBe('2026-11-20T09:00:00.000Z');
  });

  it('encodes the raffle id in the path', () => {
    service.claim('a/b', '123456').subscribe();
    service.regenerate('a/b').subscribe();
    const claim = http.expectOne(`${api}/admin/raffles/winners/a%2Fb/claim`);
    const regen = http.expectOne(`${api}/admin/raffles/winners/a%2Fb/claim-code/regenerate`);
    expect(claim.request.method).toBe('POST');
    expect(regen.request.method).toBe('POST');
    claim.flush({});
    regen.flush({});
  });

  it('regenerates a code with POST and no code in the request', () => {
    let emailDelivered: boolean | null = null;
    service.regenerate('r1').subscribe((res) => (emailDelivered = res.emailDelivered));

    const req = http.expectOne(`${api}/admin/raffles/winners/r1/claim-code/regenerate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ raffleId: 'r1', issuedAt: '2026-11-20T09:00:00.000Z', emailDelivered: false });

    expect(emailDelivered).toBeFalse();
  });
});
