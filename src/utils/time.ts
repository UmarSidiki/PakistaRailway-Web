const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatRelativeTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) {
    return 'No updates';
  }

  const now = Date.now();
  const diffMs = timestamp - now;
  const diffMinutes = Math.round(diffMs / 60000);

  if (Math.abs(diffMinutes) < 1) {
    return 'Just now';
  }

  return RELATIVE_TIME_FORMATTER.format(diffMinutes, 'minute');
};

export const formatDuration = (totalMinutes: number | null | undefined): string => {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) {
    return '—';
  }

  const absoluteMinutes = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (parts.length === 0) {
    parts.push('Under 1 min');
  }

  return parts.join(' ');
};

export const formatLateBy = (lateBy: number | null | undefined): string => {
  if (lateBy == null || Number.isNaN(lateBy)) {
    return 'On time';
  }

  if (lateBy === 0) {
    return 'On time';
  }

  const descriptor = lateBy > 0 ? 'late' : 'early';
  return `${formatDuration(lateBy)} ${descriptor}`.trim();
};

export const formatTime = (time: string | null | undefined): string => {
  if (!time) {
    return '—';
  }

  // Parse the time (expected format: "HH:MM" or "HH:MM:SS")
  const timeParts = time.split(':');
  if (timeParts.length < 2) {
    return time.slice(0, 5);
  }

  const hours = parseInt(timeParts[0], 10);
  const minutes = timeParts[1];

  if (isNaN(hours)) {
    return time.slice(0, 5);
  }

  // Convert to 12-hour format
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12, keep 1-11 as is, convert 13-23 to 1-11

  return `${hours12}:${minutes} ${period}`;
};

export const formatSpeed = (speed: number | null | undefined): string => {
  if (!speed || Number.isNaN(speed)) {
    return '—';
  }

  return `${Math.round(speed)} km/h`;
};

export const formatDistance = (distanceKm: number | null | undefined): string => {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return '—';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Calculate expected arrival time based on distance and current speed
 */
export const calculateExpectedArrival = (
  distanceKm: number,
  currentSpeed: number | null
): { minutes: number; timeString: string; durationLabel: string } | null => {
  if (!currentSpeed || currentSpeed < 5 || Number.isNaN(distanceKm) || distanceKm < 0) {
    return null;
  }

  // Time = Distance / Speed (in hours), then convert to minutes
  const hoursToArrival = distanceKm / currentSpeed;
  const minutesToArrival = Math.round(hoursToArrival * 60);

  const now = new Date();
  const arrivalTime = new Date(now.getTime() + minutesToArrival * 60000);
  
  const hours = arrivalTime.getHours();
  const minutes = arrivalTime.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;

  return {
    minutes: minutesToArrival,
    timeString: `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`,
    durationLabel: formatDuration(minutesToArrival)
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};
