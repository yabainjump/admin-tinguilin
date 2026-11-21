import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ClaimCodeMatch, ClaimPrizeResponse } from '../../../core/models/admin.models';
import { WinnerClaimApiService } from '../../../core/services/winner-claim-api.service';
import { ClaimCompletedEvent, WinnerClaimComponent } from './winner-claim.component';

describe('WinnerClaimComponent', () => {
  let fixture: ComponentFixture<WinnerClaimComponent>;
  let component: WinnerClaimComponent;
  let lookup$: Subject<ClaimCodeMatch[]>;
  let claim$: Subject<ClaimPrizeResponse>;
  let api: jasmine.SpyObj<WinnerClaimApiService>;

  const makeMatch = (overrides: Partial<ClaimCodeMatch> = {}): ClaimCodeMatch => ({
    raffleId: 'r1',
    prizeTitle: 'iPhone 15',
    prizeImageUrl: 'https://evil.example.com/x.png',
    ticketCode: 'TK-001',
    drawnAt: '2026-11-18T10:00:00.000Z',
    fulfillmentStatus: 'VERIFIED',
    winner: {
      firstName: 'Awa',
      lastName: 'Ngono',
      email: 'awa@example.com',
      phone: '+237600000000',
      avatar: 'javascript:alert(1)',
      region: 'Centre',
      memberSince: '2025-01-01T00:00:00.000Z',
    },
    ...overrides,
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const codeInput = (): HTMLInputElement => el().querySelector('#claim-code-input') as HTMLInputElement;
  const confirmButton = (): HTMLButtonElement =>
    Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmer la remise'),
    ) as HTMLButtonElement;

  function type(value: string): void {
    const input = codeInput();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    lookup$ = new Subject();
    claim$ = new Subject();
    api = jasmine.createSpyObj<WinnerClaimApiService>('WinnerClaimApiService', [
      'lookup',
      'claim',
      'regenerate',
    ]);
    api.lookup.and.callFake(() => lookup$.asObservable());
    api.claim.and.callFake(() => claim$.asObservable());

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [WinnerClaimComponent],
      providers: [{ provide: WinnerClaimApiService, useValue: api }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(WinnerClaimComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('autofocuses the code input', () => {
    expect(document.activeElement).toBe(codeInput());
  });

  it('keeps digits only and does not look up an incomplete code', () => {
    type('12a-3');
    expect(component.code).toBe('123');
    expect(codeInput().value).toBe('123');
    expect(api.lookup).not.toHaveBeenCalled();

    component.submitCode();
    fixture.detectChanges();
    expect(api.lookup).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Saisis les 6 chiffres');
  });

  it('auto-submits once 6 digits are pasted (with separators)', () => {
    type('123 456');
    expect(component.code).toBe('123456');
    expect(api.lookup).toHaveBeenCalledOnceWith('123456');
    expect(component.isLookingUp).toBeTrue();
  });

  it('shows the French API error and stays on the code step on 404', () => {
    type('000000');
    lookup$.error(new HttpErrorResponse({ status: 404, error: { message: 'Code inconnu ou déjà utilisé' } }));
    fixture.detectChanges();

    expect(component.step).toBe('code');
    expect(component.isLookingUp).toBeFalse();
    expect(el().querySelector('#claim-code-error')?.textContent).toContain('Code inconnu ou déjà utilisé');
  });

  it('shows the throttling message on 429', () => {
    type('000000');
    lookup$.error(new HttpErrorResponse({ status: 429 }));
    fixture.detectChanges();
    expect(component.codeError).toContain('Trop de tentatives');
  });

  it('requires the ID check before confirming, then claims with the typed code', () => {
    const completed: ClaimCompletedEvent[] = [];
    component.claimed.subscribe((e) => completed.push(e));

    type('123456');
    lookup$.next([makeMatch()]);
    fixture.detectChanges();

    expect(component.step).toBe('review');
    expect(el().textContent).toContain('Awa Ngono');
    expect(el().textContent).toContain('« Awa Ngono »');
    expect(confirmButton().disabled).toBeTrue();

    // Les URLs d'images non conformes (/uploads/ uniquement) ne sont pas affichees.
    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('.avatar-fallback')?.textContent).toContain('AN');

    component.confirmClaim();
    expect(api.claim).not.toHaveBeenCalled();

    const checkbox = el().querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    expect(component.idChecked).toBeTrue();
    expect(confirmButton().disabled).toBeFalse();

    confirmButton().click();
    expect(api.claim).toHaveBeenCalledOnceWith('r1', '123456');

    claim$.next({ raffleId: 'r1', status: 'DELIVERED', claimedAt: '2026-11-20T09:00:00.000Z' });
    fixture.detectChanges();

    expect(component.step).toBe('done');
    expect(component.code).toBe('');
    expect(el().textContent).toContain('Lot remis');
    expect(completed.length).toBe(1);
    expect(completed[0].match.fulfillmentStatus).toBe('DELIVERED');
  });

  it('disables confirmation for an already delivered prize', () => {
    type('123456');
    lookup$.next([makeMatch({ fulfillmentStatus: 'DELIVERED' })]);
    fixture.detectChanges();

    expect(el().textContent).toContain('déjà été remis');
    expect(el().querySelector('input[type="checkbox"]')).toBeNull();
    component.idChecked = true;
    expect(component.canConfirm).toBeFalse();
    expect(confirmButton().disabled).toBeTrue();
  });

  it('lists several matches and requires choosing one', () => {
    type('123456');
    lookup$.next([makeMatch(), makeMatch({ raffleId: 'r2', prizeTitle: 'TV' })]);
    fixture.detectChanges();

    expect(component.selected).toBeNull();
    expect(el().querySelectorAll('.match-option').length).toBe(2);
    expect(confirmButton().disabled).toBeTrue();

    (el().querySelectorAll('.match-option')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.selected?.raffleId).toBe('r2');
  });

  it('marks the prize delivered and blocks confirm on 409', () => {
    type('123456');
    lookup$.next([makeMatch()]);
    component.idChecked = true;
    component.confirmClaim();
    claim$.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();

    expect(component.step).toBe('review');
    expect(component.claimError).toBe('Ce lot a déjà été remis.');
    expect(component.canConfirm).toBeFalse();
  });

  it('resets to an empty, focused code input for the next winner', () => {
    type('123456');
    lookup$.next([makeMatch()]);
    fixture.detectChanges();

    component.reset();
    fixture.detectChanges();

    expect(component.step).toBe('code');
    expect(component.code).toBe('');
    expect(component.selected).toBeNull();
    expect(codeInput().value).toBe('');
    expect(document.activeElement).toBe(codeInput());
  });

  it('emits proofRequested when embedded, navigates to winners otherwise', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const requested: ClaimCodeMatch[] = [];
    component.proofRequested.subscribe((m) => requested.push(m));

    type('123456');
    lookup$.next([makeMatch()]);
    component.idChecked = true;
    component.confirmClaim();
    claim$.next({ raffleId: 'r1', status: 'DELIVERED', claimedAt: '2026-11-20T09:00:00.000Z' });

    component.requestProof();
    expect(navigate).toHaveBeenCalledWith(['/app/winners'], {
      queryParams: { proof: 'r1', q: 'TK-001' },
    });

    component.embedded = true;
    component.requestProof();
    expect(requested.length).toBe(1);
    expect(requested[0].raffleId).toBe('r1');
  });
});
