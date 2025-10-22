// dataLoader.ts
import type {
  ApiEnvelope,
  TrainSummary,
  TrainStationsMapEntry,
  StationDetails,
  TrainWithRoute,
  TrainStop,
  LiveTrainDelta
} from '@/types';
import { db } from './db';
import { findMatchingTrainId, updateTrainWithDelta } from './liveData';
import { getTrainUniqueKey } from '@/lib/train';

export interface TrainDataset {
  trains: TrainWithRoute[];
  stationById: Map<number, StationDetails>;
}

// --- API Fetch Functions ---
const fetchTrains = async (): Promise<ApiEnvelope<TrainSummary[]>> => {
  const response = await fetch(`${import.meta.env.VITE_PUBLIC_SOCKET_URL}/api/trains`);
  return response.json();
};

const fetchStations = async (): Promise<ApiEnvelope<StationDetails[]>> => {
  const response = await fetch(`${import.meta.env.VITE_PUBLIC_SOCKET_URL}/api/stations`);
  return response.json();
};

const fetchTrainStations = async (): Promise<TrainStationsMapEntry[]> => {
  const response = await fetch(`${import.meta.env.VITE_PUBLIC_SOCKET_URL}/api/train-stations`);
  return response.json();
};

// --- Static Data Builders (unchanged) ---
const buildStationMap = (collection: StationDetails[]): Map<number, StationDetails> =>
  new Map(collection.map((station) => [station.StationDetailsId, station]));

const buildRouteMap = (entries: TrainStationsMapEntry[]): Map<number, TrainStop[]> =>
  new Map(
    entries.map((entry) => [
      entry.TrainId,
      [...entry.stations].sort((a, b) => a.OrderNumber - b.OrderNumber)
    ])
  );

const buildStaticDataset = async (): Promise<TrainDataset> => {
  const [trainsEnvelope, stationsEnvelope, trainStationsList] = await Promise.all([
    fetchTrains(),
    fetchStations(),
    fetchTrainStations()
  ]);

  const trains: TrainSummary[] = trainsEnvelope.Response;
  const stations: StationDetails[] = stationsEnvelope.Response;
  const stationMap = buildStationMap(stations);
  const routeByTrainId = buildRouteMap(trainStationsList);

  const dataset: TrainWithRoute[] = trains.map((train) => {
    const route = routeByTrainId.get(train.TrainId) ?? [];
    return {
      ...train,
      route,
      upcomingStop: route[0],
      previousStop: undefined
    };
  });

  return { trains: dataset, stationById: stationMap };
};

// --- Live Data Management (New & Refactored) ---
export const STALE_LIVE_RUN_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Persists a batch of live deltas to the database.
 */
export const persistLiveDeltas = async (deltas: LiveTrainDelta[]) => {
  if (deltas.length === 0) return;
  await db.liveDeltas.bulkPut(deltas);
};

/**
 * Clears stale live deltas from the database.
 */
export const pruneStaleDeltasFromDB = async () => {
  const staleTime = Date.now() - STALE_LIVE_RUN_TTL_MS;
  await db.liveDeltas.where('lastUpdated').below(staleTime).delete();
};

/**
 * Loads and applies the most recent live deltas to the static dataset.
 * This is key for restoring the last known state offline.
 */
const applyStoredLiveDeltas = async (staticTrains: TrainWithRoute[]): Promise<TrainWithRoute[]> => {
  const deltas = await db.liveDeltas.orderBy('lastUpdated').toArray();
  if (deltas.length === 0) return staticTrains;

  // Create a map for efficient delta lookups
  const deltaMap = new Map(deltas.map(d => [d.id, d]));
  const trainKeyToId = new Map<string, number>();
  const selectedRunIds = new Map<string, string>();

  let updatedTrains = staticTrains;

  // Apply deltas using the same logic as the live socket
  deltas.forEach(delta => {
    const targetTrainId = trainKeyToId.get(delta.trainKey) ?? findMatchingTrainId(updatedTrains, delta);
    if (targetTrainId) {
      trainKeyToId.set(delta.trainKey, targetTrainId);
      updatedTrains = updatedTrains.map(train =>
        train.TrainId === targetTrainId
          ? updateTrainWithDelta(train, delta, selectedRunIds.get(getTrainUniqueKey(train)))
          : train
      );
      const updatedTrain = updatedTrains.find(t => t.TrainId === targetTrainId);
      if (updatedTrain?.selectedRunId) {
        selectedRunIds.set(getTrainUniqueKey(updatedTrain), updatedTrain.selectedRunId);
      }
    }
  });

  return stripStaleLiveData(updatedTrains);
};

