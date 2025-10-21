import type { TrainWithRoute } from '@/types';

/**
 * Keywords used to identify cargo trains
 */
const CARGO_KEYWORDS = [
  'freight',
  'goods',
  'cargo',
  'coal',
  'cement',
  'oil',
  'petrol',
  'diesel',
  'ballast',
  'container'
];

const PASSENGER_KEYWORD_PATTERNS: RegExp[] = [
  /\bexpress\b/i,
  /\bmail\b/i,
  /\bpassenger\b/i,
  /\bintercity\b/i,
  /\brailcar\b/i,
  /\bshuttle\b/i,
  /\bspecial\b/i
];

const PASSENGER_DIRECTION_PATTERNS: RegExp[] = [
  /\b(up|down|dn)\b/i,
  /(?:^|[\s-])\d{1,4}\s*(up|dn)(?:$|[\s-])/i,
  /\d{1,4}(up|dn)\b/i,
  /\b(up|dn)\d{1,4}/i
];

/**
 * Minimum train number threshold for cargo trains
 */
const CARGO_TRAIN_NUMBER_THRESHOLD = 5000;

/**
 * Determines if a train is a passenger train based on train number and keywords
 */
export const isPassengerTrain = (train: TrainWithRoute): boolean => {
  // Trains with numbers >= 5000 are typically cargo
  if (train.TrainNumber >= CARGO_TRAIN_NUMBER_THRESHOLD) {
    return false;
  }

  const haystack = `${train.TrainName} ${train.TrainDescription ?? ''}`.toLowerCase();

  // Check for cargo keywords first (higher priority)
  if (CARGO_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return false;
  }

  if (PASSENGER_KEYWORD_PATTERNS.some((pattern) => pattern.test(train.TrainName) || pattern.test(train.TrainDescription ?? ''))) {
    return true;
  }

  const normalizedName = train.TrainName.trim();

  return PASSENGER_DIRECTION_PATTERNS.some((pattern) => pattern.test(normalizedName));
};

/**
 * Determines if a train is a cargo/freight train
 */
export const isCargoTrain = (train: TrainWithRoute): boolean => {
  return !isPassengerTrain(train);
};

/**
 * Gets the train type label
 */
export const getTrainTypeLabel = (train: TrainWithRoute): string => {
  return isPassengerTrain(train) ? 'Passenger' : 'Cargo';
};
