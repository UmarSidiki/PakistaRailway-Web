import type { TrainWithRoute } from '@/types';

/**
 * Status variant for train display
 */
export type TrainStatus = 'live' | 'active' | 'offline';

/**
 * Gets the status variant and label for a train
 */
export const getTrainStatus = (train: TrainWithRoute): { variant: TrainStatus; label: string } => {
  if (train.livePosition) {
    return { variant: 'live', label: 'Live' };
  }
  
  if (train.IsLive) {
    return { variant: 'active', label: 'Active' };
  }
  
  return { variant: 'offline', label: 'Offline' };
};

/**
 * Gets the direction label for a train
 */
export const getDirectionLabel = (isUp: boolean): string => {
  return isUp ? 'Up (Northbound)' : 'Down (Southbound)';
};

/**
 * Gets the direction icon for a train
 */
export const getDirectionIcon = (isUp: boolean): string => {
  return isUp ? '⬆' : '⬇';
};

/**
 * Checks if train has multiple runs
 */
export const hasMultipleRuns = (train: TrainWithRoute): boolean => {
  return Boolean(train.liveRuns && train.liveRuns.length > 1);
};

/**
 * Gets active run count for a train
 */
export const getRunCount = (train: TrainWithRoute): number => {
  return train.liveRuns?.length ?? 0;
};