// --- Main Dataset Loading Logic (Refactored) ---
export const loadTrainDatasetSync = async (): Promise<TrainDataset> => buildStaticDataset();

export const loadTrainDataset = async (): Promise<TrainDataset> => {
  const [storedTrains, storedStations] = await Promise.all([
    db.trains.toArray(),
    db.stations.toArray()
  ]);

  // If we have data in DB, use it as the base
  if (storedTrains.length > 0 && storedStations.length > 0) {
    const stationById = buildStationMap(storedStations);
    const trainsWithLiveData = await applyStoredLiveDeltas(storedTrains);
    return { trains: trainsWithLiveData, stationById };
  }

  // Otherwise, build from static JSON and persist it
  const dataset = await buildStaticDataset();
  await persistDataset(dataset);
  return dataset;
};

export const refreshTrainDataset = async (): Promise<TrainDataset> => {
  const dataset = await buildStaticDataset();
  await persistDataset(dataset);
  // Clear old live deltas to prevent mixing with new static data
  await db.liveDeltas.clear();
  return dataset;
};

// --- Persistence and Sanitization (Simplified) ---
const persistDataset = async ({ trains, stationById }: TrainDataset) => {
  const stations = Array.from(stationById.values());
  await db.transaction('rw', db.trains, db.stations, db.lastUpdated, async () => {
    await db.trains.clear();
    await db.stations.clear();
    await db.trains.bulkPut(trains);
    await db.stations.bulkPut(stations);
    await db.lastUpdated.put({ name: 'dataset', timestamp: Date.now() });
  });
};

export const persistTrainSnapshot = async (trains: TrainWithRoute[]) => {
  const normalizedTrains = stripStaleLiveData(trains);
  await db.trains.bulkPut(normalizedTrains);
  await db.lastUpdated.put({ name: 'dataset', timestamp: Date.now() });
};

// --- Helper Functions (Largely Unchanged, but moved for better organization) ---
const sameStop = (a?: TrainStop, b?: TrainStop): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.StationId === b.StationId && a.OrderNumber === b.OrderNumber;
};

const resetTrainLiveState = (train: TrainWithRoute): TrainWithRoute => {
  if (!train.livePosition && !train.liveRuns?.length && !train.selectedRunId && !train.IsLive) {
    return train;
  }
  const defaultUpcoming = train.route[0];
  return { ...train, IsLive: false, livePosition: undefined, liveRuns: undefined, selectedRunId: undefined, upcomingStop: defaultUpcoming, previousStop: undefined };
};

const isRunFresh = (run: LiveTrainDelta, now: number): boolean => now - run.lastUpdated <= STALE_LIVE_RUN_TTL_MS;

const sanitizeTrainLiveState = (train: TrainWithRoute, now: number): TrainWithRoute => {
  const runs = train.liveRuns;
  if (!runs || runs.length === 0) return resetTrainLiveState(train);

  const freshRuns = runs.filter((run) => isRunFresh(run, now));
  if (freshRuns.length === 0) return resetTrainLiveState(train);

  const selectedRun = freshRuns.find((run) => run.id === train.selectedRunId) ?? freshRuns[0];
  const upcomingStop = selectedRun.nextStationId ? train.route.find(s => s.StationId === selectedRun.nextStationId) : undefined;
  const previousStop = selectedRun.prevStationId ? train.route.find(s => s.StationId === selectedRun.prevStationId) : undefined;

  const requiresUpdate = freshRuns.length !== runs.length || train.selectedRunId !== selectedRun.id || !sameStop(train.upcomingStop, upcomingStop) || !sameStop(train.previousStop, previousStop) || !train.IsLive;
  if (!requiresUpdate) return train;

  return { ...train, IsLive: true, liveRuns: freshRuns, selectedRunId: selectedRun.id, livePosition: selectedRun, upcomingStop, previousStop };
};

export const stripStaleLiveData = (trains: TrainWithRoute[], now: number = Date.now()): TrainWithRoute[] => {
  let mutated = false;
  const next = trains.map((train) => {
    const sanitized = sanitizeTrainLiveState(train, now);
    if (sanitized !== train) mutated = true;
    return sanitized;
  });
  return mutated ? next : trains;
};

export const findStopByStationId = (route: TrainStop[], stationId?: number | null): TrainStop | undefined => {
  if (!stationId) return undefined;
  return route.find((stop) => stop.StationId === stationId);
};