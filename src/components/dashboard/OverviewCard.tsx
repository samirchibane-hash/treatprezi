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
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-water flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground tracking-tight">Overview</p>
            <p className="text-[11px] text-muted-foreground">This month</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="divide-y divide-border/40">
        {/* Revenue */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground font-medium">Revenue Generated</p>
              <p className="text-[11px] text-muted-foreground/70">From paid invoices</p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
            {formatRevenue(revenueThisMonth)}
          </p>
        </div>

        {/* Proposals */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground font-medium">Proposals Created</p>
              <p className="text-[11px] text-muted-foreground/70">New this month</p>
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
