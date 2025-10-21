export interface ApiEnvelope<T> {
  ErrorMessage: string;
  IsSuccess: boolean;
  Response: T;
}

export interface TrainSummary {
  TrainId: number;
  TrainNumber: number;
  TrainName: string;
  TrainNameUR: string;
  TrainNameWithNumber: string;
  TrainDescription: string | null;
  IsActive: boolean | null;
  Imei: string | null;
  IsLive: boolean;
  IsUp: boolean;
  LocomotiveNumber: string | null;
  TrainRideId: number;
  AllocatedDate: string | null;
}

export interface StationDetails {
  StationDetailsId: number;
  StationName: string;
  City: string | null;
  IsActive: boolean;
  IsDeleted: boolean;
  CreatedBy: number;
  UpdatedBy: number | null;
  Latitude: number;
  Longitude: number;
  StationNameUR: string;
  CreatedDate: string | null;
  UpdatedDate: string | null;
}

export interface TrainStop {
  TrainNumber: number;
  TrainName: string;
  StationId: number;
  ArrivalTime: string | null;
  IsDayChanged: number | null;
  DayCount: number | null;
  DepartureTime: string | null;
  IsUp: number;
  OrderNumber: number;
  StationName: string;
  Latitude: number;
  Longitude: number;
}

export interface TrainStationsMapEntry {
  TrainId: number;
  stations: TrainStop[];
}

export interface LiveTrainDelta {
  id: string;
  trainKey: string;
  variantKey: string;
  locomitiveNo: string | null;
  lat: number;
  lon: number;
  lastUpdated: number;
  lateBy: number | null;
  nextStationId: number | null;
  nextStopName: string | null;
  prevStationId: number | null;
  speed: number | null;
  trainNumber: number | null;
  dayNumber: number | null;
  isTrainStation: boolean;
  isTrainStop: boolean;
  isFlagged: boolean;
  iconUrl: string | null;
  statusCode: string | null;
  direction: 'up' | 'down' | 'unknown';
}

export interface TrainWithRoute extends TrainSummary {
  route: TrainStop[];
  upcomingStop?: TrainStop;
  previousStop?: TrainStop;
  livePosition?: LiveTrainDelta;
  liveRuns?: LiveTrainDelta[];
  selectedRunId?: string;
}

export interface TrainFilters {
  search: string;
  onlyLive: boolean;
  onlyPassenger: boolean;
  direction: 'all' | 'up' | 'down';
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface SocketMessageEnvelope {
  [trainKey: string]: {
    [variantKey: string]: SocketTrainPayload;
  };
}

export interface SocketTrainPayload {
  locomitiveNo?: string;
  lat?: string;
  lon?: string;
  last_updated?: string;
  late_by?: string;
  next_station?: string;
  next_stop?: string;
  prev_station?: string;
  sp?: string;
  isTrainStation?: string;
  isTrainStop?: string;
  isFlagged?: string;
  icon?: string;
  st?: string;
  __last_updated?: number;
}
