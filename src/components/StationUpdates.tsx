import { useState, useMemo } from "react";
import { StationDetails, TrainWithRoute, TrainStop } from "@/types";
import {
  formatTime,
  formatRelativeTime,
  formatSpeed,
  formatLateBy,
} from "@/utils/time";
import { isPassengerTrain } from "@/lib/train";
import { StatusChip } from "./StatusChip";

interface StationUpdatesProps {
  trains: TrainWithRoute[];
  stationLookup: Map<number, StationDetails>;
}

const MINUTES_PER_DAY = 24 * 60;

const getExpectedArrivalDetails = (
  scheduledTime: string | null | undefined,
  lateByMinutes: number | null | undefined
) => {
  if (!scheduledTime) {
    return null;
  }

  const [hourPart, minutePart = "0"] = scheduledTime.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart.slice(0, 2), 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return {
      display: formatTime(scheduledTime),
      scheduledLabel: formatTime(scheduledTime),
      disruptionLabel: formatLateBy(lateByMinutes),
      hasLiveAdjustment: false,
    } as const;
  }

  const baseMinutes = hours * 60 + minutes;
  const offset =
    lateByMinutes != null && !Number.isNaN(lateByMinutes)
      ? Math.round(lateByMinutes)
      : 0;

  let adjustedMinutes = baseMinutes + offset;
  adjustedMinutes =
    ((adjustedMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const adjustedHours = Math.floor(adjustedMinutes / 60);
  const adjustedMinute = adjustedMinutes % 60;

  const adjustedTime = `${adjustedHours
    .toString()
    .padStart(2, "0")}:${adjustedMinute.toString().padStart(2, "0")}`;

  const baseTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;

  return {
    display: formatTime(adjustedTime),
    scheduledLabel: formatTime(baseTime),
    disruptionLabel: formatLateBy(lateByMinutes),
    hasLiveAdjustment: offset !== 0,
  } as const;
};

export const __stationUpdatesInternals = {
  getExpectedArrivalDetails,
};

// Helper function to parse time string to minutes
const parseTimeToMinutes = (
  timeStr: string | null | undefined
): number | null => {
  if (!timeStr) return null;
  const [hourPart, minutePart = "0"] = timeStr.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart.slice(0, 2), 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

// Helper function to get route description (origin -> destination)
const getRouteDescription = (route: TrainWithRoute["route"]): string => {
  if (route.length === 0) return "Unknown route";
  const origin = route[0]?.StationName || "Unknown";
  const destination = route[route.length - 1]?.StationName || "Unknown";
  return `${origin} → ${destination}`;
};

// Helper function to calculate time until arrival in minutes
const getMinutesUntilArrival = (
  arrivalTime: string | null | undefined,
  lateBy: number | null | undefined
): number | null => {
  if (!arrivalTime) return null;

  const arrivalMinutes = parseTimeToMinutes(arrivalTime);
  if (arrivalMinutes === null) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const delay =
    lateBy != null && !Number.isNaN(lateBy) ? Math.round(lateBy) : 0;

  let adjustedArrival = arrivalMinutes + delay;
  let minutesUntil = adjustedArrival - currentMinutes;

  // Handle day wrapping
  if (minutesUntil < -720) {
    // If more than 12 hours in the past, assume it's tomorrow
    minutesUntil += MINUTES_PER_DAY;
  } else if (minutesUntil > 720) {
    // If more than 12 hours in the future, assume it was yesterday
    minutesUntil -= MINUTES_PER_DAY;
  }

  return minutesUntil;
};

// Format minutes until arrival as readable text
const formatTimeUntil = (minutes: number | null): string => {
  if (minutes === null) return "";
  if (minutes < 0) return "Arrived";
  if (minutes === 0) return "Arriving now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
};

export const StationUpdates = ({
  trains,
  stationLookup,
}: StationUpdatesProps) => {
  const passengerTrains = useMemo(
    () => trains.filter((train) => isPassengerTrain(train)),
    [trains]
  );
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyLive, setShowOnlyLive] = useState(false);

  // Get all stations that have trains passing through them
  const stationsWithTrains = useMemo(() => {
    const stationMap = new Map<
      number,
      { station: StationDetails; trainCount: number; liveCount: number }
    >();

    passengerTrains.forEach((train) => {
      train.route.forEach((stop) => {
        const station = stationLookup.get(stop.StationId);
        if (station) {
          const existing = stationMap.get(stop.StationId);
          const isLive = !!train.livePosition;
          stationMap.set(stop.StationId, {
            station,
            trainCount: existing ? existing.trainCount + 1 : 1,
            liveCount: existing
              ? existing.liveCount + (isLive ? 1 : 0)
              : isLive
              ? 1
              : 0,
          });
        }
      });
    });

    return Array.from(stationMap.values()).sort((a, b) => {
      // Sort by live trains first, then by name
      if (a.liveCount !== b.liveCount) {
        return b.liveCount - a.liveCount;
      }
      return a.station.StationName.localeCompare(b.station.StationName);
    });
  }, [passengerTrains, stationLookup]);

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stationsWithTrains;

    const query = searchQuery.toLowerCase();
    return stationsWithTrains.filter(
      ({ station }) =>
        station.StationName.toLowerCase().includes(query) ||
        station.City?.toLowerCase().includes(query)
    );
  }, [stationsWithTrains, searchQuery]);

  // Get trains for selected station with improved categorization
  const stationTrains = useMemo(() => {
    if (!selectedStationId)
      return { passed: [], upcoming: [], arrivingNow: [] };

    const passed: Array<TrainWithRoute & { stop: TrainStop }> = [];
    const upcoming: Array<
      TrainWithRoute & { stop: TrainStop; minutesUntil: number | null }
    > = [];
    const arrivingNow: Array<
      TrainWithRoute & { stop: TrainStop; minutesUntil: number | null }
    > = [];

    const trainsToShow = showOnlyLive
      ? passengerTrains.filter((t) => t.livePosition)
      : passengerTrains;

    trainsToShow.forEach((train) => {
      // Find the stop at the selected station
      const stopIndex = train.route.findIndex(
        (stop) => stop.StationId === selectedStationId
      );
      if (stopIndex === -1) return; // Train doesn't stop at this station

      const stop = train.route[stopIndex];
      const minutesUntil = getMinutesUntilArrival(
        stop.ArrivalTime,
        train.livePosition?.lateBy
      );

      // Determine if train has passed this station
      let hasPassed = false;

      if (train.livePosition) {
        // Check if this station was the previous stop
        if (train.livePosition.prevStationId === selectedStationId) {
          hasPassed = true;
        }
        // Check based on route position if we have live position data
        else {
          const currentStopIndex = train.route.findIndex(
            (s) => s.StationId === train.livePosition?.nextStationId
          );
          if (currentStopIndex !== -1 && stopIndex < currentStopIndex) {
            hasPassed = true;
          }
        }
      } else {
        // For trains without live position, check if arrival time has passed
        if (minutesUntil !== null && minutesUntil < -30) {
          // Consider passed if more than 30 minutes past scheduled arrival
          hasPassed = true;
        }
      }

      // Categorize the train
      if (hasPassed) {
        passed.push({ ...train, stop });
      } else if (minutesUntil !== null && minutesUntil <= 60) {
        // Arriving within 1 hour - add to "Arriving Now"
        arrivingNow.push({ ...train, stop, minutesUntil });
      } else {
        // More than 1 hour away - add to "Upcoming Arrivals"
        upcoming.push({ ...train, stop, minutesUntil });
      }
    });

    // Sort arriving now by soonest first
    arrivingNow.sort((a, b) => {
      const timeA = a.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

    // Sort upcoming by arrival time (soonest first)
    upcoming.sort((a, b) => {
      const timeA = a.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

    // Sort passed by most recent first (latest departure time)
    passed.sort((a, b) => {
      const timeA = parseTimeToMinutes(a.stop.DepartureTime) ?? 0;
      const timeB = parseTimeToMinutes(b.stop.DepartureTime) ?? 0;
      return timeB - timeA;
    });

    return { passed, upcoming, arrivingNow };
  }, [selectedStationId, passengerTrains, showOnlyLive]);

  const selectedStation = selectedStationId
    ? stationLookup.get(selectedStationId)
    : null;

  const handleClearSelection = () => {
    setSelectedStationId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Station Selector */}
      {!selectedStation && (
        <section className="rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-5 shadow-[0_24px_45px_-36px_rgba(95,75,60,0.5)] lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[color:var(--ink-strong)] lg:text-xl">
              Select Station
            </h2>
            <span className="text-xs font-semibold text-[color:var(--ink-muted)]">
              {filteredStations.length}{" "}
              {filteredStations.length === 1 ? "station" : "stations"}
            </span>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search stations by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] px-4 py-3 pl-11 text-sm text-[color:var(--ink-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all placeholder:text-[color:var(--ink-muted)]/70 focus:border-[#2c7f68] focus:outline-none focus:ring-4 focus:ring-[#cde5db]"
              />
              <svg
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2c7f68]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/60 p-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[#f4e6d6] hover:text-[color:var(--ink-strong)]"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Station Grid */}
          {filteredStations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStations.map(({ station, trainCount, liveCount }) => (
                <button
                  key={station.StationDetailsId}
                  onClick={() => setSelectedStationId(station.StationDetailsId)}
                  className={`group rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    selectedStationId === station.StationDetailsId
                      ? "border-[#2c7f68] bg-gradient-to-br from-[#e7f6ef] to-white ring-2 ring-[#b9e0d0] shadow-[0_20px_36px_-24px_rgba(44,127,104,0.35)] scale-[1.02]"
                      : "border-[color:var(--stroke)] bg-[#fffaf3] hover:border-[#2c7f68]/60 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)] hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3
                        className={`font-bold transition-colors ${
                          selectedStationId === station.StationDetailsId
                            ? "text-[#2c7f68]"
                            : "text-[color:var(--ink-strong)] group-hover:text-[#2c7f68]"
                        }`}
                      >
                        {station.StationName}
                      </h3>
                      {station.City && (
                        <p className="mt-1 text-xs text-neutral-700">
                          {station.City}
                        </p>
                      )}
                      {liveCount > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs">
                          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#2c7f68]" />
                          <span className="font-semibold text-[#2c7f68]">
                            {liveCount} live
                          </span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        selectedStationId === station.StationDetailsId
                          ? "bg-[#e7f6ef] text-[#2c7f68]"
                          : "bg-[#f4e6d6] text-[color:var(--ink-muted)] group-hover:bg-[#e7f6ef] group-hover:text-[#2c7f68]"
                      }`}
                    >
                      {trainCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#fff2df] p-8 text-center shadow-inner">
              <svg
                className="mx-auto mb-3 h-12 w-12 text-[#e6cdae]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm font-medium text-[color:var(--ink-strong)]">
                No stations found
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]/80">
                Try a different search term
              </p>
            </div>
          )}
        </section>
      )}

      {/* Station Train Updates */}
      {selectedStation && (
        <section className="rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-5 shadow-[0_26px_48px_-36px_rgba(95,75,60,0.5)] lg:p-6">
          <div className="mb-6 flex flex-col flex-wrap items-start justify-between gap-4 md:flex-row">
            {/* Station Name and City */}
            <div>
              <h2 className="text-xl font-bold text-[color:var(--ink-strong)] lg:text-2xl">
                {selectedStation.StationName}
              </h2>
              {selectedStation.City && (
                <p className="mt-1 text-sm text-neutral-700">
                  {selectedStation.City}
                </p>
              )}
            </div>

            {/* Badges and Buttons Container */}
            <div className="grid w-full grid-cols-2 gap-2 text-xs md:inline-flex md:w-auto md:flex-wrap md:items-center">
              {/* Arriving Now Badge */}
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#e7f6ef] px-3 py-1.5 font-semibold text-[#2c7f68] ring-1 ring-[#b9e0d0] shadow-sm">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                {stationTrains.arrivingNow.length} Arriving Now
              </span>

              {/* Upcoming Badge */}
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#e4f1f9] px-3 py-1.5 font-semibold text-[#3b6f8e] ring-1 ring-[#c9dfed] shadow-sm">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                {stationTrains.upcoming.length} Upcoming
              </span>

              {/* Passed Badge */}
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f4e6d6] px-3 py-1.5 font-semibold text-[color:var(--ink-muted)] ring-1 ring-[#e4d7c5] shadow-sm">
                <svg
                  className="h-3 w-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {stationTrains.passed.length} Passed
              </span>

              {/* Live/All Toggle Button */}
              <button
                type="button"
                onClick={() => setShowOnlyLive(!showOnlyLive)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                  showOnlyLive
                    ? "bg-[#2c7f68] text-white ring-1 ring-[#2c7f68]"
                    : "bg-white text-[color:var(--ink-muted)] ring-1 ring-[color:var(--stroke)] hover:ring-[#2c7f68]/60"
                }`}
              >
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    showOnlyLive ? "animate-pulse bg-white" : "bg-[#2c7f68]"
                  }`}
                />
                {showOnlyLive ? "Live Only" : "Show All"}
              </button>

              {/* Change Station Button */}
              <button
                type="button"
                onClick={handleClearSelection}
                className="col-span-2 inline-flex items-center justify-center gap-1 rounded-full border border-[color:var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-muted)] transition-colors hover:border-[#2c7f68]/60 hover:text-[color:var(--ink-strong)] md:ml-auto"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Change station
              </button>
            </div>
          </div>

          {/* Arriving Now Trains (within 1 hour) */}
          {stationTrains.arrivingNow.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                Arriving Now (within 1 hour)
              </h3>
              <div className="space-y-3">
                {stationTrains.arrivingNow.map((train) => {
                  const expectedArrival = getExpectedArrivalDetails(
                    train.stop.ArrivalTime,
                    train.livePosition?.lateBy
                  );
                  const timeUntil = formatTimeUntil(train.minutesUntil);
                  const routeDesc = getRouteDescription(train.route);
                  return (
                    <div
                      key={train.TrainId}
                      className="rounded-2xl border-2 border-[#2c7f68] bg-gradient-to-r from-[#e7f6ef] to-white p-4 shadow-[0_20px_36px_-30px_rgba(44,127,104,0.45)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">
                              {train.TrainName}
                            </h4>
                          </div>
                          <p className="mt-1 text-xs text-[color:var(--ink-muted)]/80">
                            <span className="font-medium text-[color:var(--ink-muted)]">
                              Train #{train.TrainNumber} •{" "}
                              {train.IsUp ? "Northbound ↑" : "Southbound ↓"}
                            </span>
                          </p>
                          <p className="mt-1.5 text-xs font-medium text-[#3b6f8e]">
                            {routeDesc}
                          </p>
                        </div>
                        <div className="text-right">
                          {timeUntil && (
                            <div className="mb-1 text-sm font-bold text-[#2c7f68]">
                              {timeUntil}
                            </div>
                          )}
                          <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                            Expected Arrival
                          </div>
                          <div className="text-lg font-bold text-[color:var(--ink-strong)]">
                            {expectedArrival?.display ??
                              formatTime(train.stop.ArrivalTime)}
                          </div>
                          {expectedArrival && (
                            <div className="mt-1 text-[0.65rem] font-medium text-[color:var(--ink-muted)]">
                              Scheduled {expectedArrival.scheduledLabel}
                              {expectedArrival.hasLiveAdjustment && (
                                <>
                                  <span className="mx-1 text-[#bfa687]">•</span>
                                  {expectedArrival.disruptionLabel}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {train.livePosition && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#b9e0d0] pt-3 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-[#2c7f68] ring-1 ring-[#b9e0d0]">
                            <svg
                              className="h-3 w-3"
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
                            {formatSpeed(train.livePosition.speed)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-[color:var(--ink-strong)] ring-1 ring-[#b9e0d0]">
                            <svg
                              className="h-3 w-3"
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
                            {formatLateBy(train.livePosition.lateBy)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[color:var(--ink-muted)] ring-1 ring-[#b9e0d0]">
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            {formatRelativeTime(train.livePosition.lastUpdated)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Trains (more than 1 hour away) */}
          {stationTrains.upcoming.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                Upcoming Arrivals ({">"} 1 hour)
              </h3>
              <div className="space-y-3">
                {stationTrains.upcoming.slice(0, 15).map((train) => {
                  const expectedArrival = getExpectedArrivalDetails(
                    train.stop.ArrivalTime,
                    train.livePosition?.lateBy
                  );
                  const timeUntil = formatTimeUntil(train.minutesUntil);
                  const routeDesc = getRouteDescription(train.route);

                  return (
                    <div
                      key={train.TrainId}
                      className="rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] p-4 transition-all hover:border-[#2c7f68]/60 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">
                              {train.TrainName}
                            </h4>
                          </div>
                          <p className="mt-1 text-xs font-medium text-[color:var(--ink-muted)]">
                            Train #{train.TrainNumber} •{" "}
                            {train.IsUp ? "Northbound ↑" : "Southbound ↓"}
                          </p>
                          <p className="mt-1.5 text-xs text-[#3b6f8e]">
                            {routeDesc}
                          </p>
                        </div>
                        <div className="text-right">
                          {timeUntil && (
                            <div className="mb-1 text-xs font-bold text-[#2c7f68]">
                              {timeUntil}
                            </div>
                          )}
                          <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                            Expected Arrival
                          </div>
                          <div className="text-lg font-bold text-[#3b6f8e]">
                            {expectedArrival?.display ??
                              formatTime(train.stop.ArrivalTime)}
                          </div>
                          {expectedArrival && (
                            <div className="mt-1 text-[0.65rem] font-medium text-[color:var(--ink-muted)]">
                              Scheduled {expectedArrival.scheduledLabel}
                              {expectedArrival.hasLiveAdjustment && (
                                <>
                                  <span className="mx-1 text-[#bfa687]">•</span>
                                  {expectedArrival.disruptionLabel}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {train.livePosition && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#e4d7c5] pt-3 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-[#2c7f68] ring-1 ring-[#e4d7c5]">
                            <svg
                              className="h-3 w-3"
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
                            {formatSpeed(train.livePosition.speed)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-[color:var(--ink-strong)] ring-1 ring-[#e4d7c5]">
                            <svg
                              className="h-3 w-3"
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
                            {formatLateBy(train.livePosition.lateBy)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[color:var(--ink-muted)] ring-1 ring-[#e4d7c5]">
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            {formatRelativeTime(train.livePosition.lastUpdated)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {stationTrains.upcoming.length > 15 && (
                  <div className="rounded-2xl border border-[#e4d7c5] bg-[#f4e6d6]/50 p-3 text-center">
                    <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                      +{stationTrains.upcoming.length - 15} more trains
                      scheduled
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Passed Trains */}
          {stationTrains.passed.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                Recently Passed
              </h3>
              <div className="space-y-2">
                {stationTrains.passed.slice(0, 8).map((train) => {
                  const routeDesc = getRouteDescription(train.route);
                  return (
                    <div
                      key={train.TrainId}
                      className="rounded-2xl border border-[#e4d7c5] bg-[#f4e6d6] p-3 opacity-80"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-[color:var(--ink-muted)]">
                              {train.TrainName}
                            </h4>
                            {train.livePosition && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[0.65rem] font-semibold text-[#2c7f68]">
                                Live
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">
                            Train #{train.TrainNumber} • {routeDesc}
                          </p>
                          <p className="mt-1 text-xs font-medium text-[color:var(--ink-strong)]">
                            Departed: {formatTime(train.stop.DepartureTime)}
                          </p>
                        </div>
                        <svg
                          className="h-5 w-5 shrink-0 text-[#d2bda2]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
                {stationTrains.passed.length > 8 && (
                  <div className="rounded-2xl border border-[#e4d7c5] bg-[#f4e6d6]/50 p-2 text-center">
                    <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                      +{stationTrains.passed.length - 8} more trains passed
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {stationTrains.arrivingNow.length === 0 &&
            stationTrains.upcoming.length === 0 &&
            stationTrains.passed.length === 0 && (
              <div className="rounded-2xl bg-[#fff2df] p-8 text-center text-[color:var(--ink-muted)]">
                <svg
                  className="mx-auto mb-3 h-12 w-12 text-[#e6cdae]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="font-medium text-[color:var(--ink-strong)]">
                  No train activity at this station currently
                </p>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]/80">
                  Try selecting a different station from the list above
                </p>
              </div>
            )}
        </section>
      )}

      {!selectedStation && (
        <div className="rounded-3xl border border-[color:var(--stroke)] bg-[#fff9f1] p-12 text-center shadow-[0_26px_48px_-38px_rgba(95,75,60,0.5)]">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-[#d2bda2]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-[color:var(--ink-strong)]">
            Select a Station
          </h3>
          <p className="mt-2 text-sm text-[color:var(--ink-muted)]/80">
            Choose a station above to view real-time train arrivals and
            departures
          </p>
        </div>
      )}
    </div>
  );
};
