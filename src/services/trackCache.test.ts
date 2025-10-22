// trackCache.test.ts
import { getCachedTrack, setCachedTrack } from "./trackCache";
import type { TrackData } from "./trackApi";

describe("trackCache", () => {
  const sampleTrack: TrackData = {
    TrainId: 123,
    stations: [
      {
        TrainNumber: 1,
        TrainName: "Test Train",
        StationId: 1,
        ArrivalTime: null,
        IsDayChanged: null,
        DayCount: null,
        DepartureTime: "10:00:00",
        IsUp: 1,
        OrderNumber: 1,
        StationName: "Alpha",
        Latitude: 10,
        Longitude: 20,
        trackGeometryToNext: [
          [10, 20],
          [11, 21],
        ],
      },
    ],
  };

  it("should cache and retrieve track data by TrainId", async () => {
    await setCachedTrack(sampleTrack.TrainId, sampleTrack);
    const cached = await getCachedTrack(sampleTrack.TrainId);
    expect(cached).toBeDefined();
    expect(cached?.TrainId).toBe(sampleTrack.TrainId);
    expect(cached?.stations.length).toBe(1);
    expect(cached?.stations[0].StationName).toBe("Alpha");
  });

  it("should return undefined for missing TrainId", async () => {
    const cached = await getCachedTrack(999999);
    expect(cached).toBeUndefined();
  });
});