import { DollarSign, FileText, TrendingUp } from 'lucide-react';

interface OverviewCardProps {
  proposalsThisMonth: number;
  revenueThisMonth: number; // in cents
}

export function OverviewCard({ proposalsThisMonth, revenueThisMonth }: OverviewCardProps) {
  const formatRevenue = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}k`;
    }
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground tracking-tight">Overview</p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This month</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="divide-y divide-border/40">
        {/* Revenue */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-primary">Revenue Generated</p>
              <p className="text-[11px] text-muted-foreground">From paid invoices</p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
            {formatRevenue(revenueThisMonth)}
          </p>
        </div>

        {/* Proposals */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <FileText className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-primary">Proposals Created</p>
              <p className="text-[11px] text-muted-foreground">New this month</p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
            {proposalsThisMonth}
          </p>
        </div>
      </div>
    </div>
  );
}
