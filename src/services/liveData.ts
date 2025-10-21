import type { LiveTrainDelta, SocketMessageEnvelope, SocketTrainPayload, TrainWithRoute } from '@/types';
import { findStopByStationId } from './dataLoader';

export const SOCKET_URL = process.env.VITE_PUBLIC_SOCKET_URL as string;

export const SOCKET_OPTIONS = {
  path: '/socket.io',
  transports: ['websocket'] as const,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  forceNew: true,
  secure: true,
  withCredentials: false,
  autoConnect: true,
  upgrade: false,
  // query: {
  //   EIO: '3'
  // }
} as const;

const parseBoolean = (value?: string): boolean => value?.toLowerCase() === 'true';

const parseDirection = (iconUrl?: string | null): 'up' | 'down' | 'unknown' => {
  if (!iconUrl) return 'unknown';
  if (iconUrl.toLowerCase().includes('up')) return 'up';
  if (iconUrl.toLowerCase().includes('down')) return 'down';
  return 'unknown';
};

const extractTrainNumberFromKey = (value?: string | null): number | null => {
  if (!value) return null;
  if (value.endsWith('9900')) {
    const core = value.slice(0, -4);
    const parsed = Number(core);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value.endsWith('099900')) {
    const core = value.slice(0, -6);
    const parsed = Number(core);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseSocketPayload = (
  trainKey: string,
  variantKey: string,
  payload: SocketTrainPayload
): LiveTrainDelta | null => {
  const lat = Number(payload.lat);
  const lon = Number(payload.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const lastUpdated = payload.__last_updated ?? (payload.last_updated ? Number(payload.last_updated) * 1000 : Date.now());
  const speed = payload.sp ? Number(payload.sp) : null;
  const trainNumber = extractTrainNumberFromKey(trainKey) ?? extractTrainNumberFromKey(variantKey);

  return {
    id: `${trainKey}:${variantKey}`,
    trainKey,
    variantKey,
    locomitiveNo: payload.locomitiveNo ?? null,
    lat,
    lon,
    lastUpdated,
    lateBy: payload.late_by ? Number(payload.late_by) : null,
    nextStationId: payload.next_station ? Number(payload.next_station) : null,
    nextStopName: payload.next_stop ?? null,
    prevStationId: payload.prev_station ? Number(payload.prev_station) : null,
  speed: Number.isFinite(speed) ? speed : null,
  trainNumber: Number.isFinite(trainNumber) ? trainNumber : null,
    dayNumber: null,
    isTrainStation: parseBoolean(payload.isTrainStation),
    isTrainStop: parseBoolean(payload.isTrainStop),
    isFlagged: parseBoolean(payload.isFlagged),
    iconUrl: payload.icon ?? null,
    statusCode: payload.st ?? null,
    direction: parseDirection(payload.icon)
  };
};

export const flattenSocketEnvelope = (envelope: SocketMessageEnvelope): LiveTrainDelta[] => {
  const deltas: LiveTrainDelta[] = [];

  for (const [trainKey, variants] of Object.entries(envelope)) {
    for (const [variantKey, payload] of Object.entries(variants)) {
      const delta = parseSocketPayload(trainKey, variantKey, payload);
      if (delta) {
        deltas.push(delta);
      }
    }
  }

  return deltas;
};

export const findMatchingTrainId = (trains: TrainWithRoute[], delta: LiveTrainDelta): number | undefined => {
  if (delta.trainNumber != null && Number.isFinite(delta.trainNumber)) {
    const numberMatch = trains.find((train) => train.TrainNumber === delta.trainNumber);
    if (numberMatch) {
      return numberMatch.TrainId;
    }
  }

  type CandidateScore = {
    train: TrainWithRoute;
    score: number;
    reasons: string[];
  };

  const directionFlag = delta.direction === 'unknown' ? undefined : delta.direction === 'up';

  const scoredCandidates: CandidateScore[] = trains
    .map((train) => {
      let score = 0;
      const reasons: string[] = [];

      if (delta.locomitiveNo && train.LocomotiveNumber && delta.locomitiveNo === train.LocomotiveNumber) {
        score += 10;
        reasons.push('locomotive');
      }

      const nextStop = delta.nextStationId ? findStopByStationId(train.route, delta.nextStationId) : undefined;
      if (nextStop) {
        score += 4;
        reasons.push('nextStation');
      }

      const prevStop = delta.prevStationId ? findStopByStationId(train.route, delta.prevStationId) : undefined;
      if (prevStop) {
        score += 4;
        reasons.push('prevStation');
      }

      if (nextStop && prevStop) {
        const nextIndex = train.route.findIndex((stop) => stop.StationId === delta.nextStationId);
        const prevIndex = train.route.findIndex((stop) => stop.StationId === delta.prevStationId);
        if (prevIndex !== -1 && nextIndex !== -1 && prevIndex < nextIndex) {
          score += 1;
          reasons.push('stationOrder');
        }
      }

      if (directionFlag != null) {
        if (train.IsUp === directionFlag) {
          score += 1;
          reasons.push('direction');
        }
      }

      if (delta.nextStopName) {
        const nameLower = delta.nextStopName.toLowerCase();
        const matchesStopName = train.route.some((stop) => stop.StationName.toLowerCase() === nameLower);
        if (matchesStopName) {
          score += 0.5;
          reasons.push('nextStopName');
        } else if (train.TrainName.toLowerCase().includes(nameLower)) {
          score += 0.25;
          reasons.push('trainNameHint');
        }
      }

      return { train, score, reasons };
    })
    .filter((candidate) => candidate.score > 0);

  if (scoredCandidates.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[liveData] Unable to match live delta', {
        trainKey: delta.trainKey,
        variantKey: delta.variantKey,
        trainNumber: delta.trainNumber,
        nextStationId: delta.nextStationId,
        prevStationId: delta.prevStationId,
        direction: delta.direction,
        locomitiveNo: delta.locomitiveNo
      });
    }
    return undefined;
  }

  scoredCandidates.sort((a, b) => b.score - a.score);
  const [best, second] = scoredCandidates;

  if (!best || best.score <= 0) {
    return undefined;
  }

  const tied = scoredCandidates.filter((candidate) => candidate.score === best.score);
  if (tied.length > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[liveData] Ambiguous live delta match', {
        trainKey: delta.trainKey,
        variantKey: delta.variantKey,
        trainNumber: delta.trainNumber,
        candidates: tied.map((candidate) => ({
          trainId: candidate.train.TrainId,
          trainNumber: candidate.train.TrainNumber,
          reasons: candidate.reasons
        }))
      });
    }
    return undefined;
  }

  if (second && best.score <= second.score) {
    return undefined;
  }

  return best.train.TrainId;
};

