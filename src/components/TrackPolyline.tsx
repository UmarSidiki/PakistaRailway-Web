// TrackPolyline.tsx
import React, { useMemo } from "react";
import { Polyline } from "react-leaflet";

export interface TrackPolylineProps {
  routePoints: [number, number][];
  livePosition?: { lat: number; lon: number } | null;
}

/**
 * Renders passed and remaining track segments as separate polylines.
 * - Passed: solid line up to current live position.
 * - Remaining: dashed line from live position to end.
 */
export const TrackPolyline: React.FC<TrackPolylineProps> = ({
  routePoints,
  livePosition,
}) => {
  const [passedTrackPoints, remainingTrackPoints] = useMemo(() => {
    if (!livePosition || !routePoints.length) return [[], []];
    const { lat, lon } = livePosition;
    let minIdx = 0;
    let minDist = Number.POSITIVE_INFINITY;
    routePoints.forEach(([ptLat, ptLon], idx) => {
      const d = Math.hypot(ptLat - lat, ptLon - lon);
      if (d < minDist) {
        minDist = d;
        minIdx = idx;
      }
    });
    return [
      routePoints.slice(0, minIdx + 1),
      routePoints.slice(minIdx),
    ];
  }, [livePosition, routePoints]);

  return (
    <>
      {passedTrackPoints.length > 1 && (
        <Polyline
          positions={passedTrackPoints}
          pathOptions={{
            color: "#1e40af",
            weight: 5,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}
      {remainingTrackPoints.length > 1 && (
        <Polyline
          positions={remainingTrackPoints}
          pathOptions={{
            color: "#60a5fa",
            weight: 4,
            opacity: 0.7,
            dashArray: "12, 8",
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}
    </>
  );
};