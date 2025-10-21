import { useState, useMemo } from 'react';
import { StationDetails, TrainWithRoute } from '@/types';
import { isPassengerTrain } from '@/lib/train';

// Helper function to format time strings
const formatTime = (timeString: string | null): string => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
  const formattedMinute = minute < 10 ? `0${minute}` : minute;

  return `${formattedHour}:${formattedMinute} ${ampm}`;
};

interface StationScheduleProps {
  trains: TrainWithRoute[];
  stationLookup: Map<number, StationDetails>;
}

interface TrainScheduleEntry {
  train: TrainWithRoute;
  arrivalTime: string | null;
  departureTime: string | null;
  orderNumber: number;
  isLive: boolean;
}

export const StationSchedule = ({ trains, stationLookup }: StationScheduleProps) => {
  const passengerTrains = useMemo(
    () => trains.filter((train) => isPassengerTrain(train)),
    [trains]
  );
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'arrival' | 'departure'>('arrival');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrains = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return passengerTrains.filter((train) => {
      if (!query) {
        return true;
      }

      const matchesTrain =
        train.TrainName.toLowerCase().includes(query) ||
        String(train.TrainNumber).includes(query) ||
        train.TrainDescription?.toLowerCase().includes(query);

      if (matchesTrain) {
        return true;
      }

      return train.route.some((stop) => stop.StationName.toLowerCase().includes(query));
    });
  }, [passengerTrains, searchQuery]);

  // Get all stations
  const stationsWithTrains = useMemo(() => {
    const stationMap = new Map<number, { station: StationDetails; trainCount: number }>();
    
    filteredTrains.forEach(train => {
      train.route.forEach(stop => {
        const station = stationLookup.get(stop.StationId);
        if (station) {
          const existing = stationMap.get(stop.StationId);
          stationMap.set(stop.StationId, {
            station,
            trainCount: existing ? existing.trainCount + 1 : 1
          });
        }
      });
    });

    return Array.from(stationMap.values())
      .sort((a, b) => a.station.StationName.localeCompare(b.station.StationName));
  }, [filteredTrains, stationLookup]);

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stationsWithTrains;
    
    const query = searchQuery.toLowerCase();
    return stationsWithTrains.filter(({ station }) =>
      station.StationName.toLowerCase().includes(query) ||
      station.City?.toLowerCase().includes(query)
    );
  }, [stationsWithTrains, searchQuery]);

  // Get schedule for selected station
  const stationSchedule = useMemo(() => {
    if (!selectedStationId) return [];

    const schedule: TrainScheduleEntry[] = [];

    // If a train is selected, only show that train
    filteredTrains.forEach(train => {
      const stop = train.route.find(s => s.StationId === selectedStationId);
      if (stop) {
        schedule.push({
          train,
          arrivalTime: stop.ArrivalTime,
          departureTime: stop.DepartureTime,
          orderNumber: stop.OrderNumber ?? 0,
          isLive: !!train.livePosition
        });
      }
    });

    // Sort by selected time
    schedule.sort((a, b) => {
      const timeA = sortBy === 'arrival' ? a.arrivalTime : a.departureTime;
      const timeB = sortBy === 'arrival' ? b.arrivalTime : b.departureTime;
      
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      
      return timeA.localeCompare(timeB);
    });

    return schedule;
  }, [selectedStationId, filteredTrains, sortBy]);

  const selectedStation = selectedStationId ? stationLookup.get(selectedStationId) : null;

  // Group schedule by time periods
  const groupedSchedule = useMemo(() => {
    const groups = {
      morning: [] as TrainScheduleEntry[],
      afternoon: [] as TrainScheduleEntry[],
      evening: [] as TrainScheduleEntry[],
      night: [] as TrainScheduleEntry[]
    };

    stationSchedule.forEach(entry => {
      const time = sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime;
      if (!time) return;

      const hour = parseInt(time.split(':')[0], 10);
      
      if (hour >= 5 && hour < 12) {
        groups.morning.push(entry);
      } else if (hour >= 12 && hour < 17) {
        groups.afternoon.push(entry);
      } else if (hour >= 17 && hour < 21) {
        groups.evening.push(entry);
      } else {
        groups.night.push(entry);
      }
    });

    return groups;
  }, [stationSchedule, sortBy]);

  const handleClearSelection = () => {
    setSelectedStationId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Station Selector */}
      {!selectedStation && (
        <section className="rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-5 shadow-[0_24px_45px_-36px_rgba(95,75,60,0.5)] lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[color:var(--ink-strong)] lg:text-xl">Select Station</h2>
            <span className="text-xs font-semibold text-[color:var(--ink-muted)]">
              {filteredStations.length} {filteredStations.length === 1 ? 'station' : 'stations'}
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
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/60 p-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[#f4e6d6] hover:text-[color:var(--ink-strong)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Station Grid */}
          {filteredStations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStations.map(({ station, trainCount }) => (
                <button
                  key={station.StationDetailsId}
                  onClick={() => setSelectedStationId(station.StationDetailsId)}
                  className={`group rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    selectedStationId === station.StationDetailsId
                      ? 'border-[#2c7f68] bg-gradient-to-br from-[#e7f6ef] to-white ring-2 ring-[#b9e0d0] shadow-[0_20px_36px_-24px_rgba(44,127,104,0.35)] scale-[1.02]'
                      : 'border-[color:var(--stroke)] bg-[#fffaf3] hover:border-[#2c7f68]/60 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)] hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className={`font-bold transition-colors ${
                        selectedStationId === station.StationDetailsId ? 'text-[#2c7f68]' : 'text-[color:var(--ink-strong)] group-hover:text-[#2c7f68]'
                      }`}>
                        {station.StationName}
                      </h3>
                      {station.City && (
                        <p className="mt-1 text-xs text-neutral-700">{station.City}</p>
                      )}
                    </div>
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      selectedStationId === station.StationDetailsId
                        ? 'bg-[#e7f6ef] text-[#2c7f68]'
                        : 'bg-[#f4e6d6] text-[color:var(--ink-muted)] group-hover:bg-[#e7f6ef] group-hover:text-[#2c7f68]'
                    }`}>
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
              <p className="text-sm font-medium text-[color:var(--ink-strong)]">No stations found</p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]/80">Try adjusting your filters</p>
            </div>
          )}
        </section>
      )}

      {/* Station Schedule */}
      {selectedStation && (
        <section className="rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-5 shadow-[0_26px_48px_-36px_rgba(95,75,60,0.5)] lg:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[color:var(--ink-strong)] lg:text-xl">
                {selectedStation.StationName} Schedule
              </h2>
              {selectedStation.City && (
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]/80">{selectedStation.City}</p>
              )}
            </div>
            
            {/* Arrival/Departure Toggle */}
            <div className="inline-flex rounded-full border border-[color:var(--stroke)] bg-white/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <button
                onClick={() => setSortBy('arrival')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  sortBy === 'arrival'
                    ? 'bg-[#2c7f68] text-white shadow-[0_14px_24px_-18px_rgba(44,127,104,0.55)]'
                    : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink-strong)]'
                }`}
              >
                Arrivals
              </button>
              <button
                onClick={() => setSortBy('departure')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  sortBy === 'departure'
                    ? 'bg-[#2c7f68] text-white shadow-[0_14px_24px_-18px_rgba(44,127,104,0.55)]'
                    : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink-strong)]'
                }`}
              >
                Departures
              </button>
            </div>
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-muted)] transition-colors hover:border-[#2c7f68]/60 hover:text-[color:var(--ink-strong)]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change station
            </button>
          </div>

          <div className="space-y-6">
            {/* Morning */}
            {groupedSchedule.morning.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                  <span className="emoji-badge h-8 w-8 text-base" data-tone="sky">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </span>
                  Morning (5:00 AM - 12:00 PM)
                </h3>
                <div className="space-y-2">
                  {groupedSchedule.morning.map((entry, idx) => (
                    <div
                      key={`${entry.train.TrainId}-${idx}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] p-4 transition-all hover:border-[#2c7f68]/50 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)]"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e4f1f9] to-white text-base font-bold text-[#3b6f8e] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors group-hover:from-[#d7e7f2] group-hover:to-white">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime).split(' ')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">{entry.train.TrainName}</h4>
                            {entry.isLive && (
                              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                            Train #{entry.train.TrainNumber} • {entry.train.IsUp ? '↑ Northbound' : '↓ Southbound'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[color:var(--ink-strong)]">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime)}
                        </div>
                        <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                          {sortBy === 'arrival' ? 'Arrival' : 'Departure'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Afternoon */}
            {groupedSchedule.afternoon.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                  <span className="emoji-badge h-8 w-8 text-base" data-tone="amber">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </span>
                  Afternoon (12:00 PM - 5:00 PM)
                </h3>
                <div className="space-y-2">
                  {groupedSchedule.afternoon.map((entry, idx) => (
                    <div
                      key={`${entry.train.TrainId}-${idx}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] p-4 transition-all hover:border-[#c27a2f]/50 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)]"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#fbead3] to-white text-base font-bold text-[#b26b1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors group-hover:from-[#f6dcba] group-hover:to-white">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime).split(' ')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">{entry.train.TrainName}</h4>
                            {entry.isLive && (
                              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                            Train #{entry.train.TrainNumber} • {entry.train.IsUp ? '↑ Northbound' : '↓ Southbound'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[color:var(--ink-strong)]">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime)}
                        </div>
                        <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                          {sortBy === 'arrival' ? 'Arrival' : 'Departure'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evening */}
            {groupedSchedule.evening.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                  <span className="emoji-badge h-8 w-8 text-base" data-tone="amber">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </span>
                  Evening (5:00 PM - 9:00 PM)
                </h3>
                <div className="space-y-2">
                  {groupedSchedule.evening.map((entry, idx) => (
                    <div
                      key={`${entry.train.TrainId}-${idx}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] p-4 transition-all hover:border-[#c27a2f]/50 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)]"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f8e6d3] to-white text-base font-bold text-[#b26b1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors group-hover:from-[#f3d6b8] group-hover:to-white">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime).split(' ')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">{entry.train.TrainName}</h4>
                            {entry.isLive && (
                              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                            Train #{entry.train.TrainNumber} • {entry.train.IsUp ? '↑ Northbound' : '↓ Southbound'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[color:var(--ink-strong)]">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime)}
                        </div>
                        <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                          {sortBy === 'arrival' ? 'Arrival' : 'Departure'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Night */}
            {groupedSchedule.night.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                  <span className="emoji-badge h-8 w-8 text-base" data-tone="slate">🌙</span>
                  Night (9:00 PM - 5:00 AM)
                </h3>
                <div className="space-y-2">
                  {groupedSchedule.night.map((entry, idx) => (
                    <div
                      key={`${entry.train.TrainId}-${idx}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--stroke)] bg-[#fffaf3] p-4 transition-all hover:border-[#5f4b3c]/40 hover:shadow-[0_18px_30px_-28px_rgba(95,75,60,0.35)]"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6e4df] to-white text-base font-bold text-[color:var(--ink-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors group-hover:from-[#dcd9d3] group-hover:to-white">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime).split(' ')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[color:var(--ink-strong)]">{entry.train.TrainName}</h4>
                            {entry.isLive && (
                              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#2c7f68]" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                            Train #{entry.train.TrainNumber} • {entry.train.IsUp ? '↑ Northbound' : '↓ Southbound'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[color:var(--ink-strong)]">
                          {formatTime(sortBy === 'arrival' ? entry.arrivalTime : entry.departureTime)}
                        </div>
                        <div className="text-xs font-semibold text-[color:var(--ink-muted)]">
                          {sortBy === 'arrival' ? 'Arrival' : 'Departure'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stationSchedule.length === 0 && (
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-[color:var(--ink-strong)]">No trains scheduled</p>
                    <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                  This station has no scheduled trains at the moment
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {!selectedStation && (
        <div className="rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[#fff9f1] via-[#fff4e4] to-[#fffdf8] p-12 text-center shadow-[0_26px_48px_-38px_rgba(95,75,60,0.5)]">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-bold text-[color:var(--ink-strong)]">Select a Station</h3>
          <p className="mt-2 text-sm text-[color:var(--ink-muted)]/80">
            Choose a station above to view complete train schedules
          </p>
        </div>
      )}
    </div>
  );
};

