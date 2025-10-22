// db.ts
import Dexie, { Table } from 'dexie';
import { StationDetails, TrainWithRoute, LiveTrainDelta } from '@/types';

export class AppDB extends Dexie {
  trains!: Table<TrainWithRoute, number>;
  stations!: Table<StationDetails, number>;
  liveDeltas!: Table<LiveTrainDelta, string>;
  lastUpdated!: Table<{ name: string; timestamp: number }, string>;
  tracks!: Table<any, number>; // Track data by TrainId

  constructor() {
    super('PakRailDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      trains: 'TrainId, TrainNumber, TrainName, IsUp, IsLive',
      stations: 'StationDetailsId, StationName',
      lastUpdated: 'name',
    });

    // Version 2: Add the liveDeltas table
    this.version(2).stores({
      trains: 'TrainId, TrainNumber, TrainName, IsUp, IsLive',
      stations: 'StationDetailsId, StationName',
      lastUpdated: 'name',
      liveDeltas: 'id, trainKey, lastUpdated, trainNumber',
    });

    // Version 3: Add the tracks table
    this.version(3).stores({
      trains: 'TrainId, TrainNumber, TrainName, IsUp, IsLive',
      stations: 'StationDetailsId, StationName',
      lastUpdated: 'name',
      liveDeltas: 'id, trainKey, lastUpdated, trainNumber',
      tracks: 'TrainId'
    });

    // Handle database events
    this.on('blocked', () => {
      console.warn('Database blocked - another tab might be open with an older version');
    });

    this.on('versionchange', () => {
      console.log('Database version changed - closing connection');
      this.close();
    });
  }

  // Method to check if database has recent data
  async hasRecentData(maxAgeMs: number = 60 * 60 * 1000) {
    try {
      const lastUpdated = await this.lastUpdated.get('trains');
      if (!lastUpdated) return false;
      
      const now = Date.now();
      return (now - lastUpdated.timestamp) < maxAgeMs;
    } catch (error) {
      console.error('Error checking data freshness:', error);
      return false;
    }
  }

  // Method to mark data as updated
  async markDataUpdated(dataType: string = 'trains') {
    try {
      await this.lastUpdated.put({
        name: dataType,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error marking data as updated:', error);
    }
  }
}

export const db = new AppDB();