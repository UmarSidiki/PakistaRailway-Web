import { useState, useEffect, useCallback, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM,
  TRAIN_FOCUS_ZOOM,
  ROUTE_OVERVIEW_ZOOM,
  MAX_ROUTE_ZOOM,
  BOUNDS_PADDING,
  ANIMATION_DURATION,
  USER_OVERRIDE_TIMEOUT,
} from "@/lib/map/constants";

interface MapControlOptions {
  selectedPosition?: [number, number];
  displayedPoints: [number, number][];
  routePoints: [number, number][];
  hasLivePosition: boolean;
}

// Custom hook for managing map interactions and auto-follow behavior
export const useMapControl = (options: MapControlOptions) => {
  const { selectedPosition, displayedPoints, routePoints, hasLivePosition } =
    options;

  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [userOverrideActive, setUserOverrideActive] = useState(false);
  const overrideTimerRef = useRef<number | null>(null);

  // --- Helper Functions for Map View ---

  // Clears the user override timer
  const clearOverrideTimer = useCallback(() => {
    if (overrideTimerRef.current != null) {
      window.clearTimeout(overrideTimerRef.current);
      overrideTimerRef.current = null;
    }
  }, []);

  // Disables user override and prepares for programmatic map control
  const disableUserOverride = useCallback(() => {
    clearOverrideTimer();
    setUserOverrideActive(false);
  }, [clearOverrideTimer]);

  // Flies the map to a single point.
  const flyToPoint = useCallback(
    (point: L.LatLngExpression, zoom: number) => {
      if (!mapInstance) return;
      mapInstance.flyTo(point, zoom, {
        animate: true,
        duration: ANIMATION_DURATION,
      });
    },
    [mapInstance]
  );

  // Fits the map bounds to an array of points. Handles single-point case.
  const fitToPoints = useCallback(
    (points: [number, number][], maxZoom: number) => {
      if (!mapInstance || points.length === 0) return;
      if (points.length === 1) {
        flyToPoint(points[0], ROUTE_OVERVIEW_ZOOM);
        return;
      }
      const bounds = L.latLngBounds(points.map((p) => L.latLng(p)));
      mapInstance.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom });
    },
    [mapInstance, flyToPoint]
  );

  // --- Public Control Functions ---

  // Handles user interaction with the map (drag, zoom, click)
  const handleUserInteraction = useCallback(() => {
    setUserOverrideActive(true);
    // Reset override after a period of inactivity
    window.setTimeout(() => {
      setUserOverrideActive(false);
    }, USER_OVERRIDE_TIMEOUT);
  }, []); // No dependencies needed, uses the latest state from the closure

  // Centers map on selected train position
  const centerOnTrain = useCallback(() => {
    if (!selectedPosition) return;
    disableUserOverride();
    flyToPoint(selectedPosition, TRAIN_FOCUS_ZOOM);
  }, [selectedPosition, disableUserOverride, flyToPoint]);

  // Fits map to show entire route
  const fitRoute = useCallback(() => {
    if (routePoints.length === 0) return;
    disableUserOverride();
    fitToPoints(routePoints, MAX_ROUTE_ZOOM);
  }, [routePoints, disableUserOverride, fitToPoints]);

  // Resets map to default view
  const resetView = useCallback(() => {
    disableUserOverride();
    flyToPoint(DEFAULT_MAP_CENTER, DEFAULT_ZOOM);
  }, [disableUserOverride, flyToPoint]);

  // --- Effects ---

  // Auto-follow train position or adjust view based on available data
  useEffect(() => {
    if (!mapInstance || userOverrideActive) return;

    if (hasLivePosition && selectedPosition) {
      flyToPoint(selectedPosition, TRAIN_FOCUS_ZOOM);
    } else if (displayedPoints.length > 0) {
      fitToPoints(displayedPoints, MAX_ROUTE_ZOOM - 0.5);
    } else if (routePoints.length > 0) {
      fitToPoints(routePoints, MAX_ROUTE_ZOOM);
    } else {
      flyToPoint(DEFAULT_MAP_CENTER, DEFAULT_ZOOM);
    }
  }, [
    mapInstance,
    selectedPosition,
    displayedPoints,
    routePoints,
    hasLivePosition,
    userOverrideActive,
    flyToPoint,
    fitToPoints,
  ]);

  // Reset override when a new train is selected
  useEffect(() => {
    disableUserOverride();
  }, [selectedPosition?.[0], selectedPosition?.[1], disableUserOverride]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearOverrideTimer();
  }, [clearOverrideTimer]);

  return {
    mapInstance,
    setMapInstance,
    userOverrideActive,
    handleUserInteraction,
    centerOnTrain,
    fitRoute,
    resetView,
  };
};
