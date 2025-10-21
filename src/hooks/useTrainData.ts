import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { StoreApi } from "zustand";
import { shallow } from "zustand/shallow";
import type {
  ConnectionStatus,
  LiveTrainDelta,
  TrainFilters,
  TrainWithRoute,
  StationDetails,
} from "@/types";
import {
  loadTrainDataset,
  loadTrainDatasetSync,
  persistTrainSnapshot,
  stripStaleLiveData,
  STALE_LIVE_RUN_TTL_MS,
  persistLiveDeltas,
  pruneStaleDeltasFromDB,
} from "@/services/dataLoader";
import { connectLiveSocket } from "@/services/socket";
import {
  applyRunSelectionToTrain,
  findMatchingTrainId,
  updateTrainWithDelta,
} from "@/services/liveData";
import { isPassengerTrain } from "@/lib/train";

const initialTrains: TrainWithRoute[] = [];
const initialStationLookup = new Map<number, StationDetails>();

export interface TrainStoreState {
  trains: TrainWithRoute[];
  stationLookup: Map<number, StationDetails>;
  isDatasetHydrated: boolean;
  filters: TrainFilters;
  selectedTrainId?: number;
  liveDeltas: Map<string, LiveTrainDelta>;
  trainKeyToId: Map<string, number>;
  selectedRunIds: Map<number, string>;
  unresolvedDeltas: Map<string, LiveTrainDelta>;
  connectionStatus: ConnectionStatus;
  lastSocketEvent?: number;
  lastError?: string;
  setFilters: (partial: Partial<TrainFilters>) => void;
  selectTrain: (trainId: number) => void;
  applyDeltas: (deltas: LiveTrainDelta[]) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastError: (message?: string) => void;
  selectTrainRun: (trainId: number, runId: string) => void;
  setDataset: (dataset: {
    trains: TrainWithRoute[];
    stationById: Map<number, StationDetails>;
  }) => void;
  pruneStaleRuns: () => void;
}

const defaultFilters: TrainFilters = {
  search: "",
  onlyLive: false,
  onlyPassenger: true,
  direction: "all",
};

// --- Helper Functions for State Logic ---

/**
 * Processes incoming live deltas and updates the state.
 * @param currentState The current relevant slice of the store state.
 * @param deltas The new deltas to apply.
 * @returns The updated state slice.
 */
const processDeltas = (
  currentState: {
    trains: TrainWithRoute[];
    liveDeltas: Map<string, LiveTrainDelta>;
    trainKeyToId: Map<string, number>;
    selectedRunIds: Map<number, string>;
    unresolvedDeltas: Map<string, LiveTrainDelta>;
  },
  deltas: LiveTrainDelta[]
) => {
  if (deltas.length === 0) return currentState;

  let { trains, liveDeltas, trainKeyToId, selectedRunIds, unresolvedDeltas } =
    currentState;

  deltas.forEach((delta) => {
    liveDeltas.set(delta.trainKey, delta);

    const mappedTrainId =
      trainKeyToId.get(delta.id) ??
      trainKeyToId.get(delta.trainKey) ??
      trainKeyToId.get(delta.variantKey) ??
      (delta.trainNumber != null
        ? trainKeyToId.get(String(delta.trainNumber))
        : undefined);

    let targetTrainId = mappedTrainId || findMatchingTrainId(trains, delta);

    if (targetTrainId) {
      // Cache the mapping for future deltas
      trainKeyToId.set(delta.id, targetTrainId);
      trainKeyToId.set(delta.trainKey, targetTrainId);
      trainKeyToId.set(delta.variantKey, targetTrainId);
      if (delta.trainNumber != null) {
        trainKeyToId.set(String(delta.trainNumber), targetTrainId);
      }

      trains = trains.map((train) =>
        train.TrainId === targetTrainId
          ? updateTrainWithDelta(
              train,
              delta,
              selectedRunIds.get(train.TrainId)
            )
          : train
      );

      const updatedTrain = trains.find(
        (train) => train.TrainId === targetTrainId
      );
      if (updatedTrain?.selectedRunId) {
        selectedRunIds.set(targetTrainId, updatedTrain.selectedRunId);
      }
      unresolvedDeltas.delete(delta.id);
    } else {
      unresolvedDeltas.set(delta.id, delta);
    }
  });

  return { trains, liveDeltas, trainKeyToId, selectedRunIds, unresolvedDeltas };
};

