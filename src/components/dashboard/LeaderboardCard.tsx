import { Trophy } from 'lucide-react';

export interface LeaderEntry {
  rep_name: string;
  revenue_cents: number;
  proposal_count: number;
}

interface LeaderboardCardProps {
  entries: LeaderEntry[];
}

const MEDAL_COLORS = [
  'text-yellow-500',
  'text-slate-400',
  'text-amber-600',
];

const RANK_BG = [
  'bg-yellow-500/10',
  'bg-slate-400/10',
  'bg-amber-600/10',
];

export function LeaderboardCard({ entries }: LeaderboardCardProps) {
  const formatRevenue = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}k`;
    }
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const maxRevenue = Math.max(...entries.map((e) => e.revenue_cents), 1);

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground tracking-tight">Leaderboard</p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Top reps · this month</p>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="px-5 py-3 space-y-3">
        {entries.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-muted-foreground">No revenue data yet this month</p>
          </div>
        ) : (
          entries.slice(0, 5).map((entry, i) => (
            <div key={entry.rep_name} className="flex items-center gap-3 py-1.5">
              {/* Rank */}
              <div className={`w-6 h-6 rounded-lg ${i < 3 ? RANK_BG[i] : 'bg-muted/60'} flex items-center justify-center flex-shrink-0`}>
                <span className={`text-[11px] font-bold ${i < 3 ? MEDAL_COLORS[i] : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-foreground truncate">{entry.rep_name}</span>
                  <span className="text-[13px] font-semibold text-foreground tabular-nums ml-2 flex-shrink-0">
                    {formatRevenue(entry.revenue_cents)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      i === 0 ? 'gradient-water' : 'bg-primary/40'
                    }`}
                    style={{ width: `${(entry.revenue_cents / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
