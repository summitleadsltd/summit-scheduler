export type NavigationApp = 'google' | 'apple' | 'waze';

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
