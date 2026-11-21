import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClaimCodeLookupResponse,
  ClaimCodeMatch,
  ClaimPrizeResponse,
  RegenerateClaimCodeResponse,
} from '../models/admin.models';

/**
 * Remise d'un lot par code gagnant (endpoints admin, JWT via l'intercepteur).
 * Le code est saisi par l'admin a partir de ce que montre le gagnant ; l'API ne
 * le renvoie jamais. Le code ne transite que dans le corps des requetes POST
 * (jamais dans l'URL ni dans les logs).
 */
@Injectable({ providedIn: 'root' })
export class WinnerClaimApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /** Retrouve le(s) lot(s) associe(s) a un code. Ne consomme pas le code. */
  lookup(code: string): Observable<ClaimCodeMatch[]> {
    return this.http
      .post<ClaimCodeLookupResponse>(`${this.winnersUrl()}/claim-code/lookup`, { code })
      .pipe(map((res) => (Array.isArray(res?.matches) ? res.matches : [])));
  }

  /** Confirme la remise en main propre : le lot passe directement a DELIVERED. */
  claim(raffleId: string, code: string): Observable<ClaimPrizeResponse> {
    return this.http.post<ClaimPrizeResponse>(
      `${this.winnersUrl()}/${encodeURIComponent(raffleId)}/claim`,
      { code },
    );
  }

  /** Genere un nouveau code (envoye par email au gagnant) et invalide l'ancien. */
  regenerate(raffleId: string): Observable<RegenerateClaimCodeResponse> {
    return this.http.post<RegenerateClaimCodeResponse>(
      `${this.winnersUrl()}/${encodeURIComponent(raffleId)}/claim-code/regenerate`,
      {},
    );
  }

  private winnersUrl(): string {
    return `${this.apiBaseUrl}/admin/raffles/winners`;
  }
}
