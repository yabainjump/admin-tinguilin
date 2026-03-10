export type RaffleStatus = 'DRAFT' | 'LIVE' | 'CLOSED' | 'DRAWN';

export interface AdminRaffleProduct {
  id: string;
  title: string;
  realValue: number;
  imageUrl: string;
}

export interface AdminRaffle {
  id: string;
  status: RaffleStatus;
  ticketPrice: number;
  currency: string;
  totalTickets: number;
  ticketsSold: number;
  participantsCount: number;
  startAt?: string | null;
  endAt?: string | null;
  rules?: string;
  badge?: string;
  createdAt?: string;
  productId: string;
  product: AdminRaffleProduct | null;
  winnerUserId?: string | null;
  winnerTicketId?: string | null;
  winner?: {
    userId?: string;
    ticketId?: string;
    drawnAt?: string;
  } | null;
}

export interface WinnersResponseItem {
  raffleId: string;
  prizeTitle: string;
  winnerName: string;
  drawnAt: string;
  avatar?: string;
}

export interface WinnersResponse {
  data: WinnersResponseItem[];
}
