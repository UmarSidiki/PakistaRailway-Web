// trackCache.ts

/**
 * Utility functions for caching train track data in IndexedDB.
 * Provides type-safe get/set operations for track geometry per train.
 * Depends on Dexie and the TrackData interface.
 *
 * @module trackCache
 */

import { db } from "./db";
import type { TrackData } from "./trackApi";

/**
 * Retrieves cached track data for a specific train from IndexedDB.
 * @param trainId - The TrainId to look up.
 * @returns A promise resolving to the cached TrackData, or undefined if not found.
 */
export async function getCachedTrack(trainId: number): Promise<TrackData | undefined> {
  try {
    return await db.tracks.get(trainId);
  } catch (err) {
    console.error("Failed to get cached track", err);
    return undefined;
  }
}

/**
 * Saves track data for a train to IndexedDB cache.
 * @param trainId - The TrainId to associate with the data.
 * @param data - The TrackData object (should include stations).
 * @returns A promise that resolves when the operation completes.
 */
export async function setCachedTrack(trainId: number, data: TrackData): Promise<void> {
  try {
    await db.tracks.put({ ...data, TrainId: trainId });
  } catch (err) {
    console.error("Failed to cache track", err);
  }
}