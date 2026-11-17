import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminPoll, AdminPollsResponse, PollPayload } from '../models/poll.models';

/** Sondages "Choisis le prochain lot" (endpoints admin). */
@Injectable({ providedIn: 'root' })
export class PollsApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listPolls(): Observable<AdminPoll[]> {
    return this.http
      .get<AdminPollsResponse>(`${this.apiBaseUrl}/admin/polls`)
      .pipe(map((res) => (Array.isArray(res?.data) ? res.data : [])));
  }

  createPoll(payload: PollPayload): Observable<AdminPoll> {
    return this.http.post<AdminPoll>(`${this.apiBaseUrl}/admin/polls`, payload);
  }

  updatePoll(pollId: string, payload: PollPayload): Observable<AdminPoll> {
    return this.http.put<AdminPoll>(`${this.pollUrl(pollId)}`, payload);
  }

  openPoll(pollId: string): Observable<AdminPoll> {
    return this.http.patch<AdminPoll>(`${this.pollUrl(pollId)}/open`, {});
  }

  closePoll(pollId: string): Observable<AdminPoll> {
    return this.http.patch<AdminPoll>(`${this.pollUrl(pollId)}/close`, {});
  }

  deletePoll(pollId: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.pollUrl(pollId)}`);
  }

  private pollUrl(pollId: string): string {
    return `${this.apiBaseUrl}/admin/polls/${encodeURIComponent(pollId)}`;
  }
}
