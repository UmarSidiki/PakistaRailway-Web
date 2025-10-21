import type { LatLngExpression } from 'leaflet';

// Default map center (Pakistan railway center)
export const DEFAULT_MAP_CENTER: LatLngExpression = [30.3753, 69.3451];

// Default zoom level for map
export const DEFAULT_ZOOM = 8.2;

// Zoom level when focusing on a specific train
export const TRAIN_FOCUS_ZOOM = 8.5;

// Zoom level for route overview
export const ROUTE_OVERVIEW_ZOOM = 7;

// Maximum zoom level for route bounds
export const MAX_ROUTE_ZOOM = 7;

// Padding for map bounds (in pixels)
export const BOUNDS_PADDING: [number, number] = [48, 48];

// Duration for map animations (in seconds)
export const ANIMATION_DURATION = 0.8;

// Timeout for user override (in milliseconds)
export const USER_OVERRIDE_TIMEOUT = 5000;


//  Polyline style for completed route
export const COMPLETED_ROUTE_STYLE = {
  color: '#1e40af',
  weight: 5,
  opacity: 0.8,
  lineCap: 'round' as const,
  lineJoin: 'round' as const
};

// Polyline style for remaining route
export const REMAINING_ROUTE_STYLE = {
  color: '#60a5fa',
  weight: 4,
  opacity: 0.7,
  dashArray: '12, 8',
  lineCap: 'round' as const,
  lineJoin: 'round' as const
};
