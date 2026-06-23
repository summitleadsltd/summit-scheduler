export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isFirefox(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox|FxiOS/.test(navigator.userAgent);
}

export function isFirefoxOnIOS(): boolean {
  return isIOS() && isFirefox();
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

export function isDesktop(): boolean {
  return !isIOS() && !isAndroid();
}

export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function canInstallPWA(): boolean {
  return !isPWAInstalled() && !isIOS();
}