/**
 * Prunes stale live data from trains and deltas.
 * @param currentState The current relevant slice of the store state.
 * @param now The current timestamp.
 * @returns The updated state slice.
 */
const pruneStaleData = (
  currentState: {
    trains: TrainWithRoute[];
    liveDeltas: Map<string, LiveTrainDelta>;
    selectedRunIds: Map<number, string>;
  },
  now: number
) => {
  let { trains, liveDeltas, selectedRunIds } = currentState;

  // Prune stale deltas
  liveDeltas.forEach((delta, key) => {
    if (now - delta.lastUpdated > STALE_LIVE_RUN_TTL_MS) {
      liveDeltas.delete(key);
    }
  });

  // Prune stale runs from trains
  const sanitizedTrains = stripStaleLiveData(trains, now);
  if (sanitizedTrains !== trains) {
    trains = sanitizedTrains;
    sanitizedTrains.forEach((train) => {
      if (!train.selectedRunId) {
        selectedRunIds.delete(train.TrainId);
      }
    });
  }

  return { trains, liveDeltas, selectedRunIds };
};

// --- Zustand Store Definition ---

const useTrainStore = create<TrainStoreState>()(
  (
    set: StoreApi<TrainStoreState>["setState"],
    get: StoreApi<TrainStoreState>["getState"]
  ) => ({
    trains: initialTrains,
    stationLookup: initialStationLookup,
    isDatasetHydrated: false,
    filters: defaultFilters,
    selectedTrainId: undefined,
    liveDeltas: new Map(),
    trainKeyToId: new Map(),
    selectedRunIds: new Map(),
    unresolvedDeltas: new Map(),
    connectionStatus: "connecting",
    lastSocketEvent: undefined,
    lastError: undefined,

    setDataset: (dataset) =>
      set({
        trains: dataset.trains,
        stationLookup: dataset.stationById,
        isDatasetHydrated: true,
      }),

    setFilters: (partial) =>
      set((state) => ({ filters: { ...state.filters, ...partial } })),

    selectTrain: (trainId) => set({ selectedTrainId: trainId }),

    applyDeltas: async (deltas: LiveTrainDelta[]) => {
      if (deltas.length === 0) return;

      // 1. Persist deltas to IndexedDB for offline support
      await persistLiveDeltas(deltas);

      // 2. Update the in-memory state
      set((state) => {
        const updatedState = processDeltas(state, deltas);
        const now = Date.now();
        const prunedState = pruneStaleData(updatedState, now);

        return {
          ...prunedState,
          lastSocketEvent: now,
          ...(state.connectionStatus !== "connected" && {
            connectionStatus: "connected",
            lastError: undefined,
          }),
        };
      });

      // 3. Persist the resulting train snapshot
      const { trains } = get();
      persistTrainSnapshot(trains).catch((err) =>
        console.error("Failed to persist train snapshot", err)
      );
    },

    pruneStaleRuns: async () => {
      // 1. Prune stale deltas from the DB
      await pruneStaleDeltasFromDB();

      // 2. Update the in-memory state
      set((state) => {
        const now = Date.now();
        const prunedState = pruneStaleData(state, now);
        return prunedState;
      });

      // 3. Persist the resulting train snapshot
      const { trains } = get();
      persistTrainSnapshot(trains).catch((err) =>
        console.error("Failed to persist pruned snapshot", err)
      );
    },

    setConnectionStatus: (status) =>
      set((state) => ({
        connectionStatus: status,
        ...(status === "connected" && { lastError: undefined }),
      })),

    setLastError: (message) => set({ lastError: message }),

    selectTrainRun: (trainId, runId) =>
      set((state) => {
        const trains = state.trains.map((train) =>
          train.TrainId === trainId
            ? applyRunSelectionToTrain(train, runId)
            : train
        );
        const targetTrain = trains.find((train) => train.TrainId === trainId);
        const selectedRunIds = new Map(state.selectedRunIds);
        if (targetTrain?.selectedRunId) {
          selectedRunIds.set(trainId, targetTrain.selectedRunId);
        }
        return { trains, selectedRunIds };
      }),
  })
);

// --- Selector Hooks (unchanged) ---

export const useTrainFilters = () =>
  useTrainStore(
    (state) => ({ filters: state.filters, setFilters: state.setFilters }),
    shallow
  );

export const useSelectedTrain = () =>
  useTrainStore(
    (state) => ({
      selectedTrain: state.trains.find(
        (train) => train.TrainId === state.selectedTrainId
      ),
      selectTrain: state.selectTrain,
      selectTrainRun: state.selectTrainRun,
    }),
    shallow
  );

