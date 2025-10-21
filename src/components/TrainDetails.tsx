import { StationDetails, TrainStop, TrainWithRoute } from "@/types";
import {
  formatLateBy,
  formatRelativeTime,
  formatSpeed,
  formatTime,
  formatDistance,
  calculateDistance,
  calculateExpectedArrival,
  formatDuration,
} from "@/utils/time";
import { useEffect, useRef, FC, ReactNode } from "react";
import { StatusChip } from "./StatusChip";

// Define Prop types for sub-components
interface TrainDetailsProps {
  train?: TrainWithRoute;
  stationLookup: Map<number, StationDetails>;
  onSelectRun?: (trainId: number, runId: string) => void;
}

interface InfoCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  accent?: "emerald" | "sky" | "slate";
  subtitle?: string;
}

// --- Helper Logic ---
type StopState = "passed" | "current" | "upcoming" | "normal";

const parseTimeToMinutes = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const [hoursPart, minutesPart] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const calculateDwell = (arrival: string, departure: string): number | null => {
  const arrivalMinutes = parseTimeToMinutes(arrival);
  const departureMinutes = parseTimeToMinutes(departure);
  if (arrivalMinutes == null || departureMinutes == null) return null;

  let dwell = departureMinutes - arrivalMinutes;
  if (dwell < 0) {
    dwell += 24 * 60;
  }

  return dwell;
};

const getStopState = (
  train: TrainWithRoute,
  stop: TrainStop,
  index: number
): StopState => {
  if (train.livePosition) {
    const { prevStationId, nextStationId } = train.livePosition;

    // Current/next station
    if (nextStationId && stop.StationId === nextStationId) return "current";

    // Previous/passed station
    if (prevStationId && stop.StationId === prevStationId) return "passed";

    // All stations before the previous station are also passed
    const prevStationIndex = train.route.findIndex(
      (s) => s.StationId === prevStationId
    );
    if (prevStationIndex !== -1 && index < prevStationIndex) return "passed";
  }

  // Fallback to upcoming stop
  if (train.upcomingStop && stop.StationId === train.upcomingStop.StationId)
    return "current";

  return "normal";
};

const stopStyles: Record<StopState, string> = {
  passed:
    "border-[#e4d7c5] bg-[#f4e6d6] text-[color:var(--ink-muted)]/85 opacity-80",
  current:
    "border-[#2c7f68] bg-gradient-to-br from-[#e7f6ef] to-[#fdfbf8] text-[#2c7f68] shadow-[0_20px_40px_-34px_rgba(44,127,104,0.55)] ring-2 ring-[#b9e0d0]",
  upcoming: "border-[#cde5db] bg-[#f4fbf7] text-[#2c7f68]",
  normal:
    "border-[color:var(--stroke)] bg-[#fffaf3] text-[color:var(--ink-muted)] hover:border-[#d8c8b4]",
};

// --- Sub-components for a Cleaner Structure ---

// Placeholder for when no train is selected
const NoTrainSelected: FC = () => (
  <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff8f1] via-[#fff3e2] to-[#fffdf8] p-8 text-center text-[color:var(--ink-muted)] shadow-[0_24px_45px_-38px_rgba(95,75,60,0.55)] lg:p-16">
    <div className="mb-4 rounded-full bg-[#f4e6d6] p-4 shadow-inner lg:mb-6 lg:p-6">
      <svg
        className="h-12 w-12 text-[#d2bda2] lg:h-16 lg:w-16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    </div>
    <h3 className="mb-2 text-base font-semibold text-[color:var(--ink-strong)] lg:text-lg">
      No Train Selected
    </h3>
    <p className="max-w-xs text-xs text-[color:var(--ink-muted)]/80 lg:text-sm">
      Select a train from the list to view detailed information, live position,
      and route schedule.
    </p>
  </div>
);

