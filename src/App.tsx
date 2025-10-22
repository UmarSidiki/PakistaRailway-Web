import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { FiltersBar } from "@/components/FiltersBar";
import { TrainList } from "@/components/TrainList";
import { TrainDetails } from "@/components/TrainDetails";
import { MapView } from "@/components/MapView";
import { StationUpdates } from "@/components/StationUpdates";
import { StationSchedule } from "@/components/StationSchedule";
import {
  useDashboardData,
  useLiveSocket,
  useDatasetBootstrap,
  useStationLookup,
} from "@/hooks/useTrainData";
import type { ConnectionStatus } from "@/types";
import { Analytics } from "@vercel/analytics/react";

const App = () => {
  useDatasetBootstrap();
  useLiveSocket();
  const [activeTab, setActiveTab] = useState<
    "search" | "details" | "stationUpdates" | "stationSchedule"
  >("search");

  const {
    allTrains,
    trains,
    filters,
    setFilters,
    selectedTrain,
    selectTrain,
    selectTrainRun,
    liveCount,
    connectionStatus,
    lastSocketEvent,
    lastError,
    unresolvedCount,
  } = useDashboardData();
  const stationLookup = useStationLookup();

  const statusLabel: Record<ConnectionStatus, string> = {
    connected: "Connected",
    connecting: "Connecting…",
    reconnecting: "Reconnecting…",
    disconnected: "Disconnected",
    error: "Error",
  };

  const handleTrainSelect = (trainId: number) => {
    selectTrain(trainId);
    setActiveTab("details");
  };

  useEffect(() => {
    if (!selectedTrain && activeTab === "details") {
      setActiveTab("search");
    }
  }, [activeTab, selectedTrain]);

  return (
    // <div className="flex min-h-screen flex-col bg-[color:var(--paper)]">
    <div className="flex min-h-screen flex-col bg-[#fffcf7] max-sm:pb-14">
      <Header
        liveCount={liveCount}
        totalCount={trains.length}
        connectionStatus={connectionStatus}
        lastSocketEvent={lastSocketEvent}
        lastError={lastError}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasSelectedTrain={!!selectedTrain}
      />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-3 py-6 pb-36 sm:px-6 lg:px-8">
        {activeTab === "search" ? (
          <section className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,320px),1fr] lg:items-start">
              <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                <FiltersBar filters={filters} onChange={setFilters} />

                <aside className="hidden rounded-3xl border border-[color:var(--stroke)] bg-[#fff5e6]/80 p-6 shadow-[0_24px_45px_-35px_rgba(95,75,60,0.55)] backdrop-blur sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                    Realtime snapshot
                  </p>
                  <dl className="mt-5 space-y-4 text-sm text-[color:var(--ink-muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-3 font-medium">
                        <span
                          className="emoji-badge w-8 h-8 text-base"
                          data-tone="amber"
                          aria-hidden="true"
                        >
                          <svg
                            className="h-6 w-6"
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
                        </span>
                        <span>Total trains</span>
                      </dt>
                      <dd className="text-base font-semibold text-[color:var(--ink-strong)]">
                        {trains.length}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-3 font-medium">
                        <span
                          className="emoji-badge w-8 h-8 text-base"
                          data-tone="emerald"
                          aria-hidden="true"
                        >
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-6.938-6.49a8.5 8.5 0 0113.876 0M12 12a3 3 0 100-6 3 3 0 000 6z"
                            />
                          </svg>
                        </span>
                        <span>Live coverage</span>
                      </dt>
                      <dd className="text-base font-semibold text-[#2c7f68]">
                        {liveCount}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-3 font-medium">
                        <span
                          className="emoji-badge w-8 h-8 text-base"
                          data-tone="rose"
                          aria-hidden="true"
                        >
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                        </span>
                        <span>Needs attention</span>
                      </dt>
                      <dd className="text-base font-semibold text-[#b15b62]">
                        {unresolvedCount}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-3 font-medium">
                        <span
                          className="emoji-badge w-8 h-8 text-base"
                          data-tone="sky"
                          aria-hidden="true"
                        >
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </span>
                        <span>Connection</span>
                      </dt>
                      <dd className="text-base font-semibold text-[color:var(--ink-strong)]">
                        {statusLabel[connectionStatus]}
                      </dd>
                    </div>
                  </dl>
                </aside>
              </div>

              <TrainList
                trains={trains}
                selectedTrainId={selectedTrain?.TrainId}
                onSelect={handleTrainSelect}
              />
            </div>
          </section>
        ) : activeTab === "details" ? (
          <section className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(480px,1.2fr),minmax(360px,1fr)]">
            <MapView
              trains={trains}
              selectedTrain={selectedTrain}
              stationLookup={stationLookup}
            />
            <TrainDetails
              train={selectedTrain}
              stationLookup={stationLookup}
              onSelectRun={selectTrainRun}
            />
          </section>
        ) : activeTab === "stationUpdates" ? (
          <StationUpdates trains={allTrains} stationLookup={stationLookup} />
        ) : activeTab === "stationSchedule" ? (
          <StationSchedule trains={allTrains} stationLookup={stationLookup} />
        ) : null}
      </main>
      <Analytics />
    </div>
  );
};

export default App;