export const useFilteredTrains = () =>
  useTrainStore((state) => {
    const { filters, trains } = state;
    const search = filters.search.trim().toLowerCase();

    return trains.filter((train) => {
      const matchesSearch =
        !search ||
        train.TrainName.toLowerCase().includes(search) ||
        train.TrainDescription?.toLowerCase().includes(search) ||
        String(train.TrainNumber).includes(search);

      const matchesLive =
        !filters.onlyLive || train.livePosition || train.IsLive;
      const matchesDirection =
        filters.direction === "all" ||
        (filters.direction === "up" && train.IsUp) ||
        (filters.direction === "down" && !train.IsUp);
      const matchesPassenger =
        !filters.onlyPassenger || isPassengerTrain(train);

      return (
        matchesSearch && matchesLive && matchesDirection && matchesPassenger
      );
    });
  }, shallow);

export const useStationLookup = () =>
  useTrainStore((state) => state.stationLookup);

export const useDatasetBootstrap = () => {
  const setDataset = useTrainStore((state) => state.setDataset);
  const isHydrated = useTrainStore((state) => state.isDatasetHydrated);

  useEffect(() => {
    if (isHydrated) return;
    let cancelled = false;
    loadTrainDataset()
      .then((dataset) => !cancelled && setDataset(dataset))
      .catch(async (err) => {
        console.error("Failed to load dataset from IndexedDB", err);
        const dataset = await loadTrainDatasetSync();
        if (!cancelled) setDataset(dataset);
      });
    return () => {
      cancelled = true;
    };
  }, [isHydrated, setDataset]);
};

export const useLiveSocket = () => {
  const applyDeltas = useTrainStore((state) => state.applyDeltas);
  const setConnectionStatus = useTrainStore(
    (state) => state.setConnectionStatus
  );
  const setLastError = useTrainStore((state) => state.setLastError);
  const pruneStaleRuns = useTrainStore((state) => state.pruneStaleRuns);

  useEffect(() => {
    setConnectionStatus("connecting");
    const disconnect = connectLiveSocket(applyDeltas, {
      onConnect: () => {
        setConnectionStatus("connected");
        setLastError(undefined);
      },
      onDisconnect: () => {
        setConnectionStatus("disconnected");
      },
      onReconnectAttempt: () => {
        setConnectionStatus("reconnecting");
      },
      onReconnect: () => {
        setConnectionStatus("connected");
        setLastError(undefined);
      },
      onError: (err) => {
        setLastError(err.message);
        setConnectionStatus("error");
      },
    });
    return () => {
      setConnectionStatus("disconnected");
      disconnect();
    };
  }, [applyDeltas, setConnectionStatus, setLastError]);

  useEffect(() => {
    pruneStaleRuns();
    const interval = window.setInterval(pruneStaleRuns, STALE_LIVE_RUN_TTL_MS);
    return () => window.clearInterval(interval);
  }, [pruneStaleRuns]);
};

export const useDashboardData = () => {
  const trains = useFilteredTrains();
  const { filters, setFilters } = useTrainFilters();
  const { selectedTrain, selectTrain, selectTrainRun } = useSelectedTrain();
  const allTrains = useTrainStore((state) => state.trains);
  const liveCount = useTrainStore((state) => state.liveDeltas.size);
  const unresolvedCount = useTrainStore((state) => state.unresolvedDeltas.size);
  const connectionStatus = useTrainStore((state) => state.connectionStatus);
  const lastSocketEvent = useTrainStore((state) => state.lastSocketEvent);
  const lastError = useTrainStore((state) => state.lastError);

  return useMemo(
    () => ({
      allTrains,
      trains,
      filters,
      setFilters,
      selectedTrain,
      selectTrain,
      selectTrainRun,
      liveCount,
      unresolvedCount,
      connectionStatus,
      lastSocketEvent,
      lastError,
    }),
    [
      allTrains,
      trains,
      filters,
      setFilters,
      selectedTrain,
      selectTrain,
      selectTrainRun,
      liveCount,
      unresolvedCount,
      connectionStatus,
      lastSocketEvent,
      lastError,
    ]
  );
};

export const useSocketMeta = () =>
  useTrainStore(
    (state) => ({
      connectionStatus: state.connectionStatus,
      lastSocketEvent: state.lastSocketEvent,
      lastError: state.lastError,
    }),
    shallow
  );
