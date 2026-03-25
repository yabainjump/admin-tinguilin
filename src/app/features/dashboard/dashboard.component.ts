import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AdminTransactionItem,
  DashboardAnalyticsResponse,
  DashboardGranularity,
} from '../../core/models/admin.models';
import { AdminApiService } from '../../core/services/admin-api.service';
import { resolveAvatarUrl } from '../../core/utils/avatar.util';
import { environment } from '../../../environments/environment';

interface StatCard {
  label: string;
  value: string;
  deltaPct: number;
  hint: string;
}

interface DashboardChartPoint {
  label: string;
  fullLabel: string;
  ticketsSold: number;
  cashIn: number;
}

interface SvgConfig {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

interface SvgTrendPoint {
  x: number;
  y: number;
  label: string;
  fullLabel: string;
  value: number;
}

interface SvgBar {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  label: string;
  fullLabel: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  isLoading = true;
  errorMessage = '';

  readonly granularities: DashboardGranularity[] = ['DAY', 'MONTH', 'YEAR'];
  granularity: DashboardGranularity = 'DAY';
  analytics: DashboardAnalyticsResponse | null = null;
  dayFrom = '';
  dayTo = '';
  monthFrom = '';
  monthTo = '';
  yearFrom = '';
  yearTo = '';

  readonly ticketsSvg: SvgConfig = {
    width: 960,
    height: 280,
    padLeft: 28,
    padRight: 16,
    padTop: 16,
    padBottom: 34,
  };

  readonly cashSvg: SvgConfig = {
    width: 960,
    height: 280,
    padLeft: 28,
    padRight: 16,
    padTop: 16,
    padBottom: 34,
  };

