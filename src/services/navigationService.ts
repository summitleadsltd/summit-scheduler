export type NavigationApp = 'google' | 'apple' | 'waze';

export interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  scheduledTime: Date;
  duration: number; // Service duration in minutes
}

export interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  distance: number; // in km
  driveTime: number; // in minutes
}

export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }

  if (/android/.test(userAgent)) {
    return 'android';
  }

  return 'desktop';
}

export function getNavigationUrl(address: string, app: NavigationApp = 'google'): string {
  const encodedAddress = encodeURIComponent(address);

  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    case 'apple':
      return `http://maps.apple.com/?daddr=${encodedAddress}`;
    case 'waze':
      return `https://waze.com/ul?ll=${encodedAddress}&navigate=yes`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  }
}

export function openNavigation(address: string, preferredApp?: NavigationApp): void {
  const platform = detectPlatform();
  let url: string;

  if (preferredApp) {
    url = getNavigationUrl(address, preferredApp);
  } else {
    // Auto-select based on platform
    switch (platform) {
      case 'ios':
        url = getNavigationUrl(address, 'apple');
        break;
      case 'android':
        url = getNavigationUrl(address, 'google');
        break;
      default:
        url = getNavigationUrl(address, 'google');
    }
  }

  window.open(url, '_blank');
}

export function formatAddress(address: {
  address_line?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}): string {
  const parts = [
    address.address_line,
    address.city,
    address.state,
    address.zip_code,
  ].filter(Boolean);

  return parts.join(', ');
}

// Calculate Haversine distance between two points in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

// Estimate drive time based on distance (assumes average 40 km/h in urban areas)
export function estimateDriveTime(distanceKm: number): number {
  const avgSpeedKmh = 40; // Average speed in urban areas
  return (distanceKm / avgSpeedKmh) * 60; // Convert to minutes
}

// Calculate total route distance and drive time
export function calculateRouteStats(points: RoutePoint[]): {
  totalDistance: number;
  totalDriveTime: number;
  totalServiceTime: number;
  segments: RouteSegment[];
} {
  if (points.length === 0) {
    return { totalDistance: 0, totalDriveTime: 0, totalServiceTime: 0, segments: [] };
  }

  let totalDistance = 0;
  let totalDriveTime = 0;
  let totalServiceTime = 0;
  const segments: RouteSegment[] = [];

  for (let i = 0; i < points.length; i++) {
    totalServiceTime += points[i].duration;

    if (i < points.length - 1) {
      const distance = calculateDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
      const driveTime = estimateDriveTime(distance);

      totalDistance += distance;
      totalDriveTime += driveTime;

      segments.push({
        from: points[i],
        to: points[i + 1],
        distance,
        driveTime,
      });
    }
  }

  return { totalDistance, totalDriveTime, totalServiceTime, segments };
}

// Optimize route using nearest neighbor algorithm with time window constraints
export function optimizeRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return points;

  // Sort by scheduled time first to respect time windows
  const sortedByTime = [...points].sort((a, b) =>
    a.scheduledTime.getTime() - b.scheduledTime.getTime()
  );

  // Group appointments into time windows (30-minute windows)
  const timeWindows: RoutePoint[][] = [];
  let currentWindow: RoutePoint[] = [sortedByTime[0]];
  const windowSize = 30 * 60 * 1000; // 30 minutes in ms

  for (let i = 1; i < sortedByTime.length; i++) {
    const prevTime = sortedByTime[i - 1].scheduledTime.getTime();
    const currTime = sortedByTime[i].scheduledTime.getTime();

    if (currTime - prevTime <= windowSize) {
      currentWindow.push(sortedByTime[i]);
    } else {
      timeWindows.push(currentWindow);
      currentWindow = [sortedByTime[i]];
    }
  }
  if (currentWindow.length > 0) {
    timeWindows.push(currentWindow);
  }

  // Optimize within each time window using nearest neighbor
  const optimized: RoutePoint[] = [];

  for (const window of timeWindows) {
    if (window.length === 1) {
      optimized.push(window[0]);
    } else {
      // Nearest neighbor algorithm
      const unvisited = [...window];
      let current = unvisited.shift()!;
      optimized.push(current);

      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const distance = calculateDistance(
            current.latitude,
            current.longitude,
            unvisited[i].latitude,
            unvisited[i].longitude
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        current = unvisited.splice(nearestIndex, 1)[0];
        optimized.push(current);
      }
    }
  }

  return optimized;
}
