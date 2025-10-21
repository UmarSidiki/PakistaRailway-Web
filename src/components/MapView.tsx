import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type {
  LatLngExpression,
  LeafletEvent,
  Map as LeafletMap,
} from "leaflet";
import L from "leaflet";
import type { TrainWithRoute } from "@/types";
import {
  formatLateBy,
  formatRelativeTime,
  formatSpeed,
  formatDistance,
  calculateDistance,
  calculateExpectedArrival,
} from "@/utils/time";

interface MapViewProps {
  trains: TrainWithRoute[];
  selectedTrain?: TrainWithRoute;
  stationLookup: Map<
    number,
    { StationName: string; Latitude: number; Longitude: number }
  >;
}

const DEFAULT_CENTER: LatLngExpression = [30.3753, 69.3451];
const DEFAULT_ZOOM = 8.2;

const iconCache = new Map<string, L.DivIcon>();

const getIcon = (key: string, color: string, border: string) => {
  if (iconCache.has(key)) {
    return iconCache.get(key)!;
  }

  const icon = L.divIcon({
    className: "train-marker",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
    html: `<div style="width: 16px; height: 16px; border: 2px solid ${border}; background: ${color}; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.4); transform: rotate(45deg);"></div>`,
  });

  iconCache.set(key, icon);
  return icon;
};

const getStationIcon = () => {
  const cached = iconCache.get("station-marker");
  if (cached) return cached;

  const icon = L.divIcon({
    className: "station-marker",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 4px solid #2563eb; background: #ffffff; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.6);"></div>`,
  });

  iconCache.set("station-marker", icon);
  return icon;
};

