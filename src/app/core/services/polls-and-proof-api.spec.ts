import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AdminApiService } from './admin-api.service';
import { PollsApiService } from './polls-api.service';

describe('Polls and delivery-proof API methods', () => {
  const api = environment.apiBaseUrl;
  let http: HttpTestingController;
  let polls: PollsApiService;
  let admin: AdminApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    polls = TestBed.inject(PollsApiService);
    admin = TestBed.inject(AdminApiService);
  });

  afterEach(() => http.verify());

  it('lists polls and unwraps data', () => {
    let count = -1;
    polls.listPolls().subscribe((rows) => (count = rows.length));
    const req = http.expectOne(`${api}/admin/polls`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 'p1' }] });
    expect(count).toBe(1);
  });

  it('uses the expected verbs and URLs for poll mutations', () => {
    const payload = { question: 'Q', options: [{ label: 'A' }, { label: 'B' }] };
    polls.createPoll(payload).subscribe();
    polls.updatePoll('p1', payload).subscribe();
    polls.openPoll('p1').subscribe();
    polls.closePoll('p1').subscribe();
    polls.deletePoll('p1').subscribe();

    const create = http.expectOne((r) => r.method === 'POST' && r.url === `${api}/admin/polls`);
    expect(create.request.body).toEqual(payload);
    create.flush({});
    http.expectOne((r) => r.method === 'PUT' && r.url === `${api}/admin/polls/p1`).flush({});
    http.expectOne((r) => r.method === 'PATCH' && r.url === `${api}/admin/polls/p1/open`).flush({});
    http.expectOne((r) => r.method === 'PATCH' && r.url === `${api}/admin/polls/p1/close`).flush({});
    http.expectOne((r) => r.method === 'DELETE' && r.url === `${api}/admin/polls/p1`).flush({});
  });

  it('posts the delivery proof as multipart with consent=true', () => {
    const file = new File([new Uint8Array(4)], 'proof.jpg', { type: 'image/jpeg' });
    admin.uploadWinnerDeliveryProof('r1', { file, testimonial: '  Merci !  ' }).subscribe();

    const req = http.expectOne(`${api}/admin/raffles/winners/r1/delivery-proof`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('consent')).toBe('true');
    expect(body.get('testimonial')).toBe('Merci !');
    expect(body.get('file') instanceof File).toBeTrue();
    req.flush({ ok: true, deliveryProof: null });
  });

  it('omits an empty testimonial and deletes the proof', () => {
    const file = new File([new Uint8Array(4)], 'proof.png', { type: 'image/png' });
    admin.uploadWinnerDeliveryProof('r1', { file, testimonial: '   ' }).subscribe();
    const post = http.expectOne(`${api}/admin/raffles/winners/r1/delivery-proof`);
    expect((post.request.body as FormData).has('testimonial')).toBeFalse();
    post.flush({ ok: true });

    admin.removeWinnerDeliveryProof('r1').subscribe();
    const del = http.expectOne(`${api}/admin/raffles/winners/r1/delivery-proof`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ ok: true });
  });
});