  private readonly backgroundRefreshMs = 60000;
  private refreshTimerId: number | null = null;
  private isFetching = false;
  private readonly visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      this.loadDashboardAnalytics(false);
    }
  };

  constructor(private readonly adminApi: AdminApiService) {}

  ngOnInit(): void {
    this.initializeRangeDefaults();
    this.loadDashboardAnalytics();
    this.startBackgroundRefresh();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy(): void {
    this.stopBackgroundRefresh();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  setGranularity(next: DashboardGranularity): void {
    if (this.granularity === next) return;
    this.granularity = next;
    this.loadDashboardAnalytics();
  }

  applyRange(): void {
    this.loadDashboardAnalytics();
  }

  resetCurrentRange(): void {
    const now = new Date();

    if (this.granularity === 'DAY') {
      const from = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      this.dayFrom = this.toDatetimeLocal(from);
      this.dayTo = this.toDatetimeLocal(now);
    } else if (this.granularity === 'MONTH') {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      this.monthFrom = this.toMonthInput(from);
      this.monthTo = this.toMonthInput(now);
    } else {
      this.yearFrom = String(now.getFullYear() - 4);
      this.yearTo = String(now.getFullYear());
    }

    this.errorMessage = '';
    this.loadDashboardAnalytics();
  }

  get stats(): StatCard[] {
    if (!this.analytics) return [];

    const kpis = this.analytics.kpis;
    return [
      {
        label: 'Tickets Sold',
        value: this.toNumber(kpis.ticketsSold),
        deltaPct: kpis.ticketsSoldDeltaPct,
        hint: this.analytics.range.label,
      },
      {
        label: 'Cash-In Brut (FCFA)',
        value: this.toFcfa(kpis.cashIn),
        deltaPct: kpis.cashInDeltaPct,
        hint: this.analytics.range.label,
      },
      {
        label: 'Cash-In Net (FCFA)',
        value: this.toFcfa(kpis.netCashIn),
        deltaPct: kpis.netCashInDeltaPct,
        hint: this.analytics.range.label,
      },
      {
        label: 'Transactions',
        value: this.toNumber(kpis.transactions),
        deltaPct: kpis.transactionsDeltaPct,
        hint: this.analytics.range.label,
      },
      {
        label: 'Success Rate',
        value: `${kpis.successRate}%`,
        deltaPct: kpis.successRateDeltaPct,
        hint: 'Paiements valides',
      },
      {
        label: 'Panier Moyen',
        value: this.toFcfa(kpis.averageBasket),
        deltaPct: kpis.averageBasketDeltaPct,
        hint: 'Par transaction success',
      },
    ];
  }

  get chartPoints(): DashboardChartPoint[] {
    const source = this.analytics?.series ?? [];
    if (!source.length) return [];

    const maxPoints = 12;
    if (source.length <= maxPoints) {
      return source.map((row) => ({
        label: this.compactSeriesLabel(row.label),
        fullLabel: row.label,
        ticketsSold: Number(row.ticketsSold ?? 0),
        cashIn: Number(row.cashIn ?? 0),
      }));
    }

    const chunkSize = Math.ceil(source.length / maxPoints);
    const points: DashboardChartPoint[] = [];

    for (let i = 0; i < source.length; i += chunkSize) {
      const chunk = source.slice(i, i + chunkSize);
      if (!chunk.length) continue;

      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const firstLabel = this.compactSeriesLabel(first.label);
      const lastLabel = this.compactSeriesLabel(last.label);

      points.push({
        label: firstLabel === lastLabel ? firstLabel : `${firstLabel}-${lastLabel}`,
        fullLabel:
          first.label === last.label ? first.label : `${first.label} -> ${last.label}`,
        ticketsSold: chunk.reduce(
          (sum, row) => sum + Number(row.ticketsSold ?? 0),
          0,
        ),
        cashIn: chunk.reduce((sum, row) => sum + Number(row.cashIn ?? 0), 0),
      });
    }

    return points;
  }

  get ticketsPoints(): SvgTrendPoint[] {
    const points = this.chartPoints;
    if (!points.length) return [];

    const maxValue = Math.max(
      1,
      ...points.map((row) => Number(row.ticketsSold ?? 0)),
    );

    return points.map((row, index) => ({
      x: this.xAt(index, points.length, this.ticketsSvg),
      y: this.yAt(row.ticketsSold, maxValue, this.ticketsSvg),
      label: row.label,
      fullLabel: row.fullLabel,
      value: row.ticketsSold,
    }));
  }

  get ticketsLinePath(): string {
    const points = this.ticketsPoints;
    if (!points.length) return '';

    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x} ${p.y} L ${p.x} ${p.y}`;
    }

    return points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }

  get ticketsAreaPath(): string {
    const points = this.ticketsPoints;
    if (!points.length) return '';

    const baseY = this.baseY(this.ticketsSvg);

    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x} ${baseY} L ${p.x} ${p.y} L ${p.x} ${baseY} Z`;
    }

    const line = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const first = points[0];
    const last = points[points.length - 1];
    return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }

  get ticketsGridY(): number[] {
    return this.gridLines(this.ticketsSvg);
  }

  get ticketsLabelY(): number {
    return this.baseY(this.ticketsSvg) + 17;
  }

  get cashBars(): SvgBar[] {
    const points = this.chartPoints;
    if (!points.length) return [];

    const cfg = this.cashSvg;
    const innerWidth = this.innerWidth(cfg);
    const count = points.length;
    const slot = innerWidth / count;
    const barWidth = Math.max(10, Math.min(40, slot * 0.62));
    const baseY = this.baseY(cfg);
    const maxValue = Math.max(1, ...points.map((row) => Number(row.cashIn ?? 0)));

    return points.map((row, index) => {
      const x = cfg.padLeft + index * slot + (slot - barWidth) / 2;
      const y = this.yAt(row.cashIn, maxValue, cfg);
      const height = Math.max(0, baseY - y);

      return {
        x,
        y,
        width: barWidth,
        height,
        centerX: x + barWidth / 2,
        label: row.label,
        fullLabel: row.fullLabel,
        value: row.cashIn,
      };
    });
  }

  get cashGridY(): number[] {
    return this.gridLines(this.cashSvg);
  }

  get cashLabelY(): number {
    return this.baseY(this.cashSvg) + 17;
  }

  showChartLabel(index: number, total: number): boolean {
    const count = Math.max(1, Number(total ?? 0));
    if (count <= 6) return true;

    const step = Math.max(1, Math.ceil(count / 6));
    return index % step === 0 || index === count - 1;
  }

  compactSeriesLabel(label: string): string {
    const raw = String(label ?? '').trim();
    if (!raw) return '-';

    if (this.granularity === 'DAY') {
      const [datePart = '', hourPart = ''] = raw.split(' ');
      const dateParts = datePart.split('/');
      if (dateParts.length >= 2) {
        const compactDate = `${dateParts[0]}/${dateParts[1]}`;
        return hourPart ? `${compactDate} ${hourPart}` : compactDate;
      }
      return raw;
    }

    if (this.granularity === 'MONTH') {
      const parts = raw.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1].slice(-2)}`;
      }
    }

    return raw;
  }

  deltaTone(value: number): 'positive' | 'negative' {
    return value >= 0 ? 'positive' : 'negative';
  }

  providerLabel(provider: string): string {
    const normalized = String(provider ?? '').trim().toUpperCase();
    if (!normalized) return 'Unknown';
    if (normalized === 'OM') return 'Orange Money';
    if (normalized === 'MOMO') return 'MTN MoMo';
    return normalized.replace(/_/g, ' ');
  }

  txCustomerName(tx: AdminTransactionItem): string {
    const name = `${String(tx.user?.firstName ?? '').trim()} ${String(tx.user?.lastName ?? '').trim()}`.trim();
    return name || 'Unknown Customer';
  }

  txAvatar(tx: AdminTransactionItem): string | null {
    return resolveAvatarUrl(tx.user?.avatar, environment.apiBaseUrl);
  }

  txInitials(tx: AdminTransactionItem): string {
    const name = this.txCustomerName(tx);
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  txStatusLabel(status: string): string {
    const value = String(status ?? '').toUpperCase();
    if (value === 'SUCCESS') return 'Success';
    if (value === 'PENDING') return 'Pending';
    if (value === 'FAILED') return 'Failed';
    if (value === 'REFUNDED') return 'Refunded';
    return value || 'Unknown';
  }

  txStatusTone(status: string): 'success' | 'pending' | 'failed' | 'refunded' {
    const value = String(status ?? '').toUpperCase();
    if (value === 'SUCCESS') return 'success';
    if (value === 'PENDING') return 'pending';
    if (value === 'REFUNDED') return 'refunded';
    return 'failed';
  }

  private initializeRangeDefaults(): void {
    const now = new Date();

    if (!this.dayFrom || !this.dayTo) {
      const dayFrom = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      this.dayFrom = this.toDatetimeLocal(dayFrom);
      this.dayTo = this.toDatetimeLocal(now);
    }

    if (!this.monthFrom || !this.monthTo) {
      const monthFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      this.monthFrom = this.toMonthInput(monthFrom);
      this.monthTo = this.toMonthInput(now);
    }

    if (!this.yearFrom || !this.yearTo) {
      this.yearFrom = String(now.getFullYear() - 4);
      this.yearTo = String(now.getFullYear());
    }
  }

  private startBackgroundRefresh(): void {
    this.stopBackgroundRefresh();
    this.refreshTimerId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.loadDashboardAnalytics(false);
    }, this.backgroundRefreshMs);
  }

  private stopBackgroundRefresh(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private buildRangeParams():
    | { dateFrom: string; dateTo: string }
    | null {
    this.initializeRangeDefaults();

    if (this.granularity === 'DAY') {
      const from = new Date(this.dayFrom);
      const to = new Date(this.dayTo);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        this.errorMessage = 'Selection heure invalide. Verifie la plage JOUR.';
        return null;
      }
      if (from.getTime() > to.getTime()) {
        this.errorMessage = 'La borne de debut doit etre inferieure a la borne de fin.';
        return null;
      }
      return {
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
      };
    }

    if (this.granularity === 'MONTH') {
      const fromMonth = this.parseMonthInput(this.monthFrom);
      const toMonth = this.parseMonthInput(this.monthTo);
      if (!fromMonth || !toMonth) {
        this.errorMessage = 'Selection mois invalide. Verifie la plage MOIS.';
        return null;
      }

      const from = new Date(fromMonth.year, fromMonth.monthIndex, 1, 0, 0, 0, 0);
      const to = new Date(
        toMonth.year,
        toMonth.monthIndex + 1,
        0,
        23,
        59,
        59,
        999,
      );

      if (from.getTime() > to.getTime()) {
        this.errorMessage = 'La borne de debut doit etre inferieure a la borne de fin.';
        return null;
      }

      return {
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
      };
    }

    const fromYear = this.parseYearInput(this.yearFrom);
    const toYear = this.parseYearInput(this.yearTo);
    if (fromYear === null || toYear === null) {
      this.errorMessage = 'Selection annee invalide. Verifie la plage ANNEE.';
      return null;
    }

    const from = new Date(fromYear, 0, 1, 0, 0, 0, 0);
    const to = new Date(toYear, 11, 31, 23, 59, 59, 999);

    if (from.getTime() > to.getTime()) {
      this.errorMessage = 'La borne de debut doit etre inferieure a la borne de fin.';
      return null;
    }

    return {
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
    };
  }

  private parseMonthInput(
    value: string,
  ): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    if (month < 1 || month > 12) return null;

    return { year, monthIndex: month - 1 };
  }

  private parseYearInput(value: string): number | null {
    const year = Number(String(value ?? '').trim());
    if (!Number.isFinite(year)) return null;
    const normalized = Math.trunc(year);
    if (normalized < 2000 || normalized > 2100) return null;
    return normalized;
  }

  private toDatetimeLocal(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toMonthInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  private loadDashboardAnalytics(showLoader = true): void {
    const range = this.buildRangeParams();
    if (!range) {
      this.isLoading = false;
      return;
    }

    if (this.isFetching) return;

    this.errorMessage = '';
    if (showLoader || !this.analytics) {
      this.isLoading = true;
    }

    this.isFetching = true;

    this.adminApi
      .getDashboardAnalytics({
        granularity: this.granularity,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      })
      .subscribe({
        next: (analytics) => {
          this.analytics = analytics;
          this.errorMessage = '';
          this.isLoading = false;
          this.isFetching = false;
        },
        error: () => {
          if (!this.analytics) {
            this.errorMessage = 'Impossible de charger les analytics dashboard.';
          }
          this.isFetching = false;
          this.isLoading = false;
        },
      });
  }

  private innerWidth(cfg: SvgConfig): number {
    return Math.max(1, cfg.width - cfg.padLeft - cfg.padRight);
  }

  private innerHeight(cfg: SvgConfig): number {
    return Math.max(1, cfg.height - cfg.padTop - cfg.padBottom);
  }

  private baseY(cfg: SvgConfig): number {
    return cfg.height - cfg.padBottom;
  }

  private xAt(index: number, total: number, cfg: SvgConfig): number {
    const inner = this.innerWidth(cfg);
    if (total <= 1) {
      return cfg.padLeft + inner / 2;
    }
    return cfg.padLeft + (index * inner) / (total - 1);
  }

  private yAt(value: number, max: number, cfg: SvgConfig): number {
    const base = this.baseY(cfg);
    if (max <= 0) return base;

    const normalized = Math.max(0, Math.min(max, Number(value ?? 0)));
    const ratio = normalized / max;
    return cfg.padTop + (1 - ratio) * this.innerHeight(cfg);
  }

  private gridLines(cfg: SvgConfig): number[] {
    const lines = 5;
    const start = cfg.padTop;
    const end = this.baseY(cfg);
    const result: number[] = [];

    for (let i = 0; i < lines; i++) {
      result.push(start + ((end - start) * i) / (lines - 1));
    }

    return result;
  }

  private toFcfa(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(value)} FCFA`;
  }

  private toNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(value);
  }
}
