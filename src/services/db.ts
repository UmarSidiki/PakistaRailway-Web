// db.ts
import Dexie, { Table } from 'dexie';
import { StationDetails, TrainWithRoute, LiveTrainDelta } from '@/types';

export class AppDB extends Dexie {
  trains!: Table<TrainWithRoute, number>;
  stations!: Table<StationDetails, number>;
  liveDeltas!: Table<LiveTrainDelta, string>; // New table for live deltas
  lastUpdated!: Table<{ name: string; timestamp: number }, string>;

  constructor() {
    super('PakRailDB');
    this.version(1).stores({
      trains: 'TrainId, TrainNumber, TrainName, IsUp, IsLive',
      stations: 'StationDetailsId, StationName',
      lastUpdated: 'name',
    });

    // Version 2: Add the liveDeltas table
    this.version(2).stores({
      liveDeltas: 'id, trainKey, lastUpdated, trainNumber',
    });
  }
}

export const db = new AppDB();