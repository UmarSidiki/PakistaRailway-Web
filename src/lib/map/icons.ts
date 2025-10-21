import L from 'leaflet';

/**
 * Icon cache to prevent recreating the same icons repeatedly
 */
const iconCache = new Map<string, L.DivIcon>();

/**
 * Configuration for train marker icons
 */
export interface TrainIconConfig {
  color: string;
  border: string;
  size?: number;
  borderWidth?: number;
}

/**
 * Creates or retrieves a cached train marker icon
 */
export const getTrainIcon = (key: string, config: TrainIconConfig): L.DivIcon => {
  if (iconCache.has(key)) {
    return iconCache.get(key)!;
  }

  const { color, border, size = 16, borderWidth = 2 } = config;

  const icon = L.divIcon({
    className: 'train-marker',
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    popupAnchor: [0, -(size + 4) / 2],
    html: `<div style="width: ${size}px; height: ${size}px; border: ${borderWidth}px solid ${border}; background: ${color}; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.4); transform: rotate(45deg);"></div>`
  });

  iconCache.set(key, icon);
  return icon;
};

/**
 * Creates or retrieves a cached station marker icon
 */
export const getStationIcon = (): L.DivIcon => {
  const cached = iconCache.get('station-marker');
  if (cached) return cached;

  const icon = L.divIcon({
    className: 'station-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 4px solid #2563eb; background: #ffffff; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.6);"></div>`
  });

  iconCache.set('station-marker', icon);
  return icon;
};

/**
 * Gets train icon configuration based on state
 */
export const getTrainIconConfig = (
  isSelected: boolean,
  isUp: boolean
): TrainIconConfig => {
  if (isSelected) {
    return {
      color: 'rgba(16,185,129,0.95)',
      border: '#10b981'
    };
  }

  return {
    color: isUp ? 'rgba(14,165,233,0.9)' : 'rgba(249,115,22,0.9)',
    border: '#ffffff'
  };
};

/**
 * Clears the icon cache (useful for cleanup)
 */
export const clearIconCache = (): void => {
  iconCache.clear();
};