const computeStopsForRun = (train: TrainWithRoute, run?: LiveTrainDelta) => {
  if (!run) {
    return {
      upcomingStop: undefined,
      previousStop: undefined
    };
  }

  const upcomingStop = run.nextStationId ? findStopByStationId(train.route, run.nextStationId) ?? undefined : undefined;
  const previousStop = run.prevStationId ? findStopByStationId(train.route, run.prevStationId) ?? undefined : undefined;

  return { upcomingStop, previousStop };
};

const deriveDayNumber = (train: TrainWithRoute, delta: LiveTrainDelta): number | null => {
  const upcomingStop = delta.nextStationId ? findStopByStationId(train.route, delta.nextStationId) : undefined;
  if (upcomingStop) {
    return upcomingStop.DayCount ?? null;
  }
  const previousStop = delta.prevStationId ? findStopByStationId(train.route, delta.prevStationId) : undefined;
  if (previousStop) {
    return previousStop.DayCount ?? null;
  }
  return delta.dayNumber ?? null;
};

export const updateTrainWithDelta = (
  train: TrainWithRoute,
  delta: LiveTrainDelta,
  preferredRunId?: string
): TrainWithRoute => {
  const dayNumber = deriveDayNumber(train, delta);
  const normalizedDelta: LiveTrainDelta = {
    ...delta,
    dayNumber
  };

  const existingRuns = train.liveRuns ?? [];
  const filteredRuns = existingRuns.filter((run) => run.id !== normalizedDelta.id);
  const mergedRuns = [...filteredRuns, normalizedDelta].sort((a, b) => b.lastUpdated - a.lastUpdated);

  const desiredRunId = preferredRunId ?? train.selectedRunId ?? normalizedDelta.id;
  const selectedRun = mergedRuns.find((run) => run.id === desiredRunId) ?? mergedRuns[0] ?? normalizedDelta;
  const { upcomingStop, previousStop } = computeStopsForRun(train, selectedRun);

  return {
    ...train,
    IsLive: true,
    liveRuns: mergedRuns,
    selectedRunId: selectedRun.id,
    livePosition: selectedRun,
    upcomingStop,
    previousStop
  };
};

export const applyRunSelectionToTrain = (train: TrainWithRoute, runId: string): TrainWithRoute => {
  const run = train.liveRuns?.find((candidate) => candidate.id === runId);
  if (!run) {
    return train;
  }

  const { upcomingStop, previousStop } = computeStopsForRun(train, run);

  return {
    ...train,
    IsLive: true,
    selectedRunId: run.id,
    livePosition: run,
    upcomingStop,
    previousStop
  };
};
