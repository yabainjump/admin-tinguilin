export type PollStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export interface AdminPollOption {
  id: string;
  label: string;
  /** Chemin relatif '/uploads/products/...' ou chaine vide. */
  imageUrl: string;
  votes: number;
  percent: number;
}

export interface AdminPoll {
  id: string;
  question: string;
  description: string;
  endsAt: string | null;
  totalVotes: number;
  options: AdminPollOption[];
  status: PollStatus;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

export interface AdminPollsResponse {
  data: AdminPoll[];
}

export interface PollOptionPayload {
  label: string;
  imageUrl?: string;
}

export interface PollPayload {
  question: string;
  description?: string;
  options: PollOptionPayload[];
  endsAt?: string;
}

export const POLL_QUESTION_MAX = 140;
export const POLL_DESCRIPTION_MAX = 280;
export const POLL_OPTION_LABEL_MAX = 80;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

/** Meme contrainte que le backend (CreatePollDto). */
export const POLL_IMAGE_PATH = /^\/uploads\/products\/[A-Za-z0-9._-]+\.(webp|png|jpe?g|gif)$/;
