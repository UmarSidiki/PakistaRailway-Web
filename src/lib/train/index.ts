/**
 * Train library - Centralized train-related utilities
 */

export * from './classification';
export * from './status';

/**
 * Generates a unique key for a train using TrainId and AllocatedDate.
 * This helps differentiate trains with the same ID but different dates.
 */
export const getTrainUniqueKey = (train: { TrainId: number; AllocatedDate?: string | null }): string => {
  const date = train.AllocatedDate ? new Date(train.AllocatedDate).toISOString().split('T')[0] : 'no-date';
  return `${train.TrainId}-${date}`;
};
