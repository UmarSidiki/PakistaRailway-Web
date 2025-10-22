import type { TrainWithRoute } from '@/types';
import { formatLateBy, formatRelativeTime, formatSpeed } from '@/utils/time';
import { StatusChip } from './StatusChip';
import { getTrainUniqueKey } from '@/lib/train';

interface TrainListProps {
  trains: TrainWithRoute[];
  selectedTrainId?: string;
  onSelect: (trainId: string) => void;
}

/**
 * Props for the TrainList component.
 * @typedef {Object} TrainListProps
 * @property {TrainWithRoute[]} trains - List of trains to display.
 * @property {string=} selectedTrainId - The currently selected train's unique key.
 * @property {(trainId: string) => void} onSelect - Callback when a train is selected.
 */

/**
 * Renders a list of trains with live status and selection.
 * Optimized for performance and maintainability.
 */
import React from "react";

const TrainRow = React.memo(
  ({
    train,
    uniqueKey,
    isSelected,
    onSelect,
  }: {
    train: TrainWithRoute;
    uniqueKey: string;
    isSelected: boolean;
    onSelect: (trainId: string) => void;
  }) => {
    const live = train.livePosition;
    return (
      <button
        key={uniqueKey}
        type="button"
        onClick={() => onSelect(uniqueKey)}
        className={`group relative w-full border-b border-[#f0e4d4] px-5 py-3 text-left transition-all hover:bg-[#f3efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cde5db] ${
          isSelected ? "bg-[#f3efe6] shadow-inner ring-1 ring-[#b9e0d0]" : ""
        }`}
      >
        {/* Train Name & Number */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-sm font-bold ${
                isSelected
                  ? "text-[#2c7f68]"
                  : "text-[color:var(--ink-strong)]"
              } group-hover:text-[#2c7f68]`}
            >
              {train.TrainName}
            </h3>
            <p className="truncate text-xs text-neutral-400">
              {train.TrainDescription || "No description"}
            </p>
          </div>
          {live && <StatusChip variant="live" label="Live" />}
        </div>

        {/* Train Info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[color:var(--ink-muted)]">
          {/* Next Station */}
          {train.upcomingStop && (
            <span className="flex items-center gap-1 text-[color:var(--ink-strong)]">
              <svg
                className="h-3.5 w-3.5 text-[#2c7f68]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="max-w-[140px] truncate font-medium">
                {train.upcomingStop.StationName}
              </span>
            </span>
          )}

          {/* Live Data */}
          {live && (
            <>
              <span className="flex items-center gap-1 text-[color:var(--ink-strong)]">
                <span
                  className="emoji-badge h-7 w-7 text-sm"
                  data-tone="emerald"
                  aria-hidden="true"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </span>
                <span className="font-semibold">{formatSpeed(live.speed)}</span>
              </span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  (live.lateBy ?? 0) > 0
                    ? "text-[#b15b62]"
                    : "text-[#2c7f68]"
                }`}
              >
                <span
                  className="emoji-badge h-7 w-7 text-sm"
                  data-tone={(live.lateBy ?? 0) > 0 ? "rose" : "emerald"}
                  aria-hidden="true"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <span>{formatLateBy(live.lateBy)}</span>
              </span>
              {live.lastUpdated && (
                <span className="flex items-center gap-1 text-[color:var(--ink-muted)]">
                  <span
                    className="emoji-badge h-7 w-7 text-sm"
                    data-tone="slate"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span>{formatRelativeTime(live.lastUpdated)}</span>
                </span>
              )}
            </>
          )}
        </div>
      </button>
    );
  }
);

TrainRow.displayName = "TrainRow";

export const TrainList: React.FC<TrainListProps> = React.memo(
  ({ trains, selectedTrainId, onSelect }) => {
    const liveCount = trains.filter((train) => Boolean(train.livePosition)).length;

    return (
      <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-[color:var(--stroke)] bg-[#fffaf3]/85 shadow-[0_28px_60px_-48px_rgba(95,75,60,0.65)] backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] bg-gradient-to-r from-[#fbead3] via-[#fff4e4] to-[#fffaf4] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
              Train directory
            </p>
            <h2 className="text-lg font-semibold text-[color:var(--ink-strong)]">
              {trains.length} trains
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#cfe7da] bg-[#e7f6ef] px-3.5 py-1.5 text-xs font-semibold text-[#2c7f68] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <span className="h-2 w-2 rounded-full bg-[#2c7f68]" />
            <span>{liveCount} live</span>
          </div>
        </div>

        {/* Train List */}
        <div className="flex-1 overflow-y-auto">
          {trains.map((train) => {
            const uniqueKey = getTrainUniqueKey(train);
            return (
              <TrainRow
                key={uniqueKey}
                train={train}
                uniqueKey={uniqueKey}
                isSelected={uniqueKey === selectedTrainId}
                onSelect={onSelect}
              />
            );
          })}

          {/* Empty State */}
          {trains.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-[color:var(--ink-muted)]">
              <svg
                className="h-16 w-16 text-[#e1d6c8]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[color:var(--ink-strong)]">
                  No trains match your filters
                </p>
                <p className="mt-1 text-xs text-[color:var(--ink-muted)]/70">
                  Try a different search or reset filters.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

TrainList.displayName = "TrainList";
