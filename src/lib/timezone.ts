import { format as fnsFormat, formatDistanceToNow as fnsFormatDistanceToNow } from 'date-fns';

// No timezone conversion - use fixed business slots
// Times display exactly as entered regardless of device timezone

const SYSTEM_TZ = 'America/New_York'; // Kept for Google Calendar compatibility

export function toEST(date: Date | string): Date {
  // No conversion - return date as-is
  return typeof date === 'string' ? new Date(date) : date;
}

export function formatEST(date: Date | string, formatStr: string): string {
  // No conversion - format date as-is
  const d = typeof date === 'string' ? new Date(date) : date;
  return fnsFormat(d, formatStr);
}

export function formatDistanceEST(date: Date | string, options?: { addSuffix?: boolean }): string {
  // No conversion - calculate distance as-is
  const d = typeof date === 'string' ? new Date(date) : date;
  return fnsFormatDistanceToNow(d, options);
}

export function nowEST(): Date {
  // No conversion - return current time as-is
  return new Date();
}

export function todayStartEST(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export function todayEndEST(): string {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

export function getESTTimezoneLabel(): string {
  // Fixed business hours - no timezone label needed
  return 'EST';
}

export { SYSTEM_TZ };