export const MapView = ({
  trains,
  selectedTrain,
  stationLookup,
}: MapViewProps) => {
  const selectedLiveTrain = selectedTrain?.livePosition
    ? selectedTrain
    : undefined;
  const displayedTrains = useMemo(
    () => (selectedLiveTrain ? [selectedLiveTrain] : []),
    [selectedLiveTrain]
  );
  const hasAnyLiveTrain = useMemo(
    () => trains.some((train) => Boolean(train.livePosition)),
    [trains]
  );
  const displayedPoints = useMemo(
    () =>
      displayedTrains.map(
        (train) =>
          [train.livePosition!.lat, train.livePosition!.lon] as [number, number]
      ),
    [displayedTrains]
  );
  const selectedPosition = selectedLiveTrain
    ? ([
        selectedLiveTrain.livePosition!.lat,
        selectedLiveTrain.livePosition!.lon,
      ] as LatLngExpression)
    : undefined;

  const routePoints = useMemo(
    () =>
      selectedTrain?.route.map(
        (stop) => [stop.Latitude, stop.Longitude] as [number, number]
      ) ?? [],
    [selectedTrain]
  );

  const routeStations = useMemo(() => {
    if (!selectedTrain?.route) return [];
    return selectedTrain.route
      .map((stop) => {
        const meta = stationLookup.get(stop.StationId);
        if (!meta) return null;
        return {
          id: stop.StationId,
          name: stop.StationName,
          lat: meta.Latitude,
          lon: meta.Longitude,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [selectedTrain, stationLookup]);

  const { completedRoute, remainingRoute } = useMemo(() => {
    if (!selectedTrain || !routePoints.length) {
      return { completedRoute: [], remainingRoute: routePoints };
    }

    const upcomingStopIndex = selectedTrain.route.findIndex(
      (stop) => stop.StationId === selectedTrain.upcomingStop?.StationId
    );

    if (selectedLiveTrain?.livePosition && upcomingStopIndex > 0) {
      const liveLatLng: LatLngExpression = [
        selectedLiveTrain.livePosition.lat,
        selectedLiveTrain.livePosition.lon,
      ];
      const pastPoints = routePoints.slice(0, upcomingStopIndex);
      const futurePoints = routePoints.slice(upcomingStopIndex);

      return {
        completedRoute: [...pastPoints, liveLatLng],
        remainingRoute: [liveLatLng, ...futurePoints],
      };
    }

    return { completedRoute: [], remainingRoute: routePoints };
  }, [selectedTrain, routePoints, selectedLiveTrain]);

  const mapCenter =
    selectedPosition ?? displayedPoints[0] ?? routePoints[0] ?? DEFAULT_CENTER;
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [userOverrideActive, setUserOverrideActive] = useState(false);
  const overrideTimerRef = useRef<number | null>(null);

  const clearOverrideTimer = useCallback(() => {
    if (overrideTimerRef.current != null) {
      window.clearTimeout(overrideTimerRef.current);
      overrideTimerRef.current = null;
    }
  }, []);

  const scheduleOverrideReset = useCallback(() => {
    clearOverrideTimer();
    overrideTimerRef.current = window.setTimeout(() => {
      setUserOverrideActive(false);
      overrideTimerRef.current = null;
    }, 5000);
  }, [clearOverrideTimer]);

  const handleUserInteraction = useCallback(() => {
    setUserOverrideActive(true);
    scheduleOverrideReset();
  }, [scheduleOverrideReset]);

  const MapInstanceCapture = ({
    onReady,
  }: {
    onReady: (map: LeafletMap) => void;
  }) => {
    const map = useMap();
    useEffect(() => {
      onReady(map);

      // Enable two-finger drag on mobile
      if (map.dragging) {
        map.dragging.disable();
      }

      const container = map.getContainer();
      let touchCount = 0;

      const handleTouchStart = (e: TouchEvent) => {
        touchCount = e.touches.length;
        if (touchCount >= 2 && map.dragging) {
          map.dragging.enable();
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        touchCount = e.touches.length;
        if (touchCount < 2 && map.dragging) {
          map.dragging.disable();
        }
      };

      container.addEventListener("touchstart", handleTouchStart);
      container.addEventListener("touchend", handleTouchEnd);
      container.addEventListener("touchcancel", handleTouchEnd);

      return () => {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchend", handleTouchEnd);
        container.removeEventListener("touchcancel", handleTouchEnd);
      };
    }, [map, onReady]);
    return null;
  };

  const InteractionCapture = ({ onInteract }: { onInteract: () => void }) => {
    const handle = (event: LeafletEvent) => {
      const original = (event as LeafletEvent & { originalEvent?: unknown })
        .originalEvent;
      if (original) {
        onInteract();
      }
    };

    useMapEvents({
      dragstart: handle,
      zoomstart: handle,
      mousedown: handle,
    });
    return null;
  };

  useEffect(() => () => clearOverrideTimer(), [clearOverrideTimer]);

  useEffect(() => {
    clearOverrideTimer();
    setUserOverrideActive(false);
  }, [selectedTrain?.TrainId, clearOverrideTimer]);

  useEffect(() => {
    if (!mapInstance) return;

    if (userOverrideActive) {
      return;
    }

    if (selectedLiveTrain?.livePosition) {
      mapInstance.flyTo(
        [
          selectedLiveTrain.livePosition.lat,
          selectedLiveTrain.livePosition.lon,
        ],
        8.5, // Increased zoom for closer view when following train
        { animate: true, duration: 0.8 }
      );
      return;
    }

    if (displayedPoints.length > 1) {
      const bounds = L.latLngBounds(
        displayedPoints.map(([lat, lon]) => L.latLng(lat, lon))
      );
      mapInstance.fitBounds(bounds, { padding: [48, 48], maxZoom: 7.5 });
    } else if (displayedPoints.length === 1) {
      mapInstance.flyTo(displayedPoints[0], 7, {
        animate: true,
        duration: 0.8,
      });
    } else if (routePoints.length > 1) {
      const bounds = L.latLngBounds(
        routePoints.map(([lat, lon]) => L.latLng(lat, lon))
      );
      mapInstance.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
    } else if (routePoints.length === 1) {
      mapInstance.flyTo(routePoints[0], 6.5, { animate: true, duration: 0.8 });
    } else {
      mapInstance.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
    }
  }, [
    mapInstance,
    selectedLiveTrain,
    displayedPoints,
    routePoints,
    userOverrideActive,
  ]);

  const handleCenterSelected = useCallback(() => {
    if (!mapInstance || !selectedLiveTrain?.livePosition) return;
    clearOverrideTimer();
    setUserOverrideActive(false);
    mapInstance.flyTo(
      [selectedLiveTrain.livePosition.lat, selectedLiveTrain.livePosition.lon],
      8.5, // Increased zoom for closer view when manually centering
      { animate: true, duration: 0.8 }
    );
  }, [mapInstance, selectedLiveTrain, clearOverrideTimer]);

  const handleFitRoute = useCallback(() => {
    if (!mapInstance || routePoints.length === 0) return;
    clearOverrideTimer();
    setUserOverrideActive(false);

    if (routePoints.length === 1) {
      mapInstance.flyTo(routePoints[0], 6.5, { animate: true, duration: 0.8 });
      return;
    }

    const bounds = L.latLngBounds(
      routePoints.map(([lat, lon]) => L.latLng(lat, lon))
    );
    mapInstance.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
  }, [mapInstance, routePoints, clearOverrideTimer]);

  const handleReset = useCallback(() => {
    if (!mapInstance) return;
    clearOverrideTimer();
    setUserOverrideActive(false);
    mapInstance.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }, [mapInstance, clearOverrideTimer]);

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] lg:flex-1 lg:min-h-[400px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
      <MapContainer
        center={mapCenter}
        zoom={selectedPosition ? 8.5 : DEFAULT_ZOOM}
        className="h-full w-full z-0"
        zoomControl={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        boxZoom={true}
        keyboard={true}
      >
        <MapInstanceCapture onReady={setMapInstance} />
        <InteractionCapture onInteract={handleUserInteraction} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
          maxZoom={19}
          opacity={0.65}
        />

        {completedRoute.length > 1 && (
          <Polyline
            positions={completedRoute}
            pathOptions={{
              color: "#1e40af",
              weight: 5,
              opacity: 0.8,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {remainingRoute.length > 1 && (
          <Polyline
            positions={remainingRoute}
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

        {routeStations.map((station) => {
          // Calculate distance and expected arrival if train is live
          let distanceKm: number | null = null;
          let expectedArrival: ReturnType<typeof calculateExpectedArrival> =
            null;

          if (selectedLiveTrain?.livePosition) {
            distanceKm = calculateDistance(
              selectedLiveTrain.livePosition.lat,
              selectedLiveTrain.livePosition.lon,
              station.lat,
              station.lon
            );

            expectedArrival = calculateExpectedArrival(
              distanceKm,
              selectedLiveTrain.livePosition.speed
            );
          }

          return (
            <Marker
              key={`station-${station.id}`}
              position={[station.lat, station.lon]}
              icon={getStationIcon()}
            >
              <Popup
                closeButton={false}
                className="station-popup"
                maxWidth={240}
              >
                <div className="text-xs p-1 space-y-2">
                  <div>
                    <div className="font-semibold text-neutral-900">
                      {station.name}
                    </div>
                    <div className="text-neutral-500 text-[10px] uppercase tracking-wide">
                      Station
                    </div>
                  </div>

                  {selectedLiveTrain?.livePosition && distanceKm !== null && (
                    <div className="pt-2 border-t border-neutral-200 space-y-1">
                      <div className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wide">
                        From Current Position
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Distance:</span>
                        <span className="font-semibold text-emerald-700">
                          {formatDistance(distanceKm)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Current Speed:</span>
                        <span className="font-semibold">
                          {formatSpeed(selectedLiveTrain.livePosition.speed)}
                        </span>
                      </div>
                      {expectedArrival && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-500">
                              Est. Arrival:
                            </span>
                            <span className="font-semibold text-emerald-600">
                              {expectedArrival.timeString}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-500">In About:</span>
                            <span className="font-semibold text-emerald-600">
                              {expectedArrival.durationLabel}
                            </span>
                          </div>
                        </>
                      )}
                      {!expectedArrival &&
                        selectedLiveTrain.livePosition.speed &&
                        selectedLiveTrain.livePosition.speed < 5 && (
                          <div className="text-[10px] text-amber-600 italic">
                            Train moving too slow for estimate
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {displayedTrains.map((train: TrainWithRoute) => {
          const live = train.livePosition!;
          const isSelected = selectedLiveTrain?.TrainId === train.TrainId;
          const iconKey = `${train.TrainId}-${
            isSelected ? "selected" : train.IsUp ? "up" : "down"
          }`;
          const icon = getIcon(
            iconKey,
            isSelected
              ? "rgba(16,185,129,0.95)"
              : train.IsUp
              ? "rgba(14,165,233,0.9)"
              : "rgba(249,115,22,0.9)",
            isSelected ? "#10b981" : "#ffffff"
          );

          return (
            <Marker
              key={train.TrainId}
              position={[live.lat, live.lon]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup closeButton={false} className="train-popup" maxWidth={220}>
                <div className="space-y-1.5 p-1">
                  <div>
                    <div className="font-semibold text-neutral-900 text-sm leading-tight">
                      {train.TrainName}
                    </div>
                    {train.TrainDescription && (
                      <div className="text-xs text-neutral-600 leading-tight">
                        {train.TrainDescription}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 text-xs text-neutral-700">
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Next stop:</span>
                      <span className="font-medium text-right">
                        {train.upcomingStop?.StationName ??
                          live.nextStopName ??
                          "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Speed:</span>
                      <span className="font-medium">
                        {formatSpeed(live.speed)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Delay:</span>
                      <span className="font-medium">
                        {formatLateBy(live.lateBy)}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-200">
                      Updated {formatRelativeTime(live.lastUpdated)}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {mapInstance && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-3 md:p-4 gap-2 sm:gap-3">
          <div className="pointer-events-auto ml-auto flex flex-wrap gap-1.5 sm:gap-2 justify-end">
            <button
              type="button"
              onClick={handleCenterSelected}
              disabled={!selectedLiveTrain?.livePosition}
              className={`border px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold shadow-lg transition-all duration-200 ${
                selectedLiveTrain?.livePosition
                  ? "border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                  : "border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed"
              }`}
            >
              <span className="hidden sm:inline">
                <svg className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Center Train
              </span>
              <span className="sm:hidden">
                <svg className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            </button>
            {routePoints.length > 0 && (
              <button
                type="button"
                onClick={handleFitRoute}
                className="border border-blue-300 bg-gradient-to-r from-blue-500 to-blue-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white shadow-lg hover:from-blue-600 hover:to-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
              >
                <span className="hidden sm:inline">
                  <svg className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Fit Route
                </span>
                <span className="sm:hidden">
                  <svg className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="border border-neutral-300 bg-white/98 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-neutral-700 shadow-lg hover:bg-neutral-50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
            >
              <span className="hidden sm:inline">↺ Reset View</span>
              <span className="sm:hidden">↺</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
