export interface AdminUsersResponseItem {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  status: 'ACTIVE' | 'SUSPENDED';
  freeTicketsBalance: number;
  createdAt?: string | null;
}

export interface AdminInviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  username?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
}

export interface AdminInviteUserResponse {
  ok: boolean;
  user: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'MODERATOR';
    status: 'ACTIVE' | 'SUSPENDED';
  };
  passwordSetup: {
    ok: boolean;
    message: string;
    expiresInSeconds?: number;
    retryAfterSeconds?: number;
    delivery?: 'EMAIL' | 'LOG';
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaymentsSummaryResponse {
  currency: string;
  totalCashInXaf: number;
  monthCashInXaf: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  pendingPayoutsXaf: number;
  successRate: number;
  byProvider: Record<string, number>;
}

export interface PaymentsReconciliationResponse {
  currency: string;
  range: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  intentsAmountXaf: number;
  confirmedCashInXaf: number;
  pendingAmountXaf: number;
  failedAmountXaf: number;
  reconciliationGapXaf: number;
  byProvider: Record<
    string,
    {
      intentsXaf: number;
      confirmedXaf: number;
      pendingXaf: number;
      failedXaf: number;
    }
  >;
}

export type DashboardGranularity = 'DAY' | 'MONTH' | 'YEAR';

export interface DashboardAnalyticsKpis {
  ticketsSold: number;
  ticketsSoldDeltaPct: number;
  cashIn: number;
  cashInDeltaPct: number;
  netCashIn: number;
  netCashInDeltaPct: number;
  transactions: number;
  transactionsDeltaPct: number;
  successRate: number;
  successRateDeltaPct: number;
  averageBasket: number;
  averageBasketDeltaPct: number;
}

export interface DashboardAnalyticsSeriesItem {
  bucket: string;
  label: string;
  ticketsSold: number;
  cashIn: number;
  netCashIn: number;
  transactions: number;
  successRate: number;
}

export interface DashboardAnalyticsProviderItem {
  provider: string;
  cashIn: number;
  ticketsSold: number;
  transactions: number;
}

export interface DashboardAnalyticsTopRaffleItem {
  raffleId: string;
  title: string;
  status: string;
  ticketsSold: number;
  cashIn: number;
  participants: number;
}

export interface DashboardAnalyticsResponse {
  granularity: DashboardGranularity;
  timezone: string;
  currency: string;
  range: {
    label: string;
    dateFrom: string;
    dateTo: string;
  };
  kpis: DashboardAnalyticsKpis;
  series: DashboardAnalyticsSeriesItem[];
  byProvider: DashboardAnalyticsProviderItem[];
  topRaffles: DashboardAnalyticsTopRaffleItem[];
  recentTransactions: AdminTransactionItem[];
}

export interface AdminTransactionItem {
  id: string;
  amount: number;
  currency: string;
  quantity: number;
  provider: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  providerRef?: string;
  createdAt?: string;
  confirmedAt?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  raffle?: {
    id: string;
    status: string;
  };
  product?: {
    title: string;
    imageUrl?: string;
  };
}

export type WinnerWorkflowStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'IN_SHIPPING'
  | 'DELIVERED';

export interface AdminWinnerItem {
  raffleId: string;
  winnerUserId: string | null;
  winnerName: string;
  winnerFirstName: string;
  winnerLastName: string;
  winnerUsername: string;
  winnerEmail: string;
  winnerAvatar: string;
  winnerPhone: string;
  winnerRole: string;
  winnerAccountStatus: string;
  productTitle: string;
  productSubtitle: string;
  productImageUrl: string;
  ticketSerial: string | null;
  ticketId: string | null;
  raffleDate: string | null;
  status: WinnerWorkflowStatus;
  prizeValue: number;
}

export interface AdminWinnersSummary {
  currency: string;
  pendingActions: number;
  totalRewardsXaf: number;
  deliveriesRate: number;
  deliveredCount: number;
  totalWinners: number;
}

export interface AdminWinnersResponse extends PaginatedResponse<AdminWinnerItem> {
  summary: AdminWinnersSummary;
}

export interface GlobalSearchUserResult {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  avatar?: string | null;
  route: string;
}

export interface GlobalSearchPaymentResult {
  id: string;
  amount: number;
  status: string;
  customerName: string;
  route: string;
}

export interface GlobalSearchRaffleResult {
  id: string;
  title: string;
  status: string;
  route: string;
}

export interface GlobalSearchWinnerResult {
  raffleId: string;
  winnerName: string;
  productTitle: string;
  route: string;
}

export interface GlobalSearchResponse {
  query: string;
  users: GlobalSearchUserResult[];
  customers: GlobalSearchUserResult[];
  payments: GlobalSearchPaymentResult[];
  raffles: GlobalSearchRaffleResult[];
  winners: GlobalSearchWinnerResult[];
}
