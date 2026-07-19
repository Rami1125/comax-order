import { useMemo } from "react";
import { etaConfig } from "./etaConfig";

/**
 * Resolves an origin name, warehouse name, or address to a canonical originId
 */
export function resolveOriginId(origin: string): string {
  if (!origin) return "hacharash";
  const oClean = origin.trim();
  
  if (oClean.includes("החרש") || oClean.includes("חרש") || oClean.includes("מרכז") || oClean.includes("hacharash")) {
    return "hacharash";
  }
  if (oClean.includes("התלמיד") || oClean.includes("תלמיד") || oClean.includes("צפון") || oClean.includes("hatalmid")) {
    return "hatalmid";
  }
  
  // Default fallback if no specific address matched
  return "hacharash";
}

/**
 * Checks if a given timestamp falls during rush hours
 * Morning rush hour: 07:30 - 09:30
 * Evening rush hour: 16:00 - 18:30
 */
export function isRushHour(dateStr?: string | Date): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const decimalTime = hours + minutes / 60;
    
    // Morning rush hour: 07:30 - 09:30 (7.5 to 9.5)
    const isMorningRush = decimalTime >= 7.5 && decimalTime <= 9.5;
    // Evening rush hour: 16:00 - 18:30 (16.0 to 18.5)
    const isEveningRush = decimalTime >= 16.0 && decimalTime <= 18.5;
    
    return isMorningRush || isEveningRush;
  } catch {
    return false;
  }
}

/**
 * Custom React Hook/logic function to calculate estimated arrival time (ETA).
 * It accepts origin, destinationCity, and an optional timestamp.
 * Returns the estimated travel time in minutes and some state metadata.
 */
export function useETA(origin: string, destinationCity: string | undefined, timestamp?: string) {
  return useMemo(() => {
    if (!destinationCity || destinationCity === "לא ידוע") {
      return { eta: null, isRush: false, isDefaultFallback: true };
    }
    
    const originId = resolveOriginId(origin);
    const key = `${originId}_${destinationCity.trim()}`;
    
    let baseTime = etaConfig.travelTimes[key];
    const isFound = baseTime !== undefined;
    
    if (!isFound) {
      baseTime = etaConfig.defaultTravelTime;
    }
    
    const isRush = isRushHour(timestamp);
    let finalTime = baseTime;
    
    if (isRush) {
      // Add 10% statistical deviation for rush hour
      finalTime = Math.round(baseTime * 1.1);
    }
    
    return {
      eta: finalTime,
      isRush,
      isDefaultFallback: !isFound
    };
  }, [origin, destinationCity, timestamp]);
}