// Reusable Info Card
const InfoCard: FC<InfoCardProps> = ({
  title,
  subtitle,
  icon,
  children,
  accent = "slate",
}) => {
  const palette: Record<
    NonNullable<InfoCardProps["accent"]>,
    { shell: string; text: string; icon: string }
  > = {
    emerald: {
      shell:
        "bg-gradient-to-br from-[#e7f6ef] via-white to-[#e7f6ef] border-[#cfe7da]",
      text: "text-[#2c7f68]",
      icon: "text-[#2c7f68]",
    },
    sky: {
      shell:
        "bg-gradient-to-br from-[#e8f1f8] via-white to-[#e8f1f8] border-[#d7e4ef]",
      text: "text-[#3b6f8e]",
      icon: "text-[#3b6f8e]",
    },
    slate: {
      shell: "bg-[#fffaf3] border-[color:var(--stroke)]",
      text: "text-[color:var(--ink-strong)]",
      icon: "text-[color:var(--ink-muted)]",
    },
  };

  const colors = palette[accent];

  return (
    <div
      className={`group rounded-2xl border ${colors.shell} p-4 shadow-[0_22px_40px_-36px_rgba(95,75,60,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_55px_-32px_rgba(95,75,60,0.5)] lg:p-5`}
    >
      <div className="flex items-start justify-between gap-2 lg:gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)] lg:gap-2.5 lg:text-sm">
          <div
            className={`rounded-xl bg-white/85 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-white ${colors.icon}`}
          >
            {icon}
          </div>
          <div className="flex flex-col gap-1 text-[color:var(--ink-muted)]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)] lg:text-xs">
              {title}
            </span>
            {subtitle && (
              <span className="text-[11px] font-medium text-[color:var(--ink-muted)]/70 normal-case lg:text-xs">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={`mt-4 text-sm leading-relaxed ${colors.text}`}>
        {children}
      </div>
    </div>
  );
};

// --- Main Component ---

export const TrainDetails = ({
  train,
  stationLookup,
  onSelectRun,
}: TrainDetailsProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Effect to scroll the active station into view
  useEffect(() => {
    if (!train) return;
    const activeStopIndex = train.route.findIndex((stop, idx) => {
      const state = getStopState(train, stop, idx);
      return state === "current";
    });

    if (activeStopIndex !== -1) {
      const activeStop = train.route[activeStopIndex];
      const stopKey = `${train.TrainId}-${activeStop.StationId}-${activeStop.OrderNumber}`;
      const targetElement = stopRefs.current.get(stopKey);

      if (targetElement && scrollContainerRef.current) {
        // Calculate horizontal scroll position manually to avoid vertical scrolling
        const container = scrollContainerRef.current;
        const elementRect = targetElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const scrollLeft =
          targetElement.offsetLeft -
          container.offsetLeft -
          containerRect.width / 2 +
          elementRect.width / 2;

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  }, [train]);

  if (!train) {
    return <NoTrainSelected />;
  }

  const live = train.livePosition;
  const originStop = train.route[0];
  const destinationStop = train.route[train.route.length - 1];
  const directionLabel = train.IsUp ? "Northbound" : "Southbound";

  type HeaderChip = {
    id: string;
    label: string;
    tone: "emerald" | "sky" | "rose" | "neutral";
    icon: ReactNode;
  };

  const headerChips = (
    [
      {
        id: "train",
        label: `Train ${train.TrainNumber}`,
        tone: "neutral",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
      },
      {
        id: "direction",
        label: directionLabel,
        tone: "sky",
        icon: train.IsUp ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        ),
      },
      live?.locomitiveNo
        ? {
            id: "loco",
            label: `Loco ${live.locomitiveNo}`,
            tone: "emerald",
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          }
        : null,
      live?.nextStopName
        ? {
            id: "next",
            label: `Next • ${live.nextStopName}`,
            tone: "emerald",
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          }
        : null,
    ] as Array<HeaderChip | null>
  ).filter((chip): chip is HeaderChip => chip !== null);

  const upcomingDistanceKm =
    live &&
    train.upcomingStop &&
    train.upcomingStop.Latitude != null &&
    train.upcomingStop.Longitude != null
      ? calculateDistance(
          live.lat,
          live.lon,
          train.upcomingStop.Latitude,
          train.upcomingStop.Longitude
        )
      : null;

  const upcomingArrivalEstimate =
    upcomingDistanceKm != null
      ? calculateExpectedArrival(upcomingDistanceKm, live?.speed ?? null)
      : null;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-4 shadow-[0_28px_60px_-38px_rgba(95,75,60,0.55)] backdrop-blur lg:gap-6 lg:p-6">
      {/* Header */}
      <header className="rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] lg:p-5">
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            {(originStop || destinationStop) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]/70">
                {originStop && (
                  <span className="rounded-full bg-[#f4e6d6] px-3 py-1 text-[color:var(--ink-muted)]">
                    {originStop.StationName}
                  </span>
                )}
                <span className="text-[#d7c3aa]">→</span>
                {destinationStop && (
                  <span className="rounded-full bg-[#f4e6d6] px-3 py-1 text-[color:var(--ink-muted)]">
                    {destinationStop.StationName}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-[color:var(--ink-strong)] lg:text-3xl">
                {train.TrainName}
              </h2>
              <StatusChip
                variant={live || train.IsLive ? "live" : "offline"}
                label={live ? "Live" : train.IsLive ? "Active" : "Offline"}
              />
            </div>

            <p className="max-w-xl text-sm text-[color:var(--ink-muted)] lg:text-base">
              {train.TrainDescription ??
                "No description available for this service."}
            </p>

            {!!headerChips.length && (
              <div className="flex flex-wrap items-center gap-2">
                {headerChips.map((chip) => (
                  <span
                    key={chip.id}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset transition-colors ${
                      chip.tone === "emerald"
                        ? "bg-[#e7f6ef] text-[#2c7f68] ring-[#b9e0d0]"
                        : chip.tone === "sky"
                        ? "bg-[#e4f1f9] text-[#3b6f8e] ring-[#c9dfed]"
                        : chip.tone === "rose"
                        ? "bg-[#f9dfe3] text-[#b15b62] ring-[#ebb9c1]"
                        : "bg-[#f4e6d6] text-[color:var(--ink-muted)] ring-[#e4d7c5]"
                    }`}
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Multiple Runs Selector */}
      {train.liveRuns && train.liveRuns.length > 1 && onSelectRun && (
        <section className="rounded-2xl border-l-4 border-[#c27a2f] bg-gradient-to-r from-[#fbead3] via-[#fff3e0] to-white p-4 shadow-[0_22px_40px_-34px_rgba(95,75,60,0.45)] lg:p-5">
          <div className="flex items-start gap-2 lg:gap-3 mb-3 lg:mb-4">
            <div className="p-1.5 lg:p-2 rounded-lg bg-amber-100">
              <svg
                className="w-4 lg:w-5 h-4 lg:h-5 text-amber-700"
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
            </div>
            <div>
              <h3 className="text-xs lg:text-sm font-bold text-amber-900">
                Multiple Active Runs Detected
              </h3>
              <p className="mt-1 text-[10px] lg:text-xs text-amber-800">
                Select the correct running day to view its live position and
                telemetry.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {train.liveRuns.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(train.TrainId, run.id)}
                className={`rounded-xl border-2 px-3 py-2 text-left text-[10px] transition-all duration-200 lg:px-4 lg:py-2.5 lg:text-xs ${
                  run.id === train.selectedRunId
                    ? "border-[#2c7f68] bg-gradient-to-br from-[#e7f6ef] to-white text-[#2c7f68] ring-2 ring-[#b9e0d0] shadow-[0_18px_30px_-22px_rgba(44,127,104,0.35)] scale-105"
                    : "border-[color:var(--stroke)] bg-[#fffaf3] text-[color:var(--ink-muted)] hover:border-[#2c7f68]/60 hover:bg-white hover:shadow-[0_16px_28px_-24px_rgba(95,75,60,0.3)]"
                }`}
              >
                <div className="text-xs font-bold text-[color:var(--ink-strong)] lg:text-sm">
                  {run.dayNumber != null
                    ? `Day ${run.dayNumber}`
                    : "Unknown Day"}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[color:var(--ink-muted)]/80">
                  <svg
                    className="w-2.5 lg:w-3 h-2.5 lg:h-3"
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
                  {formatRelativeTime(run.lastUpdated)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Info Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
        <InfoCard
          title="Upcoming Stop"
          subtitle="Next scheduled station"
          accent="sky"
          icon={
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        >
          {train.upcomingStop ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[color:var(--ink-strong)] lg:text-xl">
                    {train.upcomingStop.StationName}
                  </h4>
                  <p className="text-xs text-[color:var(--ink-muted)]/80">
                    Stop #{train.upcomingStop.OrderNumber ?? "?"}
                  </p>
                </div>
                {upcomingArrivalEstimate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ETA {upcomingArrivalEstimate.durationLabel}
                  </span>
                )}
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl bg-[#fffaf3]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-[#c9dfed]">
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                      {upcomingArrivalEstimate
                        ? "Live expected arrival"
                        : "Scheduled arrival"}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-2xl font-bold text-[#3b6f8e] lg:text-3xl">
                        {upcomingArrivalEstimate
                          ? upcomingArrivalEstimate.timeString
                          : formatTime(train.upcomingStop.ArrivalTime)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                          upcomingArrivalEstimate
                            ? "bg-[#e4f1f9] text-[#3b6f8e] ring-1 ring-[#c9dfed]"
                            : "bg-[#f4e6d6] text-[color:var(--ink-muted)] ring-1 ring-[#e4d7c5]"
                        }`}
                      >
                        {upcomingArrivalEstimate
                          ? `In ${upcomingArrivalEstimate.durationLabel}`
                          : "Awaiting telemetry"}
                      </span>
                    </div>
                  </div>
                  {upcomingDistanceKm != null && (
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-[#3b6f8e]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f1f9] px-2.5 py-1 ring-1 ring-[#c9dfed]">
                        <span>Distance</span>
                        <span className="text-[#2c7f68]">
                          {formatDistance(upcomingDistanceKm)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f1f9] px-2.5 py-1 ring-1 ring-[#c9dfed]">
                        <span>Current speed</span>
                        <span className="text-[#2c7f68]">
                          {formatSpeed(live?.speed)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#fffaf3]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-inset ring-[#c9dfed]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                      Scheduled arrival
                    </p>
                    <p className="text-lg font-semibold text-[color:var(--ink-strong)]">
                      {formatTime(train.upcomingStop.ArrivalTime)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#fffaf3]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-inset ring-[#c9dfed]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                      Scheduled departure
                    </p>
                    <p className="text-lg font-semibold text-[color:var(--ink-strong)]">
                      {formatTime(train.upcomingStop.DepartureTime)}
                    </p>
                    {train.upcomingStop.DepartureTime &&
                      train.upcomingStop.ArrivalTime && (
                        <p className="text-[11px] text-[color:var(--ink-muted)]/70">
                          Dwell ~
                          {formatDuration(
                            calculateDwell(
                              train.upcomingStop.ArrivalTime,
                              train.upcomingStop.DepartureTime
                            )
                          )}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#fff2df] p-4 text-sm text-[color:var(--ink-muted)] shadow-inner">
              No upcoming station is scheduled. The service may be approaching
              its terminus or awaiting timetable data.
            </div>
          )}
        </InfoCard>

        <InfoCard
          title="Live Telemetry"
          subtitle={live ? "Realtime sensors" : "Awaiting signal"}
          accent="emerald"
          icon={
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
          }
        >
          {live ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-[#fffaf3]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-[#b9e0d0]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                    Current speed
                  </p>
                  <p className="text-lg font-semibold text-emerald-700">
                    {formatSpeed(live.speed)}
                  </p>
                  <p className="text-[11px] text-[color:var(--ink-muted)]/70">
                    Live velocity
                  </p>
                </div>
                <div className="rounded-xl bg-[#fffaf3]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-[#b9e0d0]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                    Schedule status
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      (live.lateBy ?? 0) > 0
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatLateBy(live.lateBy)}
                  </p>
                  <p className="text-[11px] text-[color:var(--ink-muted)]/70">
                    Variance from timetable
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-800 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Last telemetry update</span>
                  <span className="font-semibold">
                    {formatRelativeTime(live.lastUpdated)}
                  </span>
                </div>
                {live.trainNumber != null && (
                  <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2">
                    <span className="font-medium">Telemetry train #</span>
                    <span className="font-semibold">{live.trainNumber}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-[#fff2df] p-4 text-sm text-[color:var(--ink-muted)] shadow-inner">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#d8c8b4]" />
              Waiting for the next live position update from the field units.
            </div>
          )}
        </InfoCard>
      </section>

      {/* Route Schedule Timeline */}
      <section>
        <div className="flex items-center justify-between mb-3 lg:mb-4 px-1">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink-strong)] lg:gap-2 lg:text-sm">
            <svg
              className="h-4 w-4 text-[color:var(--ink-muted)] lg:h-5 lg:w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <span className="hidden sm:inline">Route Schedule</span>
            <span className="sm:hidden">Route</span>
          </h3>
          <span className="text-[10px] font-medium text-[color:var(--ink-muted)] lg:text-xs">
            {train.route.length} stops
          </span>
        </div>
        <div className="relative rounded-xl border border-[color:var(--stroke)] bg-[#fffaf3] p-3 shadow-[0_20px_45px_-34px_rgba(95,75,60,0.45)] lg:p-4">
          {/* Fade overlays - hidden on small screens */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 hidden w-8 rounded-l-xl bg-gradient-to-r from-[#fff9f1] to-transparent lg:w-12" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 hidden w-8 rounded-r-xl bg-gradient-to-l from-[#fff9f1] to-transparent lg:w-12" />

          <div
            className="mx-auto w-full max-w-screen-md overflow-x-auto py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#d8c8b4] lg:py-4"
            ref={scrollContainerRef}
          >
            <div className="flex gap-2 lg:gap-3 min-w-max px-2 lg:px-6">
              {train.route.map((stop, index) => {
                const state = getStopState(train, stop, index);
                const stopKey = `${train.TrainId}-${stop.StationId}-${stop.OrderNumber}`;
                const isPassed = state === "passed";
                const isCurrent = state === "current";

                // Calculate distance and expected arrival for upcoming stops
                let distanceKm: number | null = null;
                let expectedArrival: ReturnType<
                  typeof calculateExpectedArrival
                > = null;

                if (
                  train.livePosition &&
                  !isPassed &&
                  stop.Latitude &&
                  stop.Longitude
                ) {
                  distanceKm = calculateDistance(
                    train.livePosition.lat,
                    train.livePosition.lon,
                    stop.Latitude,
                    stop.Longitude
                  );

                  expectedArrival = calculateExpectedArrival(
                    distanceKm,
                    train.livePosition.speed
                  );
                }

                return (
                  <div key={stopKey} className="flex flex-col items-center">
                    {/* Station card */}
                    <div
                      ref={(el) => {
                        if (el) stopRefs.current.set(stopKey, el);
                        else stopRefs.current.delete(stopKey);
                      }}
                      className={`shrink-0 w-44 sm:w-52 lg:w-56 border-2 rounded-xl p-3 lg:p-4 transition-all duration-300 ${
                        stopStyles[state]
                      } ${state === "current" ? "transform scale-105" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div
                          className={`font-bold text-xs lg:text-sm truncate flex-1 ${
                            isPassed ? "text-neutral-900" : ""
                          }`}
                        >
                          {stop.StationName}
                        </div>
                        {state === "current" && (
                          <div className="shrink-0 w-1.5 lg:w-2 h-1.5 lg:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        )}
                        {isPassed && (
                          <svg
                            className="h-3.5 w-3.5 shrink-0 text-neutral-900 lg:h-4 lg:w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div
                        className={`mt-2 flex justify-between border-t pt-2 text-[10px] lg:text-xs ${
                          isPassed
                            ? "border-[#e4d7c5]"
                            : "border-current border-opacity-20"
                        }`}
                      >
                        <div className={`${isPassed ? "text-neutral-900" : ""}`}>
                          <div className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75 mb-0.5">
                            Arr
                          </div>
                          <div className="font-semibold">
                            {formatTime(stop.ArrivalTime)}
                          </div>
                        </div>
                        <div className={`text-right ${isPassed ? "text-neutral-900" : ""}`}>
                          <div className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75 mb-0.5">
                            Dep
                          </div>
                          <div className="font-semibold">
                            {formatTime(stop.DepartureTime)}
                          </div>
                        </div>
                      </div>

                      {/* Expected arrival info for upcoming stops */}
                      {!isPassed &&
                        distanceKm !== null &&
                        train.livePosition && (
                          <div
                            className={`mt-2 pt-2 border-t space-y-1 text-[10px] lg:text-xs ${
                              isCurrent
                                ? "border-emerald-300"
                                : "border-current border-opacity-20"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75">
                                Distance
                              </span>
                              <span className="font-semibold text-emerald-600">
                                {formatDistance(distanceKm)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75">
                                Speed
                              </span>
                              <span className="font-semibold">
                                {formatSpeed(train.livePosition.speed)}
                              </span>
                            </div>
                            {expectedArrival && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75">
                                    Est. Arr
                                  </span>
                                  <span className="font-semibold text-emerald-600">
                                    {expectedArrival.timeString}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] lg:text-[10px] uppercase tracking-wide opacity-75">
                                    In About
                                  </span>
                                  <span className="font-semibold text-emerald-600">
                                    {expectedArrival.durationLabel}
                                  </span>
                                </div>
                              </>
                            )}
                            {!expectedArrival &&
                              train.livePosition.speed &&
                              train.livePosition.speed < 5 && (
                                <div className="text-[9px] text-amber-600 italic text-center">
                                  Too slow for estimate
                                </div>
                              )}
                          </div>
                        )}
                    </div>
                    {/* Timeline connector */}
                    {index < train.route.length - 1 && (
                      <div className="mt-2 lg:mt-3 h-6 lg:h-8 w-full relative flex items-center">
                        <div
                          className={`h-0.5 w-full rounded-full transition-colors lg:h-1 ${
                            isPassed ? "bg-emerald-400" : "bg-[#d8c8b4]"
                          }`}
                        />
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 transition-all lg:h-4 lg:w-4 lg:border-[3px] ${
                            isPassed
                              ? "h-3 w-3 bg-emerald-400 border-white shadow-sm"
                              : state === "current"
                              ? "h-3 w-3 bg-emerald-500 border-white animate-pulse shadow-md"
                              : "h-3 w-3 bg-[#fffaf3] border-[#e4d7c5]"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
