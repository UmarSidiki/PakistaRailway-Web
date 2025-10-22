// trackApi.ts

export interface TrackStation {
  TrainNumber: number;
  TrainName: string;
  StationId: number;
  ArrivalTime: string | null;
  IsDayChanged: boolean | null;
  DayCount: number | null;
  DepartureTime: string | null;
  IsUp: number;
  OrderNumber: number;
  StationName: string;
  Latitude: number;
  Longitude: number;
  trackGeometryToNext: [number, number][];
}

export interface TrackData {
  TrainId: number;
  stations: TrackStation[];
}

/**
 * Fetches real track data for a given train from the API.
 * @param trainId TrainId
 * @returns Track data object (with stations) or throws on error
 */
export async function fetchTrackData(trainId: number): Promise<TrackData> {
  const url = `${process.env.VITE_PUBLIC_SOCKET_URL}/api/tracks/${trainId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Track API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.stations)) {
      throw new Error("Track API: Invalid response structure");
    }
    return data as TrackData;
  } catch (err) {
    console.error("Failed to fetch track data", err);
    throw err;
  }
}