import type { TrainWithRoute } from '@/types';
import { formatLateBy } from '@/utils/time';
import type { ReactNode } from 'react';

interface StatsOverviewProps {
  trains: TrainWithRoute[];
  liveCount: number;
  unresolvedCount: number;
}

const StatCard = ({
  title,
  value,
  description,
  accent
}: {
  title: string;
  value: string;
  description: string;
  accent: 'emerald' | 'sky' | 'amber' | 'rose';
}) => {
  const palette: Record<typeof accent, {
    surface: string;
    headline: string;
    tone: 'emerald' | 'sky' | 'amber' | 'rose';
    icon: ReactNode;
    accentLine: string;
  }> = {
    emerald: {
      surface: 'from-[#eaf6ef] to-[#ffffff] border-[#dbeadf]',
      headline: 'text-[#2c7f68]',
      tone: 'emerald',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-6.938-6.49a8.5 8.5 0 0113.876 0M12 12a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      ),
      accentLine: 'bg-[#b9e0d0]'
    },
    sky: {
      surface: 'from-[#e4f1f9] to-[#ffffff] border-[#d7e7f0]',
      headline: 'text-[#316c8a]',
      tone: 'sky',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      accentLine: 'bg-[#b9d9eb]'
    },
    amber: {
      surface: 'from-[#f9ebda] to-[#ffffff] border-[#ead8c2]',
      headline: 'text-[#b26b1f]',
      tone: 'amber',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accentLine: 'bg-[#f4cc99]'
    },
    rose: {
      surface: 'from-[#f8e6ea] to-[#ffffff] border-[#edd5d9]',
      headline: 'text-[#b04d5f]',
      tone: 'rose',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      accentLine: 'bg-[#f4bcc6]'
    }
  };

  const style = palette[accent];

  return (
    <div
      className={`relative flex flex-none min-w-[220px] flex-col gap-2 overflow-hidden rounded-2xl border sm:flex-1 sm:min-w-[160px] sm:p-6 p-4 shadow-[var(--shadow-soft)] bg-gradient-to-br ${style.surface}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${style.accentLine}`} aria-hidden="true" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
          {title}
        </span>
        <span className="emoji-badge" data-tone={style.tone}>
          {style.icon}
        </span>
      </div>
      <span className={`text-2xl sm:text-3xl font-bold leading-tight ${style.headline}`}>{value}</span>
      <span className="text-[12px] sm:text-sm text-[color:var(--ink-muted)] leading-relaxed line-clamp-2">
        {description}
      </span>
    </div>
  );
};

export const StatsOverview = ({ trains, liveCount, unresolvedCount }: StatsOverviewProps) => {
  const total = trains.length || 1;

  const liveCoverage = Math.round((liveCount / total) * 100);

  const onTimeCount = trains.filter((train) => {
    const late = train.livePosition?.lateBy;
    return late != null && late <= 0;
  }).length;
  const onTimePercent = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;

  const delays = trains
    .map((train) => train.livePosition?.lateBy)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const avgDelay = delays.length > 0 ? Math.round(delays.reduce((acc, value) => acc + value, 0) / delays.length) : null;

  const worstDelay = delays.length > 0 ? Math.max(...delays) : null;

  return (
    <section className="-mx-1 sm:mx-0">
  <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>*]:min-w-0 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Live coverage"
          value={`${liveCount}/${total}`}
          description={`~${liveCoverage}% of trains reporting live telemetry`}
          accent="emerald"
        />
        <StatCard
          title="On-time performance"
          value={`${onTimePercent}%`}
          description={`${onTimeCount} trains currently on time or early`}
          accent="sky"
        />
        <StatCard
          title="Average delay"
          value={avgDelay != null ? formatLateBy(avgDelay) : 'No live data'}
          description={
            worstDelay != null
              ? `Worst delay ${formatLateBy(worstDelay)}`
              : 'Waiting for live delay updates'
          }
          accent="amber"
        />
        <StatCard
          title="Needs attention"
          value={unresolvedCount ? `${unresolvedCount} trains` : 'All synced'}
          description={
            unresolvedCount
              ? 'Live updates pending train confirmation'
              : 'Every live signal mapped to a train'
          }
          accent="rose"
        />
      </div>
    </section>
  );
};
