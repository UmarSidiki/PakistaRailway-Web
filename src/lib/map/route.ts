import type { LatLngExpression } from 'leaflet';
import type { TrainWithRoute, TrainStop, StationDetails } from '@/types';

/**
 * Route processing result containing completed and remaining segments
 */
export interface ProcessedRoute {
  completedRoute: LatLngExpression[];
  remainingRoute: LatLngExpression[];
}

/**
 * Station information for map display
 */
export interface RouteStation {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Converts train route stops to coordinate points
 */
export const getRoutePoints = (train: TrainWithRoute): [number, number][] => {
  return train.route.map((stop) => [stop.Latitude, stop.Longitude] as [number, number]);
};

/**
 * Extracts station information from route stops
 */
export const getRouteStations = (
  train: TrainWithRoute,
  stationLookup: Map<number, StationDetails>
): RouteStation[] => {
  return train.route
    .map((stop) => {
      const meta = stationLookup.get(stop.StationId);
      if (!meta) return null;
      
      return {
        id: stop.StationId,
        name: stop.StationName,
        lat: meta.Latitude,
        lon: meta.Longitude
      };
    })
    .filter((s): s is RouteStation => s !== null);
};

/**
 * Processes route into completed and remaining segments based on live position
 */
export const processRouteSegments = (
  train: TrainWithRoute,
  routePoints: [number, number][]
): ProcessedRoute => {
  if (!train.livePosition || routePoints.length === 0) {
    return {
      completedRoute: [],
      remainingRoute: routePoints
    };
  }

  const upcomingStopIndex = train.route.findIndex(
    (stop) => stop.StationId === train.upcomingStop?.StationId
  );

  if (upcomingStopIndex > 0) {
    const liveLatLng: LatLngExpression = [
      train.livePosition.lat,
      train.livePosition.lon
    ];
    
    const pastPoints = routePoints.slice(0, upcomingStopIndex);
    const futurePoints = routePoints.slice(upcomingStopIndex);

    return {
      completedRoute: [...pastPoints, liveLatLng],
      remainingRoute: [liveLatLng, ...futurePoints]
    };
  }

  return {
    completedRoute: [],
    remainingRoute: routePoints
  };
};

/**
 * Determines the state of a stop (previous, next, or normal)
 */
export const getStopState = (
  train: TrainWithRoute,
  stop: TrainStop
): 'previous' | 'next' | 'normal' => {
  if (train.livePosition) {
    const { prevStationId, nextStationId } = train.livePosition;
    
    if (prevStationId && stop.StationId === prevStationId) {
      return 'previous';
    }
    
    if (nextStationId && stop.StationId === nextStationId) {
      return 'next';
    }
  }

  if (train.upcomingStop && stop.StationId === train.upcomingStop.StationId) {
    return 'next';
  }

  return 'normal';
};
