/**
 * Holiday and Festival Service
 * Handles calculation and lookup of Taiwan National Holidays and important international festivals
 */

export interface HolidayInfo {
  name: string;
  isNational: boolean; // true: Red label, false: Purple/Orange label
  emoji: string;
}

// Lunar and flexible holidays database (2025 to 2030)
const FIXED_LUNAR_MAP: Record<string, { name: string; isNational: boolean; emoji: string }> = {
  // 2025
  "2025-01-28": { name: "除夕", isNational: true, emoji: "🧧" },
  "2025-01-29": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2025-01-30": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2025-01-31": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2025-02-01": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2025-02-02": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2025-05-31": { name: "端午節", isNational: true, emoji: "🛶" },
  "2025-10-06": { name: "中秋節", isNational: true, emoji: "🥮" },
  
  // 2026
  "2026-02-16": { name: "除夕", isNational: true, emoji: "🧧" },
  "2026-02-17": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2026-02-18": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2026-02-19": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2026-02-20": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2026-02-21": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2026-02-22": { name: "春節補假", isNational: true, emoji: "🧧" },
  "2026-04-03": { name: "兒童節彈性補假", isNational: true, emoji: "🧸" },
  "2026-04-06": { name: "清明節彈性補假", isNational: true, emoji: "🕯️" },
  "2026-06-19": { name: "端午節", isNational: true, emoji: "🛶" },
  "2026-09-25": { name: "中秋節", isNational: true, emoji: "🥮" },

  // 2027
  "2027-02-05": { name: "除夕", isNational: true, emoji: "🧧" },
  "2027-02-06": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2027-02-07": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2027-02-08": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2027-02-09": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2027-02-10": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2027-06-09": { name: "端午節", isNational: true, emoji: "🛶" },
  "2027-09-15": { name: "中秋節", isNational: true, emoji: "🥮" },

  // 2028
  "2028-01-25": { name: "除夕", isNational: true, emoji: "🧧" },
  "2028-01-26": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2028-01-27": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2028-01-28": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2028-01-29": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2028-01-30": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2028-05-28": { name: "端午節", isNational: true, emoji: "🛶" },
  "2028-10-03": { name: "中秋節", isNational: true, emoji: "🥮" },

  // 2029
  "2029-02-12": { name: "除夕", isNational: true, emoji: "🧧" },
  "2029-02-13": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2029-02-14": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2029-02-15": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2029-02-16": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2029-02-17": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2029-06-16": { name: "端午節", isNational: true, emoji: "🛶" },
  "2029-09-22": { name: "中秋節", isNational: true, emoji: "🥮" },

  // 2030
  "2030-02-02": { name: "除夕", isNational: true, emoji: "🧧" },
  "2030-02-03": { name: "春節初一", isNational: true, emoji: "🧧" },
  "2030-02-04": { name: "春節初二", isNational: true, emoji: "🧧" },
  "2030-02-05": { name: "春節初三", isNational: true, emoji: "🧧" },
  "2030-02-06": { name: "春節初四", isNational: true, emoji: "🧧" },
  "2030-02-07": { name: "春節初五", isNational: true, emoji: "🧧" },
  "2030-06-05": { name: "端午節", isNational: true, emoji: "🛶" },
  "2030-09-12": { name: "中秋節", isNational: true, emoji: "🥮" },
};

/**
 * Get Mother's Day for a specific year (Second Sunday of May)
 */
export function getMothersDayStr(year: number): string {
  const firstOfMay = new Date(year, 4, 1);
  const dayOfWeek = firstOfMay.getDay(); // 0 is Sunday
  let firstSunday = 1;
  if (dayOfWeek !== 0) {
    firstSunday = 1 + (7 - dayOfWeek);
  }
  const secondSunday = firstSunday + 7;
  return `${year}-05-${String(secondSunday).padStart(2, "0")}`;
}

/**
 * Query holiday and festival information for a specific ISO date string (YYYY-MM-DD)
 */
export function getHolidayForDate(dateStr: string): HolidayInfo | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  // 1. Check pre-calculated Lunar / Flexible Holiday database
  if (FIXED_LUNAR_MAP[dateStr]) {
    return {
      name: FIXED_LUNAR_MAP[dateStr].name,
      isNational: FIXED_LUNAR_MAP[dateStr].isNational,
      emoji: FIXED_LUNAR_MAP[dateStr].emoji,
    };
  }

  // 2. Dynamic Mother's Day Match
  const mothersDayStr = getMothersDayStr(year);
  if (dateStr === mothersDayStr) {
    return {
      name: "母親節",
      isNational: false,
      emoji: "👩"
    };
  }

  // 3. Match Static Gregorian Holidays (National Holiday/國定假日 first)
  const monthDayStr = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  switch (monthDayStr) {
    case "01-01":
      return { name: "元旦", isNational: true, emoji: "🎉" };
    case "02-28":
      return { name: "和平紀念日", isNational: true, emoji: "🕊️" };
    case "04-04":
      return { name: "兒童節", isNational: true, emoji: "👶" };
    case "04-05":
      return { name: "清明節", isNational: true, emoji: "🕯️" };
    case "05-01":
      return { name: "勞動節", isNational: true, emoji: "🛠️" };
    case "10-10":
      return { name: "國慶日", isNational: true, emoji: "🇹🇼" };
    
    // Important Festivals (Non-National)
    case "02-14":
      return { name: "情人節", isNational: false, emoji: "💕" };
    case "08-08":
      return { name: "父親節", isNational: false, emoji: "👨" };
    case "10-31":
      return { name: "萬聖節", isNational: false, emoji: "🎃" };
    case "12-25":
      return { name: "聖誕節", isNational: false, emoji: "🎄" };
    default:
      return null;
  }
}
