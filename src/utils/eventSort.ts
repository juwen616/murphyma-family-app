import { CalendarEvent } from "../types";

/**
 * Helper to parse "HH:MM" start time to total minutes from 00:00.
 * Handles "HH:MM~HH:MM", "HH:MM-HH:MM", or just "HH:MM".
 * Returns null if no valid time is present.
 */
export function getStartTimeMins(timeStr: string | undefined): number | null {
  if (!timeStr || !timeStr.trim() || timeStr === "~" || timeStr.includes("全天")) {
    return null;
  }
  const parts = timeStr.split(/[~-]/);
  if (parts.length >= 1) {
    const startPart = parts[0].trim();
    const match = startPart.match(/^([0-9]{1,2}):([0-9]{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      return h * 60 + m;
    }
  }
  return null;
}

/**
 * Sorts calendar events chronologically for the same day based on:
 * 1. Start time (asc) - chronological format
 * 2. If start times are equal, sort by createdAt (asc)
 * 3. Events without a set time (e.g., all-day or missing time) go to the very bottom (sorted by createdAt)
 */
export function sortEventsForSingleDay(a: CalendarEvent, b: CalendarEvent): number {
  const minsA = getStartTimeMins(a.time);
  const minsB = getStartTimeMins(b.time);

  if (minsA !== null && minsB !== null) {
    if (minsA !== minsB) {
      return minsA - minsB;
    }
  } else if (minsA !== null && minsB === null) {
    return -1; // timed comes before untimed
  } else if (minsA === null && minsB !== null) {
    return 1;  // untimed comes after timed
  }

  // Fallback to createdAt if times are the same or both untimed
  const getCreatedTime = (e: CalendarEvent): number => {
    if (!e.createdAt) return 0;
    if (typeof e.createdAt.toMillis === "function") return e.createdAt.toMillis();
    if (e.createdAt.seconds !== undefined) return e.createdAt.seconds * 1000 + (e.createdAt.nanoseconds || 0) / 1000000;
    if (e.createdAt instanceof Date) return e.createdAt.getTime();
    if (typeof e.createdAt === "number") return e.createdAt;
    const d = new Date(e.createdAt);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const createdA = getCreatedTime(a);
  const createdB = getCreatedTime(b);
  if (createdA !== createdB) {
    return createdA - createdB;
  }

  return a.id.localeCompare(b.id);
}
