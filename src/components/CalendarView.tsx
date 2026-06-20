import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarEvent,
  UserProfile,
  UserRole,
  CommonTemplate,
  ConfiguredMode,
  getLocalToday,
  SystemMode,
} from "../types";
import { getHolidayForDate } from "../utils/holidayService";
import { sortEventsForSingleDay } from "../utils/eventSort";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  CalendarDays,
  Clock as ClockIcon,
  HelpCircle,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Info
} from "lucide-react";

const isMom = (displayName?: string) => {
  if (!displayName) return false;
  const nameLower = displayName.toLowerCase();
  return nameLower.includes("媽媽") || nameLower.includes("mama") || nameLower.includes("mom") || nameLower.includes("mami") || nameLower.includes("mother") || nameLower === "媽媽" || nameLower === "mom";
};

interface CalendarViewProps {
  currentUser: UserProfile;
  events: CalendarEvent[];
  favoriteActivities: CommonTemplate[];
  familyMembers?: UserProfile[];
  deepLink?: { eventId: string; date: string } | null;
  onClearDeepLink?: () => void;
  onAddEvent: (eventData: Omit<CalendarEvent, "id" | "creatorUid" | "creatorName" | "createdAt">) => Promise<any>;
  onEditEvent: (id: string, eventData: Partial<CalendarEvent>, updateFuture?: boolean) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onAddFavorite?: (activityData: Omit<CommonTemplate, "id" | "creatorUid" | "createdAt"> & { startDate?: string }) => Promise<void>;
  configuredModes?: ConfiguredMode[];
  simulatedTodayDate?: string;
  onSaveConfiguredMode?: (mode: ConfiguredMode) => Promise<void>;
  onChangePage?: (page: "home" | "calendar" | "tasks" | "rewards" | "favorites" | "special-periods" | "members") => void;
}

const getEventEmoji = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes("畫畫") || t.includes("美術") || t.includes("繪畫")) return "🎨";
  if (t.includes("游泳") || t.includes("泳")) return "🏊";
  if (t.includes("牙醫") || t.includes("牙") || t.includes("看牙")) return "🦷";
  if (t.includes("鋼琴") || t.includes("音樂") || t.includes("琴") || t.includes("吉他")) return "🎹";
  if (t.includes("聚餐") || t.includes("吃飯") || t.includes("晚餐") || t.includes("宵夜")) return "🍱";
  if (t.includes("露營") || t.includes("帳") || t.includes("營")) return "⛺";
  if (t.includes("眼科") || t.includes("配鏡") || t.includes("眼鏡") || t.includes("看眼")) return "👁️";
  if (t.includes("診") || t.includes("醫生") || t.includes("醫院") || t.includes("感冒")) return "🏥";
  if (t.includes("課") || t.includes("補習") || t.includes("英文") || t.includes("數學")) return "📚";
  if (t.includes("整理") || t.includes("打掃") || t.includes("吸塵") || t.includes("扔垃圾")) return "🧹";
  return "🌷";
};

const isMultiDayEvent = (evt: CalendarEvent): boolean => {
  return !evt.isFixed && !!evt.startDate && !!evt.endDate && evt.startDate !== evt.endDate;
};

const isTravelEvent = (title: string): boolean => {
  const t = (title || "").toLowerCase();
  return t.includes("旅行") || t.includes("旅遊") || t.includes("出國") || t.includes("行程") || t.includes("travel");
};

const getMultiDayLabel = (startDateStr: string, endDateStr: string, currentDateStr: string): { dayIndex: number; totalDays: number } => {
  try {
    const parseDateStr = (str: string) => {
      const parts = str.split("-");
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };
    const s = parseDateStr(startDateStr);
    const e = parseDateStr(endDateStr);
    const c = parseDateStr(currentDateStr);
    
    const diffStart = Math.round((c.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const diffTotal = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return {
      dayIndex: diffStart,
      totalDays: diffTotal
    };
  } catch (err) {
    return { dayIndex: 1, totalDays: 1 };
  }
};

const getEventTitleWithPrefix = (evt: CalendarEvent, isBday: boolean, currentDateStr?: string) => {
  if (isBday) {
    const showAge = (evt as any).showAgeInCalendar !== false && (evt as any).showAge !== false;
    return showAge ? `🎂 ${(evt as any).birthdayMemberName}（${(evt as any).birthdayAge}歲）` : `🎂 ${(evt as any).birthdayMemberName}生日`;
  }
  
  if (isTravelEvent(evt.title)) {
    if (isMultiDayEvent(evt) && currentDateStr && evt.startDate && evt.endDate) {
      const info = getMultiDayLabel(evt.startDate, evt.endDate, currentDateStr);
      return `${evt.title} Day${info.dayIndex}`;
    }
    return evt.title;
  }
  
  const emoji = getEventEmoji(evt.title);
  if (isMultiDayEvent(evt) && currentDateStr && evt.startDate && evt.endDate) {
    const info = getMultiDayLabel(evt.startDate, evt.endDate, currentDateStr);
    return `${emoji} ${evt.title} Day${info.dayIndex}`;
  }
  return `${emoji} ${evt.title}`;
};

const getEventColorByTitleForStyle = (title: string): { bg: string; border: string; text: string; hover: string; fullClass: string } => {
  if (!title) {
    return {
      bg: "bg-[#F7F5F0]",
      border: "border-[#E7E2D8]",
      text: "text-[#3C332D]",
      hover: "hover:bg-[#F2ECE0]",
      fullClass: "bg-[#F7F5F0] border-[#E7E2D8] text-[#3C332D] hover:bg-[#F2ECE0]"
    };
  }
  
  const cleanTitle = title.trim();
  let hash = 0;
  for (let i = 0; i < cleanTitle.length; i++) {
    hash = cleanTitle.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    // 1. 溫柔粉紅
    { bg: "bg-[#FFF2F4]", border: "border-[#F2CBD2]", text: "text-[#A22E42]", hover: "hover:bg-[#FFE5E9]" },
    // 2. 舒爽晨藍
    { bg: "bg-[#F1F6FA]", border: "border-[#CBD9E5]", text: "text-[#245D8C]", hover: "hover:bg-[#E2EDF4]" },
    // 3. 柔美霧綠
    { bg: "bg-[#F2FBF4]", border: "border-[#C1DEC5]", text: "text-[#2D7336]", hover: "hover:bg-[#E3F6E7]" },
    // 4. 暖心暖橘
    { bg: "bg-[#FFF6F1]", border: "border-[#F2CFBD]", text: "text-[#AE5B28]", hover: "hover:bg-[#FFE9DC]" },
    // 5. 琥珀蜜黃
    { bg: "bg-[#FFF9F1]", border: "border-[#ECD1AE]", text: "text-[#935F1D]", hover: "hover:bg-[#FFEECD]" },
    // 6. 雅緻薰紫
    { bg: "bg-[#FAF3FC]", border: "border-[#DFCEE5]", text: "text-[#713D8B]", hover: "hover:bg-[#F3E2F7]" },
    // 7. 恬靜奶茶
    { bg: "bg-[#FAF6F3]", border: "border-[#DACBBF]", text: "text-[#794E2E]", hover: "hover:bg-[#F4EBE3]" },
    // 8. 溫和草綠
    { bg: "bg-[#F7FBF2]", border: "border-[#CADFB5]", text: "text-[#477329]", hover: "hover:bg-[#ECF6E1]" },
    // 9. 優雅灰藍
    { bg: "bg-[#F4F7FB]", border: "border-[#C1CCDB]", text: "text-[#344865]", hover: "hover:bg-[#E7EDF5]" },
    // 10. 迷迭香綠
    { bg: "bg-[#F4FAF7]", border: "border-[#CCDDD7]", text: "text-[#286050]", hover: "hover:bg-[#E5F3EE]" }
  ];
  
  const index = Math.abs(hash) % colors.length;
  const c = colors[index];
  return {
    bg: c.bg,
    border: c.border,
    text: c.text,
    hover: c.hover,
    fullClass: `${c.bg} ${c.border} ${c.text} ${c.hover}`
  };
};

const getAppletEventStyleClasses = (evt: CalendarEvent, isBday: boolean, dateStr?: string, viewType?: "month" | "week"): string => {
  if (isBday) {
    return "border border-rose-200/90 bg-rose-50 hover:bg-rose-100/80 text-rose-700 font-extrabold shadow-sm rounded-xl";
  }
  
  if (isMultiDayEvent(evt)) {
    let rounding = "rounded-xl";
    let borders = "border-2 border-sky-300";
    let margins = "";
    
    if (dateStr && evt.startDate && evt.endDate) {
      const offset = viewType === "week" ? "17px" : "11px";
      if (dateStr === evt.startDate) {
        rounding = "rounded-l-xl rounded-r-none";
        borders = "border-2 border-r-0 border-sky-300";
        margins = ` mr-[-${offset}] pr-[${offset}]`;
      } else if (dateStr === evt.endDate) {
        rounding = "rounded-r-xl rounded-l-none";
        borders = "border-2 border-l-0 border-sky-300";
        margins = ` ml-[-${offset}] pl-[${offset}]`;
      } else if (dateStr > evt.startDate && dateStr < evt.endDate) {
        rounding = "rounded-none";
        borders = "border-y-2 border-x-0 border-sky-300";
        margins = ` mx-[-${offset}] px-[${offset}]`;
      }
    }
    return `${borders} bg-[#F0F8FF] text-[#004B8F] hover:bg-[#E1F0FF] shadow-sm ring-1 ring-sky-100/50 ${rounding}${margins} relative z-[5]`;
  }
  
  const colorObj = getEventColorByTitleForStyle(evt.title || "");
  return `border ${colorObj.fullClass} shadow-sm rounded-xl`;
};

export default function CalendarView({
  currentUser,
  events,
  favoriteActivities,
  familyMembers,
  deepLink,
  onClearDeepLink,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onAddFavorite,
  configuredModes,
  simulatedTodayDate,
  onSaveConfiguredMode,
  onChangePage,
}: CalendarViewProps) {
  const todayDateStr = simulatedTodayDate || getLocalToday();

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (simulatedTodayDate) {
      const p = simulatedTodayDate.split("-");
      if (p.length === 3) {
        return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      }
    }
    return new Date();
  });

  // Keep calendar focus synced with simulatedTodayDate
  useEffect(() => {
    if (simulatedTodayDate) {
      const p = simulatedTodayDate.split("-");
      if (p.length === 3) {
        setCurrentDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
      }
    }
  }, [simulatedTodayDate]);

  const [viewType, setViewType] = useState<"list" | "month" | "week">("month");
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(todayDateStr);

  const handleSetViewType = (newType: "list" | "month" | "week") => {
    setViewType(newType);
    if (selectedMobileDate) {
      const p = selectedMobileDate.split("-");
      if (p.length === 3) {
        setCurrentDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
      }
    }
  };
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const diff = touchStart - touchEnd;
    const minSwipeDistance = 70; // pixels
    if (diff > minSwipeDistance) {
      handleNext();
    } else if (diff < -minSwipeDistance) {
      handlePrev();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const formatMobileDrawerDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const monthFormatted = String(m).padStart(2, "0");
    const dayFormatted = String(d).padStart(2, "0");
    return `${monthFormatted}/${dayFormatted} ${days[dateObj.getDay()]}`;
  };

  const formatListDayHeader = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m - 1, d);
      const dayFormatted = String(d).padStart(2, "0");
      const monthFormatted = String(m).padStart(2, "0");
      const dow = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][dateObj.getDay()];
      return `${monthFormatted}/${dayFormatted} ${dow}`;
    } catch (_) {
      return dateStr;
    }
  };

  const cleanTitleForMobileCell = (evt: CalendarEvent, currentDateStr?: string) => {
    let title = evt.title;
    if ((evt as any).isBirthday) {
      return `${(evt as any).birthdayMemberName} 生日`;
    }
    if (isMultiDayEvent(evt) && currentDateStr && evt.startDate && evt.endDate) {
      const info = getMultiDayLabel(evt.startDate, evt.endDate, currentDateStr);
      title = `${evt.title} Day${info.dayIndex}`;
    }
    return title.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();
  };

  const selectedMobileMonthDayStr = useMemo(() => {
    if (!selectedMobileDate) return "";
    const parts = selectedMobileDate.split("-");
    if (parts.length === 3) {
      return `${parseInt(parts[1], 10)}月 ${parseInt(parts[2], 10)}日`;
    }
    return selectedMobileDate;
  }, [selectedMobileDate]);

  const getEventsForDate = (dateStr: string) => {
    const filtered = allEvents.filter((e) => {
      if (e.isFixed) {
        if (e.exceptionDates?.includes(dateStr)) return false;
        if (e.startDate && dateStr < e.startDate) return false;
        if (e.endDate && dateStr > e.endDate) return false;
        const [y, m, d] = dateStr.split("-").map(Number);
        
        // Check repeat Type
        if ((e as any).repeatType === "monthly") {
          const startDayNum = e.startDate ? Number(e.startDate.split("-")[2]) : (e.date ? Number(e.date.split("-")[2]) : 1);
          return d === startDayNum;
        } else {
          const dow = new Date(y, m - 1, d).getDay();
          return e.weekdays?.includes(dow);
        }
      }
      if (e.startDate && e.endDate) {
        return dateStr >= e.startDate && dateStr <= e.endDate;
      }
      return e.date === dateStr;
    });
    return filtered.sort(sortEventsForSingleDay);
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [birthdayAlert, setBirthdayAlert] = useState<{ memberName: string, title: string } | null>(null);

  // Special Period Prompt & Conversion states
  const [promptSpecialPeriod, setPromptSpecialPeriod] = useState(false);
  const [pendingAddPayload, setPendingAddPayload] = useState<any>(null);
  const [chosenSpecialType, setChosenSpecialType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ show: boolean; title: string; specialCreated?: boolean; isDeleted?: boolean } | null>(null);

  // Custom interactive mode details direct popup
  const [selectedModeForDetail, setSelectedModeForDetail] = useState<{ mode: ConfiguredMode; dateStr: string } | null>(null);

  // Local state for inline high-speed travel editor
  const [editingItinerary, setEditingItinerary] = useState<{
    breakfast: string;
    morning: string;
    lunch: string;
    afternoon: string;
    dinner: string;
    night: string;
    lodging: string;
    customNotes: string;
    airline: string;
    flightNumber: string;
    departureTime: string;
    returnTime: string;
    departureTerminal: string;
    todayTheme: string;
    todayRemarks: string;
  } | null>(null);
  const [isSavingTravel, setIsSavingTravel] = useState(false);

  // User selected date to add / select event type
  const [showAddTypeSelection, setShowAddTypeSelection] = useState<{ show: boolean; dateStr: string } | null>(null);

  // Custom travel schedule creator direct popup
  const [showCreateTravelModal, setShowCreateTravelModal] = useState<{ startDate: string; endDate: string } | null>(null);
  const [newTravelName, setNewTravelName] = useState("");
  const [newTravelStartDate, setNewTravelStartDate] = useState("");
  const [newTravelEndDate, setNewTravelEndDate] = useState("");
  const [newTravelType, setNewTravelType] = useState<"international" | "domestic">("international");

  useEffect(() => {
    if (selectedModeForDetail && selectedModeForDetail.mode.type === "travel") {
      const { mode, dateStr } = selectedModeForDetail;
      const dayPlan = mode.itinerary?.[dateStr] || {};
      setEditingItinerary({
        breakfast: dayPlan.breakfast || "",
        morning: dayPlan.morning || "",
        lunch: dayPlan.lunch || "",
        afternoon: dayPlan.afternoon || "",
        dinner: dayPlan.dinner || "",
        night: dayPlan.night || "",
        lodging: dayPlan.lodging || "",
        customNotes: dayPlan.customNotes || "",
        airline: mode.airline || "",
        flightNumber: mode.flightNumber || "",
        departureTime: mode.departureTime || "",
        returnTime: mode.returnTime || "",
        departureTerminal: mode.departureTerminal || "",
        todayTheme: dayPlan.todayTheme || "",
        todayRemarks: dayPlan.todayRemarks || "",
      });
    } else {
      setEditingItinerary(null);
    }
  }, [selectedModeForDetail]);

  const handleSaveTravelItinerary = async () => {
    if (!selectedModeForDetail || !editingItinerary || !onSaveConfiguredMode) return;
    setIsSavingTravel(true);
    try {
      const { mode, dateStr } = selectedModeForDetail;
      
      const currentItinerary = { ...(mode.itinerary || {}) };
      currentItinerary[dateStr] = {
        ...currentItinerary[dateStr],
        breakfast: editingItinerary.breakfast,
        morning: editingItinerary.morning,
        lunch: editingItinerary.lunch,
        afternoon: editingItinerary.afternoon,
        dinner: editingItinerary.dinner,
        night: editingItinerary.night,
        lodging: editingItinerary.lodging,
        customNotes: editingItinerary.customNotes,
        todayTheme: editingItinerary.todayTheme,
        todayRemarks: editingItinerary.todayRemarks,
      };

      const updatedMode: ConfiguredMode = {
        ...mode,
        itinerary: currentItinerary,
      };

      updatedMode.airline = editingItinerary.airline;
      updatedMode.flightNumber = editingItinerary.flightNumber;
      updatedMode.departureTime = editingItinerary.departureTime;
      updatedMode.returnTime = editingItinerary.returnTime;
      updatedMode.departureTerminal = editingItinerary.departureTerminal;

      await onSaveConfiguredMode(updatedMode);
      setSelectedModeForDetail(null);
    } catch (err) {
      console.error("Failed to save travel itinerary:", err);
    } finally {
      setIsSavingTravel(false);
    }
  };

  // Highest priority active mode finder helper
  const getActiveModeForDate = React.useCallback((dateStr: string) => {
    if (!configuredModes) return null;

    // 1. Travel Mode
    const travel = configuredModes.find(
      (m) => m.type === "travel" && m.startDate <= dateStr && dateStr <= m.endDate
    );
    if (travel) return travel;

    // 2. Exam Mode
    const exam = configuredModes.find(
      (m) => m.type === "exam" && m.startDate <= dateStr && dateStr <= m.endDate
    );
    if (exam) return exam;

    // 3. Vacation Mode
    const vacation = configuredModes.find(
      (m) => m.type === "vacation" && m.startDate <= dateStr && dateStr <= m.endDate
    );
    if (vacation) return vacation;

    // 4. Custom Mode
    const custom = configuredModes.find(
      (m) => m.type === "custom" && m.startDate <= dateStr && dateStr <= m.endDate
    );
    if (custom) return custom;

    return null;
  }, [configuredModes, familyMembers]);

  const allEvents = useMemo(() => {
    const list = [...events];
    if (!familyMembers) return list;

    familyMembers.forEach((member) => {
      if (!member.birthday) return;
      const birthdayClean = member.birthday.replace(/\//g, "-");
      const parts = birthdayClean.split("-");
      if (parts.length < 3) return;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);
      if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return;

      const currentViewYear = currentDate.getFullYear();
      // Generate events for prev, current, next year relative to calendar view date
      const yearsToGen = [currentViewYear - 1, currentViewYear, currentViewYear + 1];

      yearsToGen.forEach((genYear) => {
        const age = genYear - birthYear;
        const eventDateStr = `${genYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

        const showAge = member.showAgeInCalendar !== false && member.showAge !== false;
        list.push({
          id: `birthday-${member.uid || Math.random()}-${genYear}`,
          familyId: member.familyId || "",
          title: showAge ? `🎂 ${member.displayName}（${age}歲）` : `🎂 ${member.displayName}生日`,
          date: eventDateStr,
          time: "",
          isFixed: false,
          isPublic: true,
          note: `祝 ${member.displayName} 生日快樂！🎂🎉`,
          creatorUid: "system",
          creatorName: "系統",
          createdAt: new Date(),
          isBirthday: true,
          birthdayMemberUid: member.uid,
          birthdayAge: age,
          birthdayMemberName: member.displayName,
          showAgeInCalendar: showAge,
        } as any);
      });
    });

    return list;
  }, [events, familyMembers, currentDate]);

  // Form State
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [isFixed, setIsFixed] = useState(false);
  const [repeatType, setRepeatType] = useState<"weekly" | "monthly" | "custom_weekdays">("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedFavId, setSelectedFavId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const getWeekdayOfDate = (dateStr: string): number => {
    try {
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
      }
    } catch (_) {}
    return 1; // default Monday
  };

  // Modal / Confirm state
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [selectedDeleteDate, setSelectedDeleteDate] = useState<string>("");
  const [updatingFixedEventOptions, setUpdatingFixedEventOptions] = useState<{ event: CalendarEvent, payload: any, selectedDateForOccurrence: string } | null>(null);
  const [updatingRecurringEvent, setUpdatingRecurringEvent] = useState<{ id: string, payload: any } | null>(null);

  const [saveAsFav, setSaveAsFav] = useState(false);
  const [isCrossDay, setIsCrossDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [formDailyNotes, setFormDailyNotes] = useState<Record<string, string>>({});
  const [isDailyNotesExpanded, setIsDailyNotesExpanded] = useState(false);
  const [showFullTimeChoices, setShowFullTimeChoices] = useState(false);

  const getDatesInRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    try {
      const parseDateStr = (str: string) => {
        const parts = str.split("-");
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };
      const s = parseDateStr(start);
      const e = parseDateStr(end);
      let curr = new Date(s);
      while (curr <= e) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, "0");
        const day = String(curr.getDate()).padStart(2, "0");
        dates.push(`${year}-${month}-${day}`);
        curr.setDate(curr.getDate() + 1);
      }
    } catch (_) {}
    return dates;
  };

  // Range Picker specialized state variables
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [tempRangeStart, setTempRangeStart] = useState<string | null>(null);
  const [tempRangeEnd, setTempRangeEnd] = useState<string | null>(null);
  const [rangePickerYear, setRangePickerYear] = useState<number>(new Date().getFullYear());
  const [rangePickerMonth, setRangePickerMonth] = useState<number>(new Date().getMonth());



  // Deep linking logic from Home page
  useEffect(() => {
    if (deepLink) {
      const { eventId, date } = deepLink;
      if (date) {
        const parts = date.split("-");
        if (parts.length >= 2) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parts[2] ? parseInt(parts[2], 10) : 1;
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            setCurrentDate(new Date(y, m - 1, d));
          }
        }
      }

      // Check if the event exists in allEvents
      const foundEvent = allEvents.find((e) => e.id === eventId);
      if (foundEvent) {
        // Wait a small timeout to make sure states and components are initialized
        setTimeout(() => {
          handleOpenEdit(foundEvent, date);
        }, 50);
      }

      // Auto scroll to that date card or cell
      setTimeout(() => {
        const element = document.getElementById(`calendar-day-${date}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      // Call clear callback to prevent loop
      if (onClearDeepLink) {
        onClearDeepLink();
      }
    }
  }, [deepLink, allEvents, onClearDeepLink]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const TIME_CHOICES = useMemo(() => {
    const list = [];
    const startHour = showFullTimeChoices ? 0 : 7;
    for (let h = startHour; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      for (let m = 0; m < 60; m += 15) {
        const mm = String(m).padStart(2, "0");
        list.push(`${hh}:${mm}`);
      }
    }
    return list;
  }, [showFullTimeChoices]);

  const WEEKDAYS_LIST = [
    { label: "週日", value: 0 },
    { label: "週一", value: 1 },
    { label: "週二", value: 2 },
    { label: "週三", value: 3 },
    { label: "週四", value: 4 },
    { label: "週五", value: 5 },
    { label: "週六", value: 6 },
  ];

  const getWeekdaysString = (wds?: number[]) => {
    if (!wds || wds.length === 0) return "未指定";
    const labels = wds
      .map((w) => WEEKDAYS_LIST.find((item) => item.value === w)?.label || "")
      .filter(Boolean);
    return labels.join("、");
  };

  const toggleWeekday = (val: number) => {
    if (weekdays.includes(val)) {
      setWeekdays(weekdays.filter((w) => w !== val));
    } else {
      setWeekdays([...weekdays, val]);
    }
  };

  const handlePrev = () => {
    if (viewType === "month") {
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      setCurrentDate(prevMonth);
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewType === "month") {
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      setCurrentDate(nextMonth);
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDaysTotal = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month days padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevD = prevMonthDaysTotal - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const formattedDate = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(prevD).padStart(2, "0")}`;
      days.push({
        day: prevD,
        dateStr: formattedDate,
        isCurrentMonth: false,
        isWeekend: new Date(prevY, prevM, prevD).getDay() === 0 || new Date(prevY, prevM, prevD).getDay() === 6,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        day: d,
        dateStr: formattedDate,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    // Next month days padding
    const lastWeekRemaining = days.length % 7;
    const nextDaysNeeded = lastWeekRemaining === 0 ? 0 : 7 - lastWeekRemaining;
    for (let d = 1; d <= nextDaysNeeded; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const formattedDate = `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        dateStr: formattedDate,
        isCurrentMonth: false,
        isWeekend: new Date(nextY, nextM, d).getDay() === 0 || new Date(nextY, nextM, d).getDay() === 6,
      });
    }

    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = currentDate.getDay();
    startOfWeek.setDate(currentDate.getDate() - day);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const walkDate = new Date(startOfWeek);
      walkDate.setDate(startOfWeek.getDate() + i);

      const y = walkDate.getFullYear();
      const m = walkDate.getMonth();
      const d = walkDate.getDate();
      const formattedDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      days.push({
        day: d,
        dateStr: formattedDate,
        isToday: todayDateStr === formattedDate,
        isWeekend: i === 0 || i === 6,
        dayName: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][i],
      });
    }
    return days;
  }, [currentDate]);

  const handleSelectFavItem = (favId: string) => {
    setSelectedFavId(favId);
    if (!favId) return;
    const fav = favoriteActivities.find((f) => f.id === favId);
    if (fav) {
      setTitle(fav.title);
      setIsFixed(fav.isRecurring || false);
      setWeekdays(fav.repeatDays || []);
      if (fav.hasDefaultTime && fav.defaultStartTime) {
        setStartTime(fav.defaultStartTime);
        setEndTime(fav.defaultEndTime || "");
      } else {
        setStartTime("");
        setEndTime("");
      }
    }
  };

  const calcDurationDays = (start: string, end: string) => {
    try {
      if (!start || !end) return 0;
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
      const diffMs = e.getTime() - s.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  };

  const handleQuickConvertToSpecialPeriod = async () => {
    if (!onSaveConfiguredMode) return;
    
    // Choose mode type according to keyword
    let modeType = SystemMode.CUSTOM;
    let icon = "🏠";
    if (title.includes("旅") || title.includes("出遊")) {
      modeType = SystemMode.TRAVEL;
      icon = "✈️";
    } else if (title.includes("考") || title.includes("試")) {
      modeType = SystemMode.EXAM;
      icon = "📚";
    } else if (title.includes("寒假") || title.includes("暑假") || title.includes("放") || title.includes("假")) {
      modeType = SystemMode.VACATION;
      icon = "🏕️";
    }
    
    const newMode: ConfiguredMode = {
      id: "mode_" + Date.now(),
      type: modeType,
      name: title.trim(),
      icon: icon,
      color: modeType === SystemMode.TRAVEL ? "orange" : modeType === SystemMode.EXAM ? "yellow" : modeType === SystemMode.VACATION ? "green" : "indigo",
      startDate: selectedDate,
      endDate: isCrossDay ? endDate : selectedDate,
      createdAt: new Date(),
    };
    
    try {
      setIsSubmitting(true);
      await onSaveConfiguredMode(newMode);
      setShowAddForm(false);
      if (onChangePage) {
        onChangePage("special-periods");
      }
    } catch (err) {
      console.error("Quick convert to special period aborted:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAdd = (dateStr: string) => {
    setEditingEvent(null);
    setSelectedDate(dateStr);
    setTitle("");
    setStartTime("");
    setEndTime("");
    setLocation("");
    setIsFixed(false);
    setRepeatType("weekly");
    setWeekdays([]);
    setNote("");
    setIsPublic(true);
    setSelectedFavId("");
    setSaveAsFav(false);
    setIsCrossDay(false);
    setEndDate(dateStr);
    setFormDailyNotes({});
    setIsDailyNotesExpanded(false);
    setShowFullTimeChoices(false);

    // Range Picker initialization
    setTempRangeStart(dateStr);
    setTempRangeEnd(dateStr);
    setShowRangePicker(false);
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        setRangePickerYear(parseInt(parts[0], 10));
        setRangePickerMonth(parseInt(parts[1], 10) - 1);
      }
    } catch (_) {}

    setShowAddForm(true);
  };

  const handleOpenEdit = (evt: CalendarEvent, dateStr?: string) => {
    if ((evt as any).isBirthday) {
      setBirthdayAlert({
        memberName: (evt as any).birthdayMemberName,
        title: evt.title
      });
      return;
    }
    setEditingEvent(evt);
    const targetDate = dateStr || evt.date || "";
    setSelectedDate(targetDate);
    setTitle(evt.title);
    setLocation(evt.location || "");
    setIsFixed(evt.isFixed || false);
    setWeekdays(evt.weekdays || []);
    setNote(evt.note || "");
    setIsPublic(evt.isPublic !== false);
    setSelectedFavId("");
    
    // Initialize repeatType based on saved properties
    if (evt.isFixed) {
      if ((evt as any).repeatType === "monthly") {
        setRepeatType("monthly");
      } else if (evt.weekdays && evt.weekdays.length > 0) {
        const dStr = evt.startDate || evt.date || "";
        let isSingleWeeklyDow = false;
        try {
          if (dStr) {
            const [y, m, d] = dStr.split("-").map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            if (evt.weekdays.length === 1 && evt.weekdays[0] === dow) {
              isSingleWeeklyDow = true;
            }
          }
        } catch (_) {}

        if ((evt as any).repeatType === "weekly" || isSingleWeeklyDow) {
          setRepeatType("weekly");
        } else {
          setRepeatType("custom_weekdays");
        }
      } else {
        setRepeatType("weekly");
      }
    } else {
      setRepeatType("weekly");
    }

    let deservesFullChoices = false;
    if (evt.time && evt.time !== "~") {
      if (evt.time.includes("~")) {
        const [start, end] = evt.time.split("~");
        setStartTime(start || "");
        setEndTime(end || "");
        if ((start && start < "07:00") || (end && end < "07:00")) {
          deservesFullChoices = true;
        }
      } else {
        setStartTime(evt.time);
        setEndTime("");
        if (evt.time < "07:00") {
          deservesFullChoices = true;
        }
      }
    } else {
      setStartTime("");
      setEndTime("");
    }
    setShowFullTimeChoices(deservesFullChoices);
    
    const isCd = !!(evt.startDate && evt.endDate && evt.startDate !== evt.endDate && !evt.isFixed);
    setIsCrossDay(isCd);
    const targetEndDate = evt.endDate || dateStr || evt.date || "";
    setEndDate(targetEndDate);
    setFormDailyNotes(evt.dailyNotes || {});
    setIsDailyNotesExpanded(false);

    // Range Picker initialization
    setTempRangeStart(evt.startDate || targetDate);
    setTempRangeEnd(evt.endDate || targetEndDate);
    setShowRangePicker(false);
    try {
      const parts = (evt.startDate || targetDate).split("-");
      if (parts.length === 3) {
        setRangePickerYear(parseInt(parts[0], 10));
        setRangePickerMonth(parseInt(parts[1], 10) - 1);
      }
    } catch (_) {}

    setShowAddForm(true);
  };

  const getRangeFirstDayOfWeek = () => {
    return new Date(rangePickerYear, rangePickerMonth, 1).getDay();
  };

  const getRangeDaysInMonth = () => {
    return new Date(rangePickerYear, rangePickerMonth + 1, 0).getDate();
  };

  const handleRangeMonthChange = (direction: number) => {
    let nextMonth = rangePickerMonth + direction;
    let nextYear = rangePickerYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setRangePickerMonth(nextMonth);
    setRangePickerYear(nextYear);
  };

  const handleRangeDayClick = (dateStr: string) => {
    if (!tempRangeStart || (tempRangeStart && tempRangeEnd)) {
      // First click: sets start date
      setTempRangeStart(dateStr);
      setTempRangeEnd(null);
      setSelectedDate(dateStr);
      setEndDate(dateStr);
    } else {
      // Second click: sets end date
      if (dateStr >= tempRangeStart) {
        setTempRangeEnd(dateStr);
        setEndDate(dateStr);
        setShowRangePicker(false); // Auto close
      } else {
        // If they click a date before start date, treat it as the new start date!
        setTempRangeStart(dateStr);
        setTempRangeEnd(null);
        setSelectedDate(dateStr);
        setEndDate(dateStr);
      }
    }
  };

  const getDayBefore = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      date.setDate(date.getDate() - 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return dateString;
    }
  };

  const handleApplyFixedEventUpdate = async (scope: "single" | "future" | "all") => {
    if (!updatingFixedEventOptions) return;
    setIsSubmitting(true);
    try {
      const { event, payload, selectedDateForOccurrence } = updatingFixedEventOptions;

      if (scope === "single") {
        // 1. Add current date occurrence to exceptionDates of the original series
        const exceptions = [...(event.exceptionDates || []), selectedDateForOccurrence];
        await onEditEvent(event.id, { exceptionDates: exceptions });

        // 2. Create a brand new single event on this day with updated values
        await onAddEvent({
          familyId: currentUser.familyId || "",
          title: payload.title,
          date: selectedDateForOccurrence,
          time: payload.time,
          category: event.category || "",
          isFixed: false,
          note: payload.note,
          isPublic: payload.isPublic,
        });
      } else if (scope === "future") {
        // 1. End original series on the day before this occurrence
        const lastActiveDate = getDayBefore(selectedDateForOccurrence);
        await onEditEvent(event.id, { endDate: lastActiveDate });

        // 2. Create a new series starting from this occurrence
        await onAddEvent({
          familyId: currentUser.familyId || "",
          title: payload.title,
          date: "",
          time: payload.time,
          category: event.category || "",
          isFixed: true,
          weekdays: event.weekdays || [],
          startDate: selectedDateForOccurrence,
          note: payload.note,
          isPublic: payload.isPublic,
        });
      } else if (scope === "all") {
        // 3. Edit everything in the course
        await onEditEvent(event.id, payload);
      }

      setUpdatingFixedEventOptions(null);
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!isFixed && !selectedDate) return;

    const eventTimeStr = (startTime || endTime) ? `${startTime}~${endTime}` : "";
    console.log("儲存行程資料", {
      title: title.trim(),
      date: isFixed ? "" : selectedDate,
      startTime: startTime,
      endTime: endTime,
      time: eventTimeStr,
      note: note.trim()
    });

    const computedWeekdays = isFixed
      ? (repeatType === "weekly"
          ? [getWeekdayOfDate(selectedDate)]
          : (repeatType === "custom_weekdays" ? weekdays : []))
      : [];

    const payload = {
      title: title.trim(),
      date: isFixed ? "" : selectedDate,
      time: eventTimeStr,
      location: location.trim(),
      isFixed,
      repeatType: isFixed ? repeatType : "",
      weekdays: computedWeekdays,
      note: note.trim(),
      isPublic,
      startDate: isFixed ? selectedDate : selectedDate,
      endDate: isFixed ? "" : (isCrossDay ? endDate : selectedDate),
      dailyNotes: isCrossDay ? formDailyNotes : {},
    };

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingEvent) {
        // If they edit a fixed recurring event, prompt choices!
        if (editingEvent.isFixed) {
          setUpdatingFixedEventOptions({
            event: editingEvent,
            payload,
            selectedDateForOccurrence: selectedDate,
          });
          setShowAddForm(false);
          setIsSubmitting(false);
          return;
        }

        // If it's linked to templateId (meaning generated from a recurring favorite blueprint),
        // ask if they want to update all future associated calendar events or just this block!
        if (editingEvent.templateId) {
          setUpdatingRecurringEvent({ id: editingEvent.id, payload });
          setShowAddForm(false);
          setIsSubmitting(false);
          return;
        }

        await onEditEvent(editingEvent.id, payload);
        
        // Show success toast feedback!
        setSuccessToast({ show: true, title: payload.title });
        setTimeout(() => setSuccessToast(null), 2500);
      } else {
        const addPayload = {
          familyId: currentUser.familyId || "",
          title: title.trim(),
          date: isFixed ? "" : selectedDate,
          time: eventTimeStr,
          location: location.trim(),
          category: "",
          isFixed,
          repeatType: isFixed ? repeatType : "",
          weekdays: computedWeekdays,
          startDate: isFixed ? selectedDate : selectedDate,
          endDate: isFixed ? "" : (isCrossDay ? endDate : selectedDate),
          note: note.trim(),
          isPublic,
          dailyNotes: isCrossDay ? formDailyNotes : {},
        };

        // INTERCEPT: If it is a multi-day event with duration >= 3 days, prompt the user!
        if (!isFixed && isCrossDay && endDate && calcDurationDays(selectedDate, endDate) >= 3 && onSaveConfiguredMode) {
          setPendingAddPayload(addPayload);
          setPromptSpecialPeriod(true);
          setShowAddForm(false);
          setIsSubmitting(false);
          return;
        }

        await onAddEvent(addPayload);

        if (saveAsFav && onAddFavorite) {
          await onAddFavorite({
            familyId: currentUser.familyId || "",
            title: title.trim(),
            type: "calendar",
            isRecurring: false,
            repeatDays: [],
            defaultStartTime: "",
            defaultEndTime: "",
          });
        }
        
        // Show success toast feedback!
        setSuccessToast({ show: true, title: title.trim() });
        setTimeout(() => setSuccessToast(null), 2500);
      }
      setEditingEvent(null);
      setShowAddForm(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Firestore deletions with confirmation screens
  const triggerDeleteConfirm = (evt: CalendarEvent, dateStr?: string) => {
    setEventToDelete(evt);
    setSelectedDeleteDate(dateStr || selectedDate || "");
  };

  const executeDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const deletedTitle = eventToDelete.title;
      await onDeleteEvent(eventToDelete.id);
      
      setSuccessToast({ show: true, title: deletedTitle, isDeleted: true });
      setTimeout(() => setSuccessToast(null), 2500);

      setEventToDelete(null);
      setEditingEvent(null);
      setShowAddForm(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyFixedEventDelete = async (scope: "single" | "future" | "all") => {
    if (!eventToDelete) return;
    setIsSubmitting(true);
    try {
      const deletedTitle = eventToDelete.title;
      if (scope === "single") {
        const exceptions = [...(eventToDelete.exceptionDates || []), selectedDeleteDate];
        await onEditEvent(eventToDelete.id, { exceptionDates: exceptions });
      } else if (scope === "future") {
        const lastActiveDate = getDayBefore(selectedDeleteDate);
        await onEditEvent(eventToDelete.id, { endDate: lastActiveDate });
      } else if (scope === "all") {
        await onDeleteEvent(eventToDelete.id);
      }

      setSuccessToast({ show: true, title: deletedTitle, isDeleted: true });
      setTimeout(() => setSuccessToast(null), 2500);

      setEventToDelete(null);
      setSelectedDeleteDate("");
      setEditingEvent(null);
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const userRoleLower = (currentUser.role || "").toLowerCase();
  const isOwner = userRoleLower === "owner" || userRoleLower === "admin" || userRoleLower === "superadmin" || (currentUser.role as any) === "Admin" || (currentUser.role as any) === UserRole.OWNER;
  const isParentRole = userRoleLower === "parent" || currentUser.role === UserRole.PARENT;
  const isChildRole = userRoleLower === "child" || userRoleLower === "kid" || currentUser.role === UserRole.CHILD || (currentUser.role as any) === "Kid";

  const canCreateCalendar = isOwner || isParentRole || isChildRole;

  const isUserAllowedToDelete = (evt: CalendarEvent) => {
    if (isOwner || isParentRole) {
      return true;
    }
    if (isChildRole) {
      return evt.creatorUid === currentUser.uid;
    }
    return false;
  };

  const isReadOnlyForm = editingEvent ? !isUserAllowedToDelete(editingEvent) : !canCreateCalendar;

  const handleApplyRecurringUpdate = async (updateFuture: boolean) => {
    if (!updatingRecurringEvent) return;
    setIsSubmitting(true);
    try {
      await onEditEvent(updatingRecurringEvent.id, updatingRecurringEvent.payload, updateFuture);
      setUpdatingRecurringEvent(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="calendar-module" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className="w-full max-w-full bg-transparent md:bg-white md:rounded-[24px] md:border md:border-[#EFEAE2] p-0 md:p-6 lg:p-8 md:soft-journal-shadow space-y-3 md:space-y-6">
      
      {/* Calendar header controls - Sticky top below primary app navigation bar */}
      <div className="sticky top-[71px] md:top-[104px] bg-white z-30 py-2.5 md:py-3 border-b border-[#EFEAE2]/60 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 md:p-3 border border-[#EFEAE2] bg-[#FFFDF8] hover:bg-[#F7F3EB] rounded-2xl transition cursor-pointer"
            >
              <ChevronLeft className="h-4.5 w-4.5 text-[#5B7283]" />
            </button>
            <h2 className="text-lg md:text-2xl font-black text-[#3C332D] tracking-tight select-none whitespace-nowrap">
              {year}年 {month + 1}月
            </h2>
            <button
              onClick={handleNext}
              className="p-2 md:p-3 border border-[#EFEAE2] bg-[#FFFDF8] hover:bg-[#F7F3EB] rounded-2xl transition cursor-pointer"
            >
              <ChevronRight className="h-4.5 w-4.5 text-[#5B7283]" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 select-none font-sans">
            <button
              onClick={() => {
                const p = todayDateStr.split("-");
                if (p.length === 3) {
                  setCurrentDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
                } else {
                  setCurrentDate(new Date());
                }
                setSelectedMobileDate(todayDateStr);
              }}
              className="text-[11px] md:text-sm font-black px-3.5 py-1.5 bg-[#F7F3EB] text-[#5B7283] border border-[#EFEAE2] rounded-full hover:bg-white transition cursor-pointer"
            >
              📍 今天
            </button>
            <button
              onClick={() => handleSetViewType(viewType === "month" ? "week" : "month")}
              className="block md:hidden text-[11px] font-black px-3 py-1.5 bg-amber-50 text-amber-850 border border-amber-250 rounded-full hover:bg-amber-100 transition cursor-pointer shrink-0"
            >
              {viewType === "month" ? "🔄 切換週曆" : "🔄 切換月曆"}
            </button>
          </div>
        </div>

        {/* Calendar View Toggle switches (Desktop only) */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-[#FFFDF8] border border-[#EFEAE2] rounded-full font-sans w-full md:w-auto justify-between md:justify-start overflow-x-auto scrollbar-none animate-in fade-in">
          <button
            onClick={() => handleSetViewType("list")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "list"
                ? "bg-amber-100 text-[#3C332D] border border-amber-200 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-[#F7F3EB]"
            }`}
          >
            列表
          </button>
          <button
            onClick={() => handleSetViewType("month")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "month"
                ? "bg-amber-100 text-[#3C332D] border border-amber-200 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-[#F7F3EB]"
            }`}
          >
            月曆
          </button>
          <button
            onClick={() => handleSetViewType("week")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "week"
                ? "bg-amber-100 text-[#3C332D] border border-amber-200 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-[#F7F3EB]"
            }`}
          >
            週曆
          </button>
        </div>
      </div>

      {viewType === "list" && (
        <div id="list-view-wrapper" className="space-y-6 font-sans">
          {/* Quick Add and Header block */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <h3 className="text-xs font-black text-[#5B7283]">
              {year}年{month + 1}月行程清單
            </h3>
            {canCreateCalendar && (
              <button
                onClick={() => setShowAddTypeSelection({ show: true, dateStr: todayDateStr })}
                className="text-xs font-black bg-[#EAA59E] hover:bg-[#D98E85] text-white px-4 py-2 rounded-full transition shadow-xs"
              >
                + 新增本日行程
              </button>
            )}
          </div>

          <div className="space-y-6 select-none">
            {(() => {
              const daysInMonthWithEvents = monthDays.filter(cell => cell.isCurrentMonth).map(cell => {
                const dayEvts = getEventsForDate(cell.dateStr);
                return {
                  ...cell,
                  events: dayEvts
                };
              }).filter(cell => cell.events.length > 0);

              if (daysInMonthWithEvents.length === 0) {
                return (
                  <div className="text-center py-12 border border-dashed border-[#EFEAE2] rounded-2xl bg-[#FFFDFB]">
                    <span className="text-3xl block mb-2">🍵</span>
                    <p className="text-xs text-gray-400 font-bold">這個月目前還沒有任何行程安排喔！</p>
                    {canCreateCalendar && (
                      <button
                        onClick={() => setShowAddTypeSelection({ show: true, dateStr: todayDateStr })}
                        className="mt-3 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-4 py-2 rounded-full transition font-black"
                      >
                        ＋ 建立第一個行程
                      </button>
                    )}
                  </div>
                );
              }

              return daysInMonthWithEvents.map(dayCell => {
                const isToday = todayDateStr === dayCell.dateStr;
                return (
                  <div key={dayCell.dateStr} className="space-y-3">
                    {/* Day header block */}
                    <div className={`p-2.5 rounded-xl font-black text-sm flex justify-between items-center ${
                      isToday 
                        ? "bg-[#FFF9F1] text-[#D97706] border border-amber-100/50" 
                        : "bg-[#FFFDFB]/85 text-[#3C332D]"
                    }`}>
                      <span className="font-mono">
                        {formatListDayHeader(dayCell.dateStr)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] bg-[#FFF1E6] text-[#D97706] font-black px-2.5 py-0.5 rounded-full select-none">
                          📍 今天
                        </span>
                      )}
                    </div>

                    {/* Events detailed vertical layout - stripped of extra decorative icons */}
                    <div className="space-y-4 pl-3">
                      {dayCell.events.map(evt => {
                        const isBday = (evt as any).isBirthday;
                        const cleanTitle = cleanTitleForMobileCell(evt, dayCell.dateStr);
                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              if (window.innerWidth < 768) {
                                setSelectedMobileDate(dayCell.dateStr);
                                setIsDrawerOpen(true);
                              } else {
                                handleOpenEdit(evt, dayCell.dateStr);
                              }
                            }}
                            className="text-left py-1 cursor-pointer hover:bg-gray-5/40 rounded px-2 transition group/listitem flex justify-between items-start gap-4"
                          >
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-sm text-[#3C332D]">
                                {cleanTitle}
                              </h4>
                              {evt.time && (
                                <span className="text-xs font-mono font-bold text-gray-400 block">
                                  {evt.time}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex gap-1.5 shrink-0 select-none">
                              {!isBday && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(evt, dayCell.dateStr);
                                  }}
                                  className="text-[11px] bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 text-gray-600 font-bold rounded-lg transition"
                                >
                                  編輯
                                </button>
                              )}
                              {isUserAllowedToDelete(evt) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerDeleteConfirm(evt, dayCell.dateStr);
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-1 rounded transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Divider line style */}
                    <div className="border-b border-[#EFEAE2]/60 pt-4" />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Monthly View Grid */}
      {viewType === "month" && (
        <div id="monthly-view-wrapper" className="w-full border-0 md:border md:border-[#A59D84] rounded-none md:rounded-[24px] overflow-hidden bg-white shadow-none md:soft-journal-shadow select-none">
          {/* Weekday headers - small and elegant */}
          <div className="grid grid-cols-7 bg-[#FFFDF8] border-b border-[#C0B9A3] text-center py-2.5 md:py-3.5 text-[10px] md:text-sm font-black text-[#5B7283] tracking-wide">
            <div>週日</div>
            <div>週一</div>
            <div>週二</div>
            <div>週三</div>
            <div>週四</div>
            <div>週五</div>
            <div>週六</div>
          </div>

          <div className="grid grid-cols-7 border-collapse border-l border-t border-[#A59D84]">
            {monthDays.map((cell, idx) => {
              const dayEvents = allEvents.filter((e) => {
                if (e.isFixed) {
                  if (e.exceptionDates?.includes(cell.dateStr)) return false;
                  if (e.startDate && cell.dateStr < e.startDate) return false;
                  if (e.endDate && cell.dateStr > e.endDate) return false;
                  const [y, m, d] = cell.dateStr.split("-").map(Number);
                  
                  if ((e as any).repeatType === "monthly") {
                    const startDayNum = e.startDate ? Number(e.startDate.split("-")[2]) : (e.date ? Number(e.date.split("-")[2]) : 1);
                    return d === startDayNum;
                  } else {
                    const dow = new Date(y, m - 1, d).getDay();
                    return e.weekdays?.includes(dow);
                  }
                }
                if (e.startDate && e.endDate) {
                  return cell.dateStr >= e.startDate && cell.dateStr <= e.endDate;
                }
                return e.date === cell.dateStr;
              });
              const holiday = getHolidayForDate(cell.dateStr);
              const isToday = todayDateStr === cell.dateStr;
              const activeMode = getActiveModeForDate(cell.dateStr);
              const isMobileSelected = selectedMobileDate === cell.dateStr;

              // Sort events: prioritize multi-day events so they stack on top rows
              const sortedDayEvents = [...dayEvents].sort((a, b) => {
                const isMultiA = isMultiDayEvent(a) ? 1 : 0;
                const isMultiB = isMultiDayEvent(b) ? 1 : 0;
                if (isMultiA !== isMultiB) return isMultiB - isMultiA;

                const scoreA = a.isPublic ? 1 : 0;
                const scoreB = b.isPublic ? 1 : 0;
                if (scoreA !== scoreB) return scoreB - scoreA;

                return a.id.localeCompare(b.id);
              });

              // Apply color theme backgrounds
              let cellBg = "bg-white";
              if (isToday) {
                // Today: elegant warm light buttercream gold
                cellBg = "today-cell-special";
              } else if (activeMode) {
                if (activeMode.type === "travel") cellBg = "bg-[#EAF6FF]";
                else if (activeMode.type === "exam") cellBg = "bg-[#FFF5D9]";
                else if (activeMode.type === "vacation") cellBg = "bg-[#F2FFF0]";
                else cellBg = "bg-[#EEF2FF]";
              } else if (holiday && holiday.isNational) {
                cellBg = "bg-[#FFF1F0]/50";
              } else if (holiday) {
                cellBg = "bg-[#FAF5FF]/50";
              } else if (cell.isWeekend) {
                const dayIndex = new Date(cell.dateStr).getDay();
                cellBg = dayIndex === 6 ? "bg-[#EAF4FF]/80" : "bg-[#FFF0F5]/80";
              }

              if (!cell.isCurrentMonth) {
                cellBg += " opacity-30 bg-gray-50/10";
              }

              return (
                <div
                  id={`calendar-day-${cell.dateStr}`}
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    setSelectedMobileDate(cell.dateStr);
                    if (window.innerWidth < 768) {
                      setIsDrawerOpen(true);
                    } else {
                      handleOpenAdd(cell.dateStr);
                    }
                  }}
                  className={`min-h-[105px] h-[105px] md:min-h-[160px] md:h-auto p-1 md:p-2.5 flex flex-col justify-start md:justify-between gap-1 md:gap-0 transition group cursor-pointer overflow-hidden border-r border-b border-[#A59D84] ${cellBg} ${
                    isToday 
                      ? "relative z-10" 
                      : "hover:bg-[#FFFDF8]/90"
                  }`}
                >
                  {/* MOBILE VIEW COMPACT CELL */}
                  <div className="block md:hidden text-left flex flex-col justify-start h-full w-full overflow-hidden font-sans">
                    <div className="flex justify-between items-center select-none mb-0.5 pb-[2px] border-b border-gray-100/50">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-mono shrink-0 flex items-center justify-center ${
                            isToday
                              ? "bg-[#F7BFAE] text-white rounded-full px-2 py-[3px] text-[10px] font-black"
                              : `text-[10px] font-black rounded-full h-5 w-5 ${
                                  cell.isWeekend
                                    ? "text-[#3C332D]/70"
                                    : "text-[#3C332D]"
                                }`
                          }`}
                        >
                          {cell.day}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-black text-[#D97706] bg-[#FFF1E6] px-2 py-0.5 rounded-full shrink-0 select-none scale-90 origin-left">
                            📍 今天
                          </span>
                        )}
                      </div>
                      {holiday && (
                        <span className="text-[10px]" title={holiday.name}>
                          {holiday.emoji}
                        </span>
                      )}
                    </div>
                    
                    {/* Compact Events in date slot - immediately below date header, top aligned */}
                    <div className="flex-1 flex flex-col justify-start overflow-hidden space-y-1 mt-0.5 pb-0.5 select-none">
                      {activeMode && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModeForDetail({ mode: activeMode, dateStr: cell.dateStr });
                          }}
                          className={`font-black text-white rounded leading-tight mb-0.5 select-none cursor-pointer hover:opacity-85 transition ${
                            activeMode.type === "travel"
                              ? "text-[10px] px-1 py-[2px]"
                              : "truncate text-[8.5px] px-1 py-[1.5px] animate-pulse"
                          }`}
                          style={{
                            backgroundColor:
                              activeMode.type === "travel"
                                ? "#0066CC"
                                : activeMode.type === "exam"
                                ? "#D97706"
                                : activeMode.type === "vacation"
                                ? "#16A34A"
                                : "#4F46E5",
                            display: activeMode.type === "travel" ? "-webkit-box" : undefined,
                            WebkitLineClamp: activeMode.type === "travel" ? 2 : undefined,
                            WebkitBoxOrient: activeMode.type === "travel" ? "vertical" : undefined,
                            overflow: activeMode.type === "travel" ? "hidden" : undefined,
                            textOverflow: activeMode.type === "travel" ? "ellipsis" : undefined,
                            whiteSpace: activeMode.type === "travel" ? "normal" : "nowrap",
                            wordBreak: activeMode.type === "travel" ? "break-all" : undefined,
                          }}
                          title={activeMode.name}
                        >
                          {activeMode.type === "travel" ? "✈️ " : "🏕 "}{activeMode.name}
                        </div>
                      )}
                      {(() => {
                        const limit = 2;
                        const displayedEvents = sortedDayEvents.slice(0, limit);
                        const hiddenCount = sortedDayEvents.length - limit;
                        return (
                          <>
                            {displayedEvents.map((evt) => {
                              const cleanTitle = cleanTitleForMobileCell(evt, cell.dateStr);
                              const isBday = (evt as any).isBirthday || evt.title.includes("生日") || evt.title.includes("慶生");
                              let bgStyle = "";
                              
                              if (isBday) {
                                bgStyle = "bg-[#FFF0F5] border-[#FFB6C1] text-[#C71585]"; // 淺粉
                              } else {
                                const cObj = getEventColorByTitleForStyle(evt.title || "");
                                bgStyle = `${cObj.bg} ${cObj.border} ${cObj.text}`;
                              }
                              
                              const isTravel = isTravelEvent(evt.title);
                              
                              return (
                                <div
                                  key={evt.id}
                                  className={`font-black rounded border ${bgStyle} tracking-tight`}
                                  style={{
                                    padding: "2px 2.5px",
                                    fontSize: "10px",
                                    lineHeight: "1.15",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "normal",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {cleanTitle}
                                </div>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <div className="text-[8px] text-gray-500 font-extrabold text-right pr-0.5 tracking-tighter leading-none mt-0.5">
                                +{hiddenCount}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* DESKTOP VIEW DETAILED BLOCK */}
                  <div className="hidden md:block w-full">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-mono shrink-0 flex items-center justify-center ${
                            isToday
                              ? "bg-[#F7BFAE] text-white rounded-full px-2.5 py-1 text-sm font-black"
                              : `text-sm font-black rounded-full h-7.5 w-7.5 ${
                                  cell.isWeekend
                                    ? holiday
                                       ? "text-amber-800 font-extrabold"
                                       : "text-[#3C332D]/74"
                                    : "text-[#3C332D]"
                                }`
                          }`}
                        >
                          {cell.day}
                        </span>
                        {isToday && (
                          <span className="text-[10.5px] md:text-[11px] font-black text-[#D97706] bg-[#FFF1E6] px-2.5 py-1 rounded-full select-none shrink-0 border border-amber-100/30">
                            📍 今天
                          </span>
                        )}
                      </div>

                      {activeMode && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded shadow-none flex items-center gap-0.5 shrink-0 select-none scale-90 translate-x-1"
                          style={{
                            backgroundColor:
                              activeMode.type === "travel"
                                ? "#0066CC"
                                : activeMode.type === "exam"
                                ? "#B38600"
                                : activeMode.type === "vacation"
                                ? "#2E7D32"
                                : "#3F51B5",
                            color: "#FFFFFF",
                          }}
                        >
                          {activeMode.type === "travel" && "✈旅遊"}
                          {activeMode.type === "exam" && "📚考試"}
                          {activeMode.type === "vacation" && "🏕假期"}
                          {activeMode.type === "custom" && "🏠自訂"}
                        </span>
                      )}
                    </div>

                    {holiday && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-black px-1.5 py-0.5 rounded-md border shadow-sm select-none shrink-0 ${
                          holiday.isNational
                            ? "bg-[#FFEBEB] text-[#E53935] border-[#FFD5D4]"
                            : "bg-[#F3E8FF] text-[#8E24AA] border-[#E9D5FF]"
                        }`}>
                          {holiday.emoji} {holiday.name}
                        </span>
                      </div>
                    )}

                    {activeMode && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModeForDetail({ mode: activeMode, dateStr: cell.dateStr });
                        }}
                        className={`rounded-xl truncate shrink-0 font-sans flex items-center gap-1.5 mt-1.5 whitespace-nowrap overflow-hidden cursor-pointer hover:opacity-85 transition ${
                          activeMode.type === "travel"
                            ? "text-[12.6px] py-1.5 md:py-2 px-3 font-extrabold shadow-sm border border-sky-200"
                            : "text-[10.5px] font-semibold py-1 px-2"
                        }`}
                        style={{
                          backgroundColor:
                            activeMode.type === "travel"
                              ? "#BEE3FF"
                              : activeMode.type === "exam"
                              ? "#FFEAA3"
                              : activeMode.type === "vacation"
                              ? "#C9F0BE"
                              : "#C7D2FE",
                          color:
                            activeMode.type === "travel"
                              ? "#004B8F"
                              : activeMode.type === "exam"
                              ? "#7F5E00"
                              : activeMode.type === "vacation"
                              ? "#1B5E20"
                              : "#1E1B4B",
                        }}
                      >
                        {activeMode.type !== "travel" && (
                          <span>
                            {activeMode.type === "exam"
                              ? "📚"
                              : activeMode.type === "vacation"
                              ? "🏕️"
                              : "🏠"}
                          </span>
                        )}
                        <span className="truncate font-black">{activeMode.name}</span>
                      </div>
                    )}

                    <div className="flex-grow space-y-1.5 mt-2.5 overflow-hidden">
                      {sortedDayEvents.map((evt) => {
                        const isBday = (evt as any).isBirthday;
                        const isTravel = isTravelEvent(evt.title);
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(evt, cell.dateStr);
                            }}
                            className={`relative flex flex-col transition hover:translate-y-[-1px] group/item cursor-pointer font-black leading-tight ${
                              isTravel ? "p-2.5 text-base md:text-[16.2px]" : "p-2 text-sm md:text-[13.5px]"
                            } ${getAppletEventStyleClasses(evt, isBday, cell.dateStr, "month")}`}
                          >
                             <div className="flex items-center justify-between gap-1 overflow-hidden">
                              <span className={`truncate whitespace-nowrap overflow-hidden block max-w-[70%] font-sans font-black text-[#3C332D] ${
                                isTravel ? "text-base md:text-[16.8px]" : "text-sm md:text-[14px]"
                              }`}>
                                {getEventTitleWithPrefix(evt, isBday, cell.dateStr)}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto shrink-0 select-none">
                                {evt.location && (
                                  <button
                                    type="button"
                                    title="開啟地圖"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location || "")}`, '_blank');
                                    }}
                                    className="text-xs hover:scale-120 active:scale-90 transition-transform p-0.5 cursor-pointer bg-white/70 hover:bg-white border border-[#EAA59E]/20 shadow-xs rounded-full inline-flex items-center justify-center w-5 h-5"
                                  >
                                    📍
                                  </button>
                                )}
                                {isUserAllowedToDelete(evt) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerDeleteConfirm(evt, cell.dateStr);
                                    }}
                                    className="hidden group-hover/item:inline-block text-gray-400 hover:text-red-500 p-0.5 cursor-pointer transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {evt.dailyNotes?.[cell.dateStr] && (
                              <div className="text-[10px] text-[#004B8F] font-bold bg-[#E1F0FF]/45 border border-sky-150 rounded px-1.5 py-0.5 mt-1 truncate max-w-full text-left font-sans self-start">
                                📝 {evt.dailyNotes[cell.dateStr]}
                              </div>
                            )}
                            {evt.time && (
                              <span className="text-xs md:text-[12.5px] font-mono font-extrabold text-[#5B7283] mt-1 flex items-center gap-0.5">
                                🕒 {evt.time}
                              </span>
                            )}
                            {evt.location && (
                              <div className="text-[10.5px] md:text-[11px] font-sans font-bold text-amber-900 border border-amber-900/10 bg-amber-50/15 px-1.5 py-0.5 rounded flex items-center gap-1 mt-1 truncate max-w-full text-left self-start">
                                <span>📍</span>
                                <span className="truncate">{evt.location}</span>
                              </div>
                            )}
                            {!evt.isPublic && (
                              <span className="text-[9px] font-sans text-amber-800 mt-0.5 font-bold">
                                🔐 私有
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Weekly View Grid */}
      {viewType === "week" && (
        <div id="weekly-view-wrapper" className="border border-[#A59D84] rounded-[24px] overflow-hidden soft-journal-shadow bg-white">
          {/* DESKTOP HEADER ROW */}
          <div className="hidden md:grid grid-cols-7 bg-[#FFFDF8] border-b border-[#C0B9A3] text-center py-4 text-xs font-black text-[#5B7283] tracking-wide select-none">
            {weekDays.map((wd) => {
              const dayOfWeek = new Date(wd.dateStr).getDay();
              let textHeaderColor = "text-[#5B7283]";
              if (dayOfWeek === 6) textHeaderColor = "text-[#5B83B0]";
              if (dayOfWeek === 0) textHeaderColor = "text-[#EAA59E]";
              
              const activeMode = getActiveModeForDate(wd.dateStr);
              let modeDayLabel = "";
              if (activeMode) {
                try {
                  const parseDateStr = (str: string) => {
                    const p = str.split("-");
                    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                  };
                  const mStart = parseDateStr(activeMode.startDate);
                  const mToday = parseDateStr(wd.dateStr);
                  const diff = Math.floor((mToday.getTime() - mStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  
                  let typeLabel = "日常";
                  if (activeMode.type === "travel") typeLabel = "旅遊";
                  else if (activeMode.type === "exam") typeLabel = "衝刺";
                  else if (activeMode.type === "vacation") typeLabel = "假期";
                  else typeLabel = "自訂";
                  
                  modeDayLabel = `${typeLabel}第${diff}天`;
                } catch (e) {
                  // fallback
                }
              }

              return (
                <div key={wd.dateStr} className={`space-y-1 p-2 border-r last:border-r-0 border-gray-105 flex flex-col items-center justify-between min-h-[105px] ${wd.isToday ? "font-black" : ""}`}>
                  <div className="space-y-0.5">
                    <div className={textHeaderColor}>{wd.dayName}</div>
                    <div className={`text-sm mt-0.5 font-mono inline-block ${wd.isToday ? "bg-[#F7BFAE] text-white rounded-full px-2.5 py-0.5 font-extrabold shadow-sm" : ""}`}>
                      {wd.day} 日
                    </div>
                  </div>
                  {activeMode && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModeForDetail({ mode: activeMode, dateStr: wd.dateStr });
                      }}
                      className="text-[10px] w-full p-1 rounded-lg font-bold font-sans mt-2 space-y-0.5 leading-tight truncate select-none shadow-sm cursor-pointer hover:opacity-85 transition"
                      style={{
                        backgroundColor:
                          activeMode.type === "travel"
                            ? "#EAF6FF"
                            : activeMode.type === "exam"
                            ? "#FFF5D9"
                            : activeMode.type === "vacation"
                            ? "#F2FFF0"
                            : "#EEF2FF",
                        borderColor:
                          activeMode.type === "travel"
                            ? "#BFDFFF"
                            : activeMode.type === "exam"
                            ? "#FFE6A3"
                            : activeMode.type === "vacation"
                            ? "#D8F3D1"
                            : "#CCD6FF",
                        borderWidth: "1px",
                        color:
                          activeMode.type === "travel"
                            ? "#004B8F"
                            : activeMode.type === "exam"
                            ? "#7F5E00"
                            : activeMode.type === "vacation"
                            ? "#1B5E20"
                            : "#1E1B4B",
                      }}
                    >
                      <div className="truncate font-black text-center">{activeMode.type === "travel" ? "✈️" : activeMode.type === "exam" ? "📚" : activeMode.type === "vacation" ? "🏕️" : "🏠"} {activeMode.name}</div>
                      <div className="text-[8.5px] opacity-90 scale-95 font-black text-center">{modeDayLabel}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP GRID CONTENTS */}
          <div className="hidden md:grid grid-cols-7 min-h-[400px] border-l border-b border-[#A59D84]">
            {weekDays.map((cell) => {
              const dayEvents = getEventsForDate(cell.dateStr);
              const holiday = getHolidayForDate(cell.dateStr);
              const activeMode = getActiveModeForDate(cell.dateStr);

              // Sort events
              const sortedDayEvents = [...dayEvents].sort((a, b) => {
                const isMultiA = isMultiDayEvent(a) ? 1 : 0;
                const isMultiB = isMultiDayEvent(b) ? 1 : 0;
                if (isMultiA !== isMultiB) return isMultiB - isMultiA;

                const scoreA = a.isPublic ? 1 : 0;
                const scoreB = b.isPublic ? 1 : 0;
                if (scoreA !== scoreB) return scoreB - scoreA;

                return a.id.localeCompare(b.id);
              });

              let cellBg = "";
              if (cell.isToday) {
                cellBg = "today-cell-special relative z-10";
              } else if (activeMode) {
                if (activeMode.type === "travel") cellBg = "bg-[#EAF6FF]/95";
                else if (activeMode.type === "exam") cellBg = "bg-[#FFF5D9]/95";
                else if (activeMode.type === "vacation") cellBg = "bg-[#F2FFF0]/95";
                else cellBg = "bg-[#EEF2FF]/95";
              } else if (holiday && holiday.isNational) {
                cellBg = "bg-[#FFF1F0]/50";
              } else if (holiday) {
                cellBg = "bg-[#FAF5FF]/50";
              } else if (cell.isWeekend) {
                const dow = new Date(cell.dateStr).getDay();
                cellBg = dow === 6 ? "bg-[#EAF4FF]/80" : "bg-[#FFF0F5]/80";
              }

              return (
                <div
                  id={`calendar-day-${cell.dateStr}`}
                  key={cell.dateStr}
                  onClick={() => {
                    setSelectedMobileDate(cell.dateStr);
                    if (window.innerWidth < 768) {
                      setIsDrawerOpen(true);
                    } else {
                      if (canCreateCalendar) {
                        setShowAddTypeSelection({ show: true, dateStr: cell.dateStr });
                      }
                    }
                  }}
                  className={`p-4 border-r border-[#A59D84] flex flex-col justify-between hover:bg-[#FFFDF8]/60 cursor-pointer min-h-[350px] transition ${cellBg}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-[#5B7283] bg-white border border-[#EFEAE2] px-2 py-0.5 rounded-full font-mono">
                        {cell.dateStr.slice(5)}
                      </span>
                      {activeMode && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModeForDetail({ mode: activeMode, dateStr: cell.dateStr });
                          }}
                          className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider shadow-none flex items-center gap-0.5 cursor-pointer hover:opacity-85 transition"
                          style={{
                            backgroundColor:
                              activeMode.type === "travel"
                                ? "#0066CC"
                                : activeMode.type === "exam"
                                ? "#B38600"
                                : activeMode.type === "vacation"
                                ? "#2E7D32"
                                : "#3F51B5",
                            color: "#FFFFFF",
                          }}
                        >
                          {activeMode.type === "travel" && "✈旅遊"}
                          {activeMode.type === "exam" && "📚考試"}
                          {activeMode.type === "vacation" && "🏕寒暑假"}
                          {activeMode.type === "custom" && "🏠自訂"}
                        </span>
                      )}
                    </div>

                    {holiday && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-black px-1.5 py-0.5 rounded-md border shadow-sm select-none shrink-0 ${
                          holiday.isNational
                            ? "bg-[#FFEBEB] text-[#E53935] border-[#FFD5D4]"
                            : "bg-[#F3E8FF] text-[#8E24AA] border-[#E9D5FF]"
                        }`}>
                          {holiday.emoji} {holiday.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow space-y-3">
                    {sortedDayEvents.map((evt) => {
                      const isBday = (evt as any).isBirthday;
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(evt, cell.dateStr);
                          }}
                          className={`p-3 border transition cursor-pointer leading-relaxed ${getAppletEventStyleClasses(evt, isBday, cell.dateStr, "week")}`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="text-base font-black font-sans tracking-tight text-[#3C332D]">
                              {getEventTitleWithPrefix(evt, isBday, cell.dateStr)}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0 select-none">
                              {evt.location && (
                                <button
                                  type="button"
                                  title="開啟地圖"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location || "")}`, '_blank');
                                  }}
                                  className="text-xs hover:scale-120 active:scale-90 transition-transform p-0.5 cursor-pointer bg-white/70 hover:bg-white border border-[#EAA59E]/20 shadow-xs rounded-full inline-flex items-center justify-center w-5 h-5"
                                >
                                  📍
                                </button>
                              )}
                              {isUserAllowedToDelete(evt) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerDeleteConfirm(evt, cell.dateStr);
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-0.5 flex-shrink-0 transition cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {evt.dailyNotes?.[cell.dateStr] && (
                            <div className="text-[11px] text-[#004B8F] font-bold bg-[#E1F0FF]/45 border border-sky-150 rounded px-1.5 py-0.5 mt-1.5 truncate max-w-full text-left font-sans self-start">
                              📘 {evt.dailyNotes[cell.dateStr]}
                            </div>
                          )}
                          {evt.time && (
                            <span className="text-xs text-gray-500 font-mono mt-1.5 font-bold flex items-center gap-1">
                              <ClockIcon className="h-3.5 w-3.5 text-[#5B7283]" />
                              {evt.time}
                            </span>
                          )}
                          {evt.location && (
                            <div className="text-[11px] font-sans font-bold text-amber-900 border border-amber-900/10 bg-amber-50/15 px-1.5 py-0.5 rounded flex items-center gap-1 mt-1.5 self-start select-none">
                              <span>📍</span>
                              <span className="truncate">{evt.location}</span>
                            </div>
                          )}
                          {evt.note && (
                            <p className="text-[11px] text-[#6E645E] mt-2 italic break-words line-clamp-2">
                              {evt.note}
                            </p>
                          )}
                          {!evt.isPublic && (
                            <span className="text-[10px] text-[#EAA59E] mt-1.5 font-bold flex items-center gap-0.5">
                              🔐 私人行程
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* MOBILE VIEW - VERTICAL TIMELINE OF THE CURRENT WEEK (REPLACES NARROW MULTI COLUMNS) */}
          <div className="block md:hidden p-4 space-y-4 bg-[#FCFBF9]">
            {weekDays.map((wd) => {
              const dayEvents = getEventsForDate(wd.dateStr);
              const holiday = getHolidayForDate(wd.dateStr);
              const activeMode = getActiveModeForDate(wd.dateStr);

              return (
                <div
                  key={wd.dateStr}
                  className={`border border-[#EFEAE2] rounded-2xl p-4 transition-all duration-200 relative ${
                    wd.isToday 
                      ? "today-cell-special z-10" 
                      : "bg-white shadow-xs"
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        wd.isToday ? "bg-[#F7BFAE] text-white" : "bg-[#FFFDF8] text-[#5B7283] border border-[#EFEAE2]"
                      }`}>
                        {wd.dayName} {wd.day}日
                      </span>
                      {wd.isToday && (
                        <span className="text-[9px] bg-[#FFF1E6] text-[#D97706] font-black px-2 py-0.5 rounded-full select-none shrink-0">📍 今天</span>
                      )}
                      {holiday && (
                        <span className="text-[9px] bg-[#FFEBEB] text-[#E53935] border border-[#FFD5D4] px-1.5 py-0.5 rounded-full font-bold select-none shrink-0">
                          {holiday.emoji} {holiday.name}
                        </span>
                      )}
                      {activeMode && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModeForDetail({ mode: activeMode, dateStr: wd.dateStr });
                          }}
                          className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-indigo-100 transition select-none shrink-0"
                        >
                          {activeMode.name}
                        </span>
                      )}
                    </div>

                    {canCreateCalendar && (
                      <button
                        onClick={() => setShowAddTypeSelection({ show: true, dateStr: wd.dateStr })}
                        className="text-[10px] font-bold text-[#5B7283] hover:text-[#3C332D] px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-[#EFEAE2] transition"
                      >
                        + 新增行程
                      </button>
                    )}
                  </div>

                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 font-bold py-3">當天尚無安排任何行程安排 🌸</p>
                  ) : (
                    <div className="space-y-3 mt-3">
                      {dayEvents.map((evt) => {
                        const isBday = (evt as any).isBirthday;
                        return (
                          <div
                            key={evt.id}
                            onClick={() => handleOpenEdit(evt, wd.dateStr)}
                            className={`p-3.5 border flex flex-col gap-1.5 text-left relative cursor-pointer hover:opacity-90 transition-all duration-200 ${getAppletEventStyleClasses(evt, isBday, wd.dateStr, "month")}`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-extrabold text-xs text-[#3C332D] truncate block max-w-[70%]">
                                {getEventTitleWithPrefix(evt, isBday, wd.dateStr)}
                              </span>
                              
                              <div className="flex items-center gap-1.5 select-none shrink-0 ml-auto bg-transparent">
                                {evt.location && (
                                  <button
                                    type="button"
                                    title="開啟地圖"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location || "")}`, '_blank');
                                    }}
                                    className="text-[10px] hover:scale-120 active:scale-90 transition-transform p-0.5 cursor-pointer bg-white border border-[#EAA59E]/20 shadow-xs rounded-full inline-flex items-center justify-center w-5 h-5 animate-in fade-in"
                                  >
                                    📍
                                  </button>
                                )}
                                {isUserAllowedToDelete(evt) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerDeleteConfirm(evt, wd.dateStr);
                                    }}
                                    className="text-gray-400 hover:text-red-500 p-0.5 rounded transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {evt.location && (
                              <div className="text-[10.5px] md:text-[11px] font-sans font-bold text-amber-900 border border-amber-900/10 bg-amber-50/15 px-1.5 py-0.5 rounded flex items-center gap-1 mt-0.5 truncate max-w-full text-left self-start select-none">
                                <span>📍</span>
                                <span className="truncate">{evt.location}</span>
                              </div>
                            )}

                            {evt.time && (
                              <span className="text-[11px] font-mono text-gray-450 font-bold flex items-center gap-1">
                                🕐 {evt.time}
                              </span>
                            )}

                            {isMultiDayEvent(evt) && evt.startDate && evt.endDate && (
                              <span className="text-[9px] bg-sky-50 text-sky-850 border border-sky-100 rounded px-1.5 py-0.5 font-bold self-start select-none">
                                跨日行程 · 第 {getMultiDayLabel(evt.startDate, evt.endDate, wd.dateStr).dayIndex} 天 / 共 {getMultiDayLabel(evt.startDate, evt.endDate, wd.dateStr).totalDays} 天
                              </span>
                            )}

                            {evt.dailyNotes?.[wd.dateStr] && (
                              <div className="text-[11px] text-[#004B8F] font-bold bg-[#E1F0FF]/45 border border-sky-100 rounded-lg px-2 py-1 font-sans self-start mt-0.5">
                                📝 {evt.dailyNotes[wd.dateStr]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation of Delete Event Dialog */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-100 font-sans">
          {eventToDelete.isFixed ? (
            <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full soft-journal-shadow space-y-5">
              <h3 className="text-lg font-black text-[#3C332D] flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
                您要刪除哪一種？
              </h3>
              <p className="text-sm text-[#3C332D] leading-relaxed">
                您正在刪除由固定日常 / 週課表重複行程產生的活動：
                <b className="text-rose-500 block my-2 text-md font-extrabold">「 {eventToDelete.title} 」</b>
                請選擇您要刪除的範圍：
              </p>
              
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleApplyFixedEventDelete("single")}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#FFFBF0] hover:bg-[#FDF6E2] border border-[#EDD091]/50 rounded-2xl transition cursor-pointer"
                >
                  <div className="font-extrabold text-sm text-[#3C332D] flex items-center gap-1.5">
                    <span>🗓️</span> 只刪除本次
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 font-medium">
                    只刪除這一天（{selectedDeleteDate}）。往後相同的重複課程仍會保留。
                  </p>
                </button>
                
                <button
                  onClick={() => handleApplyFixedEventDelete("future")}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#F7F3EB] hover:bg-[#EFEAE2] border border-[#EFEAE2] rounded-2xl transition cursor-pointer"
                >
                  <div className="font-extrabold text-sm text-[#3C332D] flex items-center gap-1.5">
                    <span>📅</span> 結束未來課程
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 font-medium">
                    刪除這一天（{selectedDeleteDate}）之後所有的活動。這一天之前的舊記錄仍會保留。
                  </p>
                </button>

                <button
                  onClick={() => handleApplyFixedEventDelete("all")}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 text-xs font-extrabold text-white bg-rose-500 hover:bg-rose-600 rounded-2xl transition cursor-pointer soft-journal-shadow"
                >
                  <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    <span>🗑️</span> 刪除整個課程
                  </div>
                  <p className="text-[11px] text-rose-100/90 mt-1 font-medium">
                    徹底刪除這個固定課程的所有歷史和未來排程。
                  </p>
                </button>

                <button
                  onClick={() => {
                    setEventToDelete(null);
                    setSelectedDeleteDate("");
                  }}
                  className="w-full text-center py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full soft-journal-shadow">
              <h3 className="text-lg font-black text-[#3C332D] mb-4 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-[#EAA59E]" />
                確定要刪除這筆行程嗎？
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                您確定要刪除行程：<b className="text-[#3C332D] font-black block my-1">「 {eventToDelete.title} 」</b>
                按確認後將立即從日曆刪除並同步此更動，此動作無法復原。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setEventToDelete(null)}
                  className="px-5 py-2.5 text-xs font-bold text-gray-500 bg-white hover:bg-gray-50 border border-[#EFEAE2] rounded-full transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={executeDeleteEvent}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-black text-white bg-rose-500 hover:bg-rose-600 rounded-full shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "正在刪除..." : "確認刪除"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation of Editing Fixed Event Options Modal */}
      {updatingFixedEventOptions && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-100 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full soft-journal-shadow space-y-5">
            <h3 className="text-lg font-black text-[#3C332D] flex items-center gap-2">
              <Info className="h-6 w-6 text-[#5B7283]" />
              您要修改哪一種？
            </h3>
            <p className="text-sm text-[#3C332D] leading-relaxed">
              您正在修改由固定課程 / 週課表產生的行程：
              <b className="text-[#5B7283] block my-2 text-md font-extrabold">「 {updatingFixedEventOptions.event.title} 」</b>
              請選擇您要套用的修改範圍：
            </p>
            
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleApplyFixedEventUpdate("single")}
                className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#FFFBF0] hover:bg-[#FDF6E2] border border-[#EDD091]/50 rounded-2xl transition cursor-pointer"
              >
                <div className="font-extrabold text-sm text-[#3C332D] flex items-center gap-1.5">
                  <span>🗓️</span> 只修改這一天
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">
                  僅修改目前所選的單日行程（{updatingFixedEventOptions.selectedDateForOccurrence}），其餘重複的課程時間保持不變。
                </p>
              </button>
              
              <button
                onClick={() => handleApplyFixedEventUpdate("future")}
                className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#F7F3EB] hover:bg-[#EFEAE2] border border-[#EFEAE2] rounded-2xl transition cursor-pointer"
              >
                <div className="font-extrabold text-sm text-[#3C332D] flex items-center gap-1.5">
                  <span>📅</span> 修改這一天之後所有活動
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">
                  同步將此次更改套用到包含這一天（{updatingFixedEventOptions.selectedDateForOccurrence}）往後所有的重複固定排程。
                </p>
              </button>

              <button
                onClick={() => handleApplyFixedEventUpdate("all")}
                className="w-full text-left p-4 text-xs font-extrabold text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-2xl transition cursor-pointer soft-journal-shadow"
              >
                <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <span>✏️</span> 修改整個課程
                </div>
                <p className="text-[11px] text-gray-100/90 mt-1 font-medium">
                  將會修改該固定課程的所有排程（包含歷史和未來）。
                </p>
              </button>

              <button
                onClick={() => setUpdatingFixedEventOptions(null)}
                className="w-full text-center py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation of Editing Recurring Option */}
      {updatingRecurringEvent && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-100 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full soft-journal-shadow space-y-5">
            <h3 className="text-lg font-black text-[#3C332D] flex items-center gap-2">
              <Info className="h-6 w-6 text-[#5B7283]" />
              固定重複活動更改選項
            </h3>
            <p className="text-sm text-[#3C332D] leading-relaxed">
              您正在修改由固定課程 / 週課表產生的行程：
              <b className="text-[#5B7283] block my-2 text-md font-extrabold">「 {updatingRecurringEvent.payload.title} 」</b>
              請選擇您要套用的修改範圍：
            </p>
            
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleApplyRecurringUpdate(false)}
                className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#FFFBF0] hover:bg-[#FDF6E2] border border-[#EDD091]/50 rounded-2xl transition cursor-pointer"
              >
                <div>【只更新這次】</div>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">僅更新目前所選的單日行程，其餘星期數重複的課程時間保持不變。</p>
              </button>
              
              <button
                type="button"
                onClick={() => handleApplyRecurringUpdate(true)}
                className="w-full text-left p-4 text-xs font-extrabold text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-2xl transition cursor-pointer soft-journal-shadow"
              >
                <div>【更新全部未來活動】</div>
                <p className="text-[11px] text-gray-100/80 mt-1 font-medium">同步將此次更改套用到行事曆上所有往後的相同固定重複活動。</p>
              </button>

              <button
                type="button"
                onClick={() => setUpdatingRecurringEvent(null)}
                className="w-full text-center py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Calendar Event Modal popup window */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[95] animate-in fade-in duration-150 font-sans">
          <form
            onSubmit={handleFormSubmit}
            className="bg-[#FFF8F5] rounded-[24px] border border-[#D8C6B8] max-w-md w-full soft-journal-shadow relative flex flex-col max-h-[90vh] md:max-h-[800px]"
          >
            {/* Header (Fixed) */}
            <div className="p-4 md:p-6 pb-3 md:pb-4 border-b border-[#D8C6B8] flex items-center justify-between shrink-0 bg-[#FFF8F5]">
              <h3 className="text-base sm:text-[17px] font-black text-[#5C4D41] flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#B89B84]" />
                {editingEvent ? (isReadOnlyForm ? "查看行程細節" : "編輯/查看行程") : "新增行事曆行程"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-[#8E7E74] hover:text-[#5C4D41] transition cursor-pointer p-1 rounded-full hover:bg-[#FFF2EB]"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-4 flex-grow bg-[#FFF8F5] select-none scrollbar-thin">
              {/* Quick advanced toggles for Switch of Modes */}
              {!editingEvent && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = selectedDate || getLocalToday();
                      setShowAddForm(false);
                      setNewTravelName("");
                      setNewTravelStartDate(d);
                      setNewTravelEndDate(d);
                      setNewTravelType("international");
                      setShowCreateTravelModal({ startDate: d, endDate: d });
                    }}
                    className="flex-1 py-1.5 px-3 bg-[#FFFCFA] border border-[#D8C6B8] hover:bg-[#FFF2EB] text-[#5C4D41] text-xs font-black rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ✈️ 切換為旅遊計畫
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      if (onChangePage) {
                        onChangePage("special-periods");
                      }
                    }}
                    className="flex-1 py-1.5 px-3 bg-[#FFFCFA] border border-[#D8C6B8] hover:bg-[#FFF2EB] text-[#5C4D41] text-xs font-black rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🏕️ 切換為自訂計畫
                  </button>
                </div>
              )}

              {/* 1. 活動名稱 */}
              <div className="space-y-1.5">
                <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A]">活動名稱 *</label>
                <input
                  type="text"
                  required
                  disabled={isReadOnlyForm}
                  placeholder="請輸入活動名稱 (例如：游泳課、看牙醫)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 placeholder-[#A59487] text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] transition"
                />
              </div>

              {/* 2. 📋 或直接套用常用事項 */}
              {!editingEvent && favoriteActivities.length > 0 && (() => {
                const calendarTemplates = favoriteActivities.filter((t) => {
                  const ut = t.usageType || t.type;
                  return ut === "calendar" || ut === "both";
                });
                if (calendarTemplates.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <label className="block text-xs sm:text-[13px] font-bold text-[#6B4F3A]">
                      或直接套用常用事項
                    </label>
                    <select
                      value={selectedFavId}
                      disabled={isReadOnlyForm}
                      onChange={(e) => handleSelectFavItem(e.target.value)}
                      className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFF7F2] rounded-xl px-3.5 py-2.5 text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] transition cursor-pointer"
                    >
                      <option value="">▼ 選擇常用事項</option>
                      {calendarTemplates.map((fav) => (
                        <option key={fav.id} value={fav.id}>
                          {fav.title} ({fav.isRecurring ? "每週固定" : "單次固定"}{fav.defaultStartTime ? ` | ${fav.defaultStartTime}~${fav.defaultEndTime}` : ""})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* 3. 加入常用事項？ (僅限手動輸入時顯示) */}
              {!editingEvent && onAddFavorite && !selectedFavId && title.trim().length > 0 && (
                <div className="bg-[#FFF6EE] border border-[#E8D6C8] p-3.5 rounded-xl flex items-center justify-between gap-4 animate-in fade-in duration-200">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-[#6B4F3A]">加入常用事項？</span>
                    <p className="text-[11px] text-[#8A7A6B]">將此新行程儲存為常用範本，方便日後一鍵套用</p>
                  </div>
                  <div className="flex gap-4 shrink-0">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-bold text-[#6B4F3A]">
                      <input
                        type="radio"
                        name="saveAsFavRadio"
                        checked={saveAsFav === true}
                        onChange={() => setSaveAsFav(true)}
                        className="h-4 w-4 accent-[#B89B84] cursor-pointer"
                      />
                      <span>是</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-bold text-[#6B4F3A]">
                      <input
                        type="radio"
                        name="saveAsFavRadio"
                        checked={saveAsFav === false}
                        onChange={() => setSaveAsFav(false)}
                        className="h-4 w-4 accent-[#B89B84] cursor-pointer"
                      />
                      <span>否</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 4. 此活動是否為固定活動／週課表？ */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="isFixed"
                    checked={isFixed}
                    disabled={isReadOnlyForm}
                    onChange={(e) => {
                      setIsFixed(e.target.checked);
                      if (e.target.checked) {
                        setRepeatType("weekly");
                        try {
                          const dStr = selectedDate || getLocalToday();
                          const [y, m, d] = dStr.split("-").map(Number);
                          const dow = new Date(y, m - 1, d).getDay();
                          setWeekdays([dow]);
                        } catch (_) {
                          setWeekdays([1]);
                        }
                      } else {
                        setWeekdays([]);
                      }
                    }}
                    className="h-4 w-4 rounded border-[#D8C6B8] focus:ring-[#B89B84] text-[#B89B84] cursor-pointer disabled:opacity-55"
                  />
                  <label htmlFor="isFixed" className="text-base font-bold text-[#6B4F3A] cursor-pointer select-none">
                    此活動是否為固定活動／週課表？
                  </label>
                </div>

                {isFixed && (
                  <div className="border border-[#D8C6B8] p-3.5 rounded-xl bg-[#FFFDFC] space-y-3 animate-in fade-in duration-150">
                    <span className="block text-xs font-bold text-[#8A7A6B]">選擇重複方式：</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRepeatType("weekly");
                          try {
                            const dStr = selectedDate || getLocalToday();
                            const [y, m, d] = dStr.split("-").map(Number);
                            const dow = new Date(y, m - 1, d).getDay();
                            setWeekdays([dow]);
                          } catch (_) {
                            setWeekdays([1]);
                          }
                        }}
                        className={`py-1.5 px-2 text-xs font-bold border rounded-lg transition cursor-pointer text-center ${
                          repeatType === "weekly"
                            ? "bg-[#B89B84] text-white border-[#B89B84]"
                            : "bg-[#FFFDFC] text-[#6B4F3A] border-[#D8C6B8] hover:bg-[#FFF2EB]"
                        }`}
                      >
                        每週重覆
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setRepeatType("monthly");
                          setWeekdays([]);
                        }}
                        className={`py-1.5 px-2 text-xs font-bold border rounded-lg transition cursor-pointer text-center ${
                          repeatType === "monthly"
                            ? "bg-[#B89B84] text-white border-[#B89B84]"
                            : "bg-[#FFFDFC] text-[#6B4F3A] border-[#D8C6B8] hover:bg-[#FFF2EB]"
                        }`}
                      >
                        每月重覆
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRepeatType("custom_weekdays");
                          if (weekdays.length === 0) {
                            try {
                              const dStr = selectedDate || getLocalToday();
                              const [y, m, d] = dStr.split("-").map(Number);
                              const dow = new Date(y, m - 1, d).getDay();
                              setWeekdays([dow]);
                            } catch (_) {
                              setWeekdays([1]);
                            }
                          }
                        }}
                        className={`py-1.5 px-2 text-xs font-bold border rounded-lg transition cursor-pointer text-center ${
                          repeatType === "custom_weekdays"
                            ? "bg-[#B89B84] text-white border-[#B89B84]"
                            : "bg-[#FFFDFC] text-[#6B4F3A] border-[#D8C6B8] hover:bg-[#FFF2EB]"
                        }`}
                      >
                        指定星期
                      </button>
                    </div>

                    {repeatType === "custom_weekdays" && (
                      <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                        <label className="block text-xs font-bold text-[#8A7A6B]">選擇每週重複星期數（可複選）：</label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAYS_LIST.map((wd) => {
                            const isActive = weekdays.includes(wd.value);
                            return (
                              <button
                                type="button"
                                key={wd.value}
                                disabled={isReadOnlyForm}
                                onClick={() => toggleWeekday(wd.value)}
                                className={`px-2.5 py-1 text-xs font-bold border rounded-md transition cursor-pointer disabled:opacity-75 ${
                                  isActive
                                    ? "bg-[#B89B84] text-white border-[#B89B84]"
                                    : "bg-[#FFFDFC] text-[#8A7A6B] border-[#D8C6B8] hover:bg-[#FFF2EB]"
                                }`}
                              >
                                {wd.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. 📅 活動日期 */}
              {!isFixed ? (
                <div className="space-y-4">
                  {isCrossDay ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">期間日期 *</label>
                        <button
                          type="button"
                          onClick={() => setShowRangePicker(!showRangePicker)}
                          className="w-full text-left font-mono font-bold text-base border border-[#D8C6B8] rounded-xl px-4 py-3 bg-[#FFFDFC] hover:bg-[#FFF2EB] transition duration-150 focus:outline-none focus:border-[#B89B84] flex items-center justify-between cursor-pointer select-none"
                        >
                          <span className="text-[#3C332D] flex items-center gap-2 text-base">
                            📅 {selectedDate.replace(/-/g, "/")} ～ {endDate.replace(/-/g, "/")}
                          </span>
                          <span className="text-xs font-bold text-[#8A7A6B] bg-[#FFF2EB] border border-[#D8C6B8] px-2.5 py-1 rounded-lg shrink-0">
                            共 {calcDurationDays(selectedDate, endDate)} 天
                          </span>
                        </button>
                        
                        {/* Interactive mini Month Calendar dropdown */}
                        {showRangePicker && (
                          <div className="mt-2.5 p-4 bg-[#FFFDFC] border border-[#D8C6B8] rounded-2xl space-y-3 shadow-md animate-in fade-in slide-in-from-top-1.5 duration-200 z-10 relative">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleRangeMonthChange(-1)}
                                className="p-1 px-2.5 border border-[#D8C6B8] bg-[#FFFDFC] hover:bg-[#FFF2EB] rounded-lg text-xs font-bold transition cursor-pointer select-none"
                              >
                                上個月
                              </button>
                              <span className="text-sm font-bold text-[#6B4F3A] select-none">
                                {rangePickerYear}年 {rangePickerMonth + 1}月
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRangeMonthChange(1)}
                                className="p-1 px-2.5 border border-[#D8C6B8] bg-[#FFFDFC] hover:bg-[#FFF2EB] rounded-lg text-xs font-bold transition cursor-pointer select-none"
                              >
                                下個月
                              </button>
                            </div>
                            
                            {/* Mini calendar grid */}
                            <div className="grid grid-cols-7 gap-1 text-center font-sans">
                              {["日", "一", "二", "三", "四", "五", "六"].map((w, index) => (
                                <span key={index} className={`font-bold text-xs py-1 ${(index === 0 || index === 6) ? "text-rose-500" : "text-[#8A7A6B]"}`}>
                                  {w}
                                </span>
                              ))}
                              
                              {/* Empty cells */}
                              {Array.from({ length: getRangeFirstDayOfWeek() }).map((_, i) => (
                                <div key={`empty-${i}`} className="py-1" />
                              ))}
                              
                              {/* Days */}
                              {Array.from({ length: getRangeDaysInMonth() }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${rangePickerYear}-${String(rangePickerMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                
                                const isSelectedStart = dateStr === tempRangeStart;
                                const isSelectedEnd = dateStr === tempRangeEnd;
                                const isInRange = tempRangeStart && tempRangeEnd && dateStr > tempRangeStart && dateStr < tempRangeEnd;
                                
                                let dayClass = "text-[#3C332D] hover:bg-[#FFF2EB] rounded-lg";
                                if (isSelectedStart || isSelectedEnd) {
                                  dayClass = "bg-[#B89B84] hover:bg-[#B89B84] text-white font-bold rounded-lg shadow-xs";
                                } else if (isInRange) {
                                  dayClass = "bg-[#FFF2EB] hover:bg-[#FFF2EB] text-[#B89B84] font-bold rounded-none";
                                }
                                
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    onClick={() => handleRangeDayClick(dateStr)}
                                    className={`py-2 transition font-mono relative text-xs font-bold flex items-center justify-center cursor-pointer ${dayClass}`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {/* Tips */}
                            <div className="text-[11px] text-[#8A7A6B] font-medium text-center select-none pt-2 border-t border-[#D8C6B8]">
                              {!tempRangeStart ? "💡 點選第一個日期作為【開始日期】" : !tempRangeEnd ? "💡 點選第二個日期作為【結束日期】" : "✅ 區間已選妥，可點擊日期重新選取"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="isCrossDay"
                          checked={isCrossDay}
                          disabled={isReadOnlyForm}
                          onChange={(e) => {
                            setIsCrossDay(e.target.checked);
                            if (!e.target.checked) setEndDate(selectedDate);
                          }}
                          className="h-4 w-4 rounded border-[#D8C6B8] focus:ring-[#B89B84] text-[#B89B84] cursor-pointer disabled:opacity-55"
                        />
                        <label htmlFor="isCrossDay" className="text-base font-bold text-[#6B4F3A] select-none cursor-pointer">
                          跨日行程（多天行程）
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">活動日期 *</label>
                        <input
                          type="date"
                          required
                          disabled={isReadOnlyForm}
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setEndDate(e.target.value);
                            setTempRangeStart(e.target.value);
                            setTempRangeEnd(e.target.value);
                          }}
                          className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 placeholder-[#A59487] text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] font-mono shadow-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="isCrossDay"
                          checked={isCrossDay}
                          disabled={isReadOnlyForm}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsCrossDay(checked);
                            if (!checked) {
                              setEndDate(selectedDate);
                              setTempRangeEnd(selectedDate);
                            } else {
                              try {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                const tomorrowStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                setEndDate(tomorrowStr);
                                setTempRangeEnd(tomorrowStr);
                                setShowRangePicker(true);
                              } catch (_) {}
                            }
                          }}
                          className="h-4 w-4 rounded border-[#D8C6B8] focus:ring-[#B89B84] text-[#B89B84] cursor-pointer disabled:opacity-55"
                        />
                        <label htmlFor="isCrossDay" className="text-base font-bold text-[#6B4F3A] select-none cursor-pointer">
                          跨日行程（多天行程）
                        </label>
                      </div>
                    </div>
                  )}

                  {isCrossDay && calcDurationDays(selectedDate, endDate) >= 3 && (
                    <div className="bg-[#FFFDFC] border border-[#D8C6B8] p-3.5 rounded-xl space-y-2 animate-in fade-in duration-200">
                      <div className="text-xs sm:text-[13px] leading-relaxed text-[#8A7A6B] font-bold">
                        💡 跨日行程已超過 2 天（共 <span className="font-extrabold text-[#B89B84]">{calcDurationDays(selectedDate, endDate)}</span> 天），建議將其快速轉換為「特別期間安排」，享受專屬一鍵管理！
                      </div>
                      {!isReadOnlyForm && (
                        <button
                          type="button"
                          onClick={handleQuickConvertToSpecialPeriod}
                          className="w-full text-center py-2 px-4 bg-[#FFFDFC] border border-[#D8C6B8] hover:bg-[#FFF2EB] text-[#6B4F3A] rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          ⚡ 快速建立為「特別期間安排」
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Fixed activity reference start date */}
                  <div>
                    <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">固定活動開始生效日期 *</label>
                    <input
                      type="date"
                      required
                      disabled={isReadOnlyForm}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                      }}
                      className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 placeholder-[#A59487] text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] font-mono shadow-xs"
                    />
                  </div>
                </div>
              )}

              {/* 6. 開始時間 & 結束時間 (grid) */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">開始時間</label>
                    <select
                      value={startTime}
                      disabled={isReadOnlyForm}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-3 py-2.5 cursor-pointer text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84]"
                    >
                      <option value="">選擇時間 (選填)</option>
                      {TIME_CHOICES.map((tc) => (
                        <option key={tc} value={tc}>
                          {tc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">結束時間</label>
                    <select
                      value={endTime}
                      disabled={isReadOnlyForm}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-3 py-2.5 cursor-pointer text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84]"
                    >
                      <option value="">選擇時間 (選填)</option>
                      {TIME_CHOICES.map((tc) => (
                        <option key={tc} value={tc}>
                          {tc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isReadOnlyForm && (
                  <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
                    <input
                      type="checkbox"
                      id="showFullTimeChoicesCheckbox"
                      checked={showFullTimeChoices}
                      onChange={(e) => setShowFullTimeChoices(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D8C6B8] focus:ring-[#B89B84] text-[#B89B84] accent-[#B89B84] cursor-pointer"
                    />
                    <label htmlFor="showFullTimeChoicesCheckbox" className="text-xs sm:text-sm font-bold text-[#8A7A6B] cursor-pointer select-none">
                      顯示 00:00 ~ 06:45 凌晨時段 (如旅遊、跨夜活動等)
                    </label>
                  </div>
                )}
              </div>

              {/* 7. 活動地點 */}
              <div className="space-y-1.5">
                <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">活動地點</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    disabled={isReadOnlyForm}
                    placeholder="請輸入地點 (例如：大安森林公園、畫畫教室)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 placeholder-[#A59487] text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] transition shadow-xs"
                  />
                  {location.trim() && (
                    <div className="flex justify-end animate-in fade-in duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
                          window.open(url, '_blank');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#6B4F3A] bg-[#FFFDFC] hover:bg-[#FFF2EB] border border-[#D8C6B8] rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        🗺 開啟地圖
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 8. 備註說明 */}
              <div className="space-y-1.5">
                <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">備註說明</label>
                <textarea
                  rows={2}
                  disabled={isReadOnlyForm}
                  placeholder="可在此輸入其它相關說明或備註..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 placeholder-[#A59487] text-[#3C332D] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] resize-none"
                />
              </div>

              {/* Daily contents planner for Cross Day events */}
              {isCrossDay && !isFixed && selectedDate && endDate && (
                <div className="border border-[#D8C6B8] bg-[#FFFDFC] p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => setIsDailyNotesExpanded(!isDailyNotesExpanded)}
                    className="w-full text-left flex items-center justify-between text-xs sm:text-sm font-bold text-[#6B4F3A] select-none cursor-pointer focus:outline-none"
                  >
                    <span className="flex items-center gap-1">
                      <span>📘</span> 每日內容規劃（{calcDurationDays(selectedDate, endDate)} 天）
                    </span>
                    <span className="text-[10px] sm:text-xs text-[#8A7A6B] bg-[#FFFDFC] border border-[#D8C6B8] px-2 py-0.5 rounded-md flex items-center gap-0.5 transition select-none shrink-0">
                      {isDailyNotesExpanded ? "收合 ↑" : "展開 ↓"}
                    </span>
                  </button>

                  {isDailyNotesExpanded && (
                    <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 border-t border-[#D8C6B8] pt-3 animate-in slide-in-from-top-1 duration-150">
                      {getDatesInRange(selectedDate, endDate).map((dateStr, idx) => {
                        const dayNum = idx + 1;
                        const dateDisplay = dateStr.replace(/-/g, "/").slice(5);
                        return (
                          <div key={dateStr} className="p-2.5 bg-[#FFF9F6] border border-[#D8C6B8] rounded-xl space-y-1.5 shadow-xs">
                            <div className="flex justify-between items-center text-[11px] font-bold text-[#6B4F3A]">
                              <span className="flex items-center gap-1 shrink-0">📘 第 {dayNum} 天 ({dateDisplay})</span>
                              <span className="text-[10px] font-mono text-gray-400 font-normal shrink-0">{dateStr}</span>
                            </div>
                            <input
                              type="text"
                              disabled={isReadOnlyForm}
                              placeholder={`例：Day${dayNum} 的詳細事項、活動大綱...`}
                              value={formDailyNotes[dateStr] || ""}
                              onChange={(e) => {
                                setFormDailyNotes({
                                  ...formDailyNotes,
                                  [dateStr]: e.target.value,
                                });
                              }}
                              className="w-full text-xs sm:text-sm border border-[#D8C6B8] rounded-lg px-2.5 py-1.5 bg-[#FFFDFC] focus:outline-none focus:border-[#B89B84] focus:ring-1 focus:ring-[#B89B84] font-bold"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 9. 公開設定 */}
              <div className="space-y-1.5">
                <label className="block text-base sm:text-[17px] font-bold text-[#6B4F3A] mb-1.5">公開設定</label>
                <select
                  value={isPublic ? "true" : "false"}
                  disabled={isReadOnlyForm}
                  onChange={(e) => setIsPublic(e.target.value === "true")}
                  className="w-full text-base font-bold border border-[#D8C6B8] bg-[#FFFDFC] rounded-xl px-4 py-3 focus:outline-none focus:border-[#B89B84] cursor-pointer text-[#3C332D]"
                >
                  <option value="true">🔓 公開 (家庭全員皆可見)</option>
                  <option value="false">🔒 私人 (僅自己與家庭管理員可見)</option>
                </select>
                {!isPublic && (
                  <p className="mt-2 text-xs sm:text-sm text-[#8A7A6B] bg-[#FFF2EB] border border-[#D8C6B8] rounded-xl p-3 font-bold leading-relaxed">
                    🔒 私人行程說明：勾選後僅建立者本人與家庭管理員可查看。其他家庭成員將完全無法看到此行程。
                  </p>
                )}
              </div>
            </div>

            {/* Footer (Fixed) */}
            <div className="p-4 md:p-6 border-t border-[#D8C6B8] flex justify-between items-center bg-[#FFF8F5] shrink-0 rounded-b-[24px]">
              {editingEvent && isUserAllowedToDelete(editingEvent) && !isReadOnlyForm ? (
                <button
                  type="button"
                  onClick={() => triggerDeleteConfirm(editingEvent)}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-full transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除日程
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                {!isReadOnlyForm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4.5 py-2 text-xs font-bold text-neutral-500 hover:bg-[#FFF2EB] border border-[#D8C6B8] rounded-full transition cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4.5 py-2 text-xs font-black text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-full transition disabled:opacity-50 cursor-pointer soft-journal-shadow"
                    >
                      {isSubmitting ? "正在儲存..." : editingEvent ? "確認修改" : "新增事項"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-2 text-xs font-black text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-full transition cursor-pointer soft-journal-shadow font-bold"
                  >
                    關閉
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {birthdayAlert && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl border border-[#EAA59E] p-6 max-w-sm w-full shadow-xl text-center space-y-4">
            <div className="h-12 w-12 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🎂
            </div>
            <div className="space-y-1">
              <h3 className="text-gray-900 font-extrabold text-base">{birthdayAlert.title}</h3>
              <p className="text-xs text-rose-600 font-bold bg-rose-[10px] px-2 py-0.5 rounded-full inline-block">
                🎈 系統自動事件
              </p>
            </div>
            <p className="text-xs text-gray-500 font-bold leading-relaxed">
              這是系統根據家庭成員 <span className="text-[#3C332D] font-extrabold">{birthdayAlert.memberName}</span> 的生日資料自動產生的事件，使用者不可手動修改或刪除。
            </p>
            <p className="text-[11px] text-[#5B7283] font-sans">
              💡 如需變更，請前往「家庭成員」修改其生日資料。
            </p>
            <button
              onClick={() => setBirthdayAlert(null)}
              className="w-full py-2 bg-[#F5E6E0] text-[#7C6354] hover:bg-[#EADCD4] text-xs font-black rounded-full transition cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* ✈️ MODE DETAILS DIRECT-CLICK MODAL */}
      {selectedModeForDetail && (() => {
        const { mode, dateStr } = selectedModeForDetail;
        
        // Calculate day count and total days
        let modeDayCount = 1;
        let totalDays = 1;
        try {
          const parseDateStr = (str: string) => {
            const parts = str.split("-");
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          };
          const startD = parseDateStr(mode.startDate);
          const clickD = parseDateStr(dateStr);
          const endD = parseDateStr(mode.endDate);
          modeDayCount = Math.floor((clickD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          totalDays = Math.floor((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        } catch (e) {
          // fallback
        }

        const isTravel = (mode.type as string) === "travel";
        const isExam = (mode.type as string) === "exam";
        const isVacation = (mode.type as string) === "vacation";
        const isCustom = (mode.type as string) === "custom";

        // Fetch travel day plan
        const dayPlan = isTravel ? mode.itinerary?.[dateStr] : null;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-[32px] max-w-xl w-full max-h-[90vh] overflow-y-auto soft-journal-shadow border border-[#EFEAE2] flex flex-col transition-all">
              {/* Header color accent */}
              <div className="h-4 w-full shrink-0"
                style={{
                  backgroundColor:
                    isTravel ? "#0066CC" : isExam ? "#B38600" : isVacation ? "#2E7D32" : "#3F51B5"
                }}
              />
              
              <div className="p-6 md:p-8 space-y-6">
                {/* Title and Icon */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5 bg-white">
                    <span className="text-4xl">
                      {isTravel ? "✈️" : isExam ? "📚" : isVacation ? "🏕️" : "🏠"}
                    </span>
                    <div>
                      <span className="text-[10px] tracking-widest uppercase font-black px-2.5 py-1 rounded text-white shadow-sm inline-block leading-none"
                        style={{
                          backgroundColor:
                            isTravel ? "#0066CC" : isExam ? "#B38600" : isVacation ? "#2E7D32" : "#3F51B5"
                        }}
                      >
                        {isTravel ? "旅遊中" : isExam ? "考試衝刺" : isVacation ? "假期生活" : "自訂模式"} · 第 {modeDayCount} 天
                      </span>
                      <h3 className="text-xl font-black text-[#3C332D] mt-2">
                         {mode.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                         📅 日期： {dateStr} （環境效期：{mode.startDate} ~ {mode.endDate}）
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedModeForDetail(null)}
                    className="h-8.5 w-8.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                     <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Substantive itinerary / details */}
                <div className="border-t border-dashed border-gray-200 pt-5 space-y-4">
                  {isTravel && (
                    <div className="space-y-6 font-sans">
                      {/* 自動顯示去程航班 (第一天旅程開始日) */}
                      {modeDayCount === 1 && (mode.departureAirline || mode.departureFlightNumber) && (
                        <div className="bg-[#FAF8F5] border-2 border-[#E9E4DB] rounded-2xl p-5 space-y-3.5 animate-fade-in shadow-sm relative overflow-hidden font-sans">
                          {/* Boarding pass styled decor */}
                          <div className="absolute right-4 top-2 text-[#E9E4DB] font-extrabold text-[10px] tracking-widest pointer-events-none select-none opacity-50">
                            BOARDING PASS / DEPARTURE
                          </div>
                          
                          <div className="font-extrabold text-[#7C6250] text-xs sm:text-sm flex items-center gap-1.5 pb-2 border-b border-dashed border-[#E3DCD0]">
                            <span>✈️</span> 去程航班
                          </div>
                          
                          <div className="space-y-2 pt-0.5">
                            <div className="text-sm font-black text-gray-800">
                              {mode.departureAirline || ""} {mode.departureFlightNumber || ""}
                            </div>
                            
                            <div className="text-xs font-bold text-[#7C6250] flex flex-wrap items-center gap-1">
                              <span>📍</span> {mode.departureAirport || "出發機場"}{mode.departureTerminal ? ` T${mode.departureTerminal}` : ""}
                              <span className="text-gray-400 font-extrabold mx-1">→</span>
                              <span>📍</span> {mode.departureArrivalAirport || "抵達機場"}
                            </div>

                            <div className="flex gap-4 pt-1 text-xs text-slate-600 font-bold">
                              {mode.departureTime && (
                                <div className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg">
                                  🛫 {mode.departureTime} 起飛
                                </div>
                              )}
                              {mode.departureArrivalTime && (
                                <div className="bg-indigo-50 text-indigo-850 px-2.5 py-1 rounded-lg">
                                  🛬 {mode.departureArrivalTime} 抵達
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 自動顯示回程航班 (最後一天旅程結束日) */}
                      {modeDayCount === totalDays && totalDays > 1 && (mode.returnAirline || mode.returnFlightNumber) && (
                        <div className="bg-[#F5F8FA] border-2 border-[#DCE4E9] rounded-2xl p-5 space-y-3.5 animate-fade-in shadow-sm relative overflow-hidden font-sans">
                          {/* Boarding pass styled decor */}
                          <div className="absolute right-4 top-2 text-[#DCE4E9] font-extrabold text-[10px] tracking-widest pointer-events-none select-none opacity-50">
                            BOARDING PASS / RETURN
                          </div>
                          
                          <div className="font-extrabold text-[#4A6076] text-xs sm:text-sm flex items-center gap-1.5 pb-2 border-b border-dashed border-[#DCE4E9]">
                            <span>✈️</span> 回程航班
                          </div>
                          
                          <div className="space-y-2 pt-0.5">
                            <div className="text-sm font-black text-gray-800">
                              {mode.returnAirline || ""} {mode.returnFlightNumber || ""}
                            </div>
                            
                            <div className="text-xs font-bold text-[#4A6076] flex flex-wrap items-center gap-1">
                              <span>📍</span> {mode.returnAirport || "出發機場"}{mode.returnTerminal ? ` T${mode.returnTerminal}` : ""}
                              <span className="text-gray-400 font-extrabold mx-1">→</span>
                              <span>📍</span> {mode.returnArrivalAirport || "抵達機場"}
                            </div>

                            <div className="flex gap-4 pt-1 text-xs text-slate-600 font-bold">
                              {mode.returnTime && (
                                <div className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg">
                                  🛫 {mode.returnTime} 起飛
                                </div>
                              )}
                              {mode.returnArrivalTime && (
                                <div className="bg-indigo-50 text-indigo-850 px-2.5 py-1 rounded-lg">
                                  🛬 {mode.returnArrivalTime} 抵達
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Simplified Travel Notebook Excel-like form */}
                      <div className="bg-white border border-orange-200 rounded-3xl p-6 space-y-4 shadow-sm font-sans">
                        <div className="text-[#8C7A6B] font-black text-xs md:text-sm border-b border-orange-100 pb-2 mb-2 select-none">
                          📋 每日行程與食宿精簡表:
                        </div>
                        
                        <div className="space-y-3.5 pl-1">
                          {/* Row 1: 早上行程 */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                              早上行程：
                            </span>
                            <input
                              id="travel-notebook-morning"
                              type="text"
                              value={editingItinerary?.morning || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, morning: e.target.value } : null)}
                              placeholder="輸入行程，例：搭飛機前往北海道..."
                              className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-805 transition-all focus:outline-none"
                            />
                          </div>

                          {/* Row 2: 下午行程 */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                              下午行程：
                            </span>
                            <input
                              id="travel-notebook-afternoon"
                              type="text"
                              value={editingItinerary?.afternoon || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, afternoon: e.target.value } : null)}
                              placeholder="輸入行程，例：小樽運河散步..."
                              className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-805 transition-all focus:outline-none"
                            />
                          </div>

                          {/* Row 3: 午餐安排 */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                              午餐安排：
                            </span>
                            <input
                              id="travel-notebook-lunch"
                              type="text"
                              value={editingItinerary?.lunch || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, lunch: e.target.value } : null)}
                              placeholder="輸入午餐，例：機場餐廳..."
                              className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-805 transition-all focus:outline-none"
                            />
                          </div>

                          {/* Row 4: 晚餐安排 */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                              晚餐安排：
                            </span>
                            <input
                              id="travel-notebook-dinner"
                              type="text"
                              value={editingItinerary?.dinner || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, dinner: e.target.value } : null)}
                              placeholder="輸入晚餐，例：海鮮丼飯..."
                              className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-805 transition-all focus:outline-none"
                            />
                          </div>

                          {/* Row 5: 住宿 */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                              住宿：
                            </span>
                            <input
                              id="travel-notebook-lodging"
                              type="text"
                              value={editingItinerary?.lodging || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, lodging: e.target.value } : null)}
                              placeholder="輸入住宿，例：札幌王子飯店..."
                              className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-805 transition-all focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isExam && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-[#7F5E00] text-sm">🎯 段考學習承諾與各科衝刺目標：</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {((mode as any).examSubjects || (mode as any).subjects || []).map((sub: any, idx: number) => (
                          <div key={idx} className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-black text-amber-950">{sub.name}</span>
                            <span className="text-xs bg-amber-100/80 text-[#7F5E00] font-bold px-3 py-1 rounded-xl">
                              {sub.target || "精熟精通"}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {((mode as any).notes || (mode as any).examNotes) && (
                        <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-dashed border-amber-200/80 text-xs text-amber-900">
                          💡 衝刺期重要提醒：{ (mode as any).notes || (mode as any).examNotes }
                        </div>
                      )}
                    </div>
                  )}

                  {isVacation && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-emerald-800 text-sm">🏕️ 假期每天生活自主打卡指標：</h4>
                      <div className="space-y-2">
                        {((mode as any).vacationDailyTasks || (mode as any).dailyTasks || []).map((task: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-emerald-50/40 border border-emerald-100/60 p-3 rounded-2xl">
                            <span className="h-6 w-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-black">
                               ✓
                            </span>
                            <span className="text-xs font-black text-emerald-950">{task.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}



                  {isCustom && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-indigo-800 text-sm">🎨 專專屬清單提醒小幫手：</h4>
                      <div className="space-y-2">
                        {((mode as any).customTasks || []).map((task: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-indigo-50/40 border border-indigo-100 p-3 rounded-2xl">
                            <span className="h-5 w-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-black">
                               📌
                            </span>
                            <span className="text-xs font-black text-indigo-950">{task.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coexisting general calendar events */}
                <div className="border-t border-dashed border-gray-200 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-[#3C332D] text-xs sm:text-sm flex items-center gap-1.5">
                      <span>📅</span> 當日一般行事曆行程與事件
                    </h4>
                    <span className="text-[10px] sm:text-[11px] text-[#A67C52] font-extrabold bg-[#FFF8F5] border border-[#EEDCD2] px-2 py-0.5 rounded-full">
                      與 {mode.name} 共存
                    </span>
                  </div>

                  {getEventsForDate(dateStr).length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-[#F2ECE5] bg-[#FFFDF8]/40 rounded-2xl">
                      <span className="text-xl block mb-1">🍵</span>
                      <p className="text-xs text-gray-400 font-bold">當天尚無一般行程安排，好愜意！</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {getEventsForDate(dateStr).map((evt) => {
                        const isBday = (evt as any).isBirthday;
                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setSelectedModeForDetail(null);
                              handleOpenEdit(evt, dateStr);
                            }}
                            className={`p-3 text-left flex flex-col gap-1 shadow-xs relative rounded-xl border cursor-pointer hover:opacity-90 transition-all ${getAppletEventStyleClasses(evt, isBday, dateStr, "month")}`}
                          >
                            <div className="flex items-center justify-between gap-1 overflow-hidden">
                              <span className="font-black text-xs text-[#3C332D] truncate block max-w-[75%]">
                                {getEventTitleWithPrefix(evt, isBday, dateStr)}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto shrink-0 select-none">
                                {evt.location && (
                                  <button
                                    type="button"
                                    title="開啟地圖"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location || "")}`, '_blank');
                                    }}
                                    className="text-[10px] hover:scale-120 active:scale-95 transition-transform p-0.5 cursor-pointer bg-white border border-[#EAA59E]/20 shadow-xs rounded-full inline-flex items-center justify-center w-4 h-4 ml-auto shrink-0 select-none animate-in fade-in"
                                  >
                                    📍
                                  </button>
                                )}
                                {isUserAllowedToDelete(evt) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerDeleteConfirm(evt, dateStr);
                                      setSelectedModeForDetail(null);
                                    }}
                                    className="text-gray-400 hover:text-red-500 p-0.5 rounded transition cursor-pointer hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {evt.time && (
                              <span className="text-[10px] font-mono font-extrabold text-gray-500 flex items-center gap-1">
                                🕐 {evt.time}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="border-t border-gray-100 pt-5">
                  {isTravel ? (
                    <div className="flex w-full items-center justify-between gap-3 font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModeForDetail(null);
                          handleOpenAdd(dateStr);
                        }}
                        className="bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 text-[#4F46E5] font-extrabold px-4.5 py-3 rounded-full text-xs flex items-center gap-1 cursor-pointer transition select-none"
                      >
                         ➕ 建立一般日曆行程
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedModeForDetail(null)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-5 py-3 rounded-full text-xs cursor-pointer transition select-none"
                        >
                           關閉
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveTravelItinerary}
                          disabled={isSavingTravel}
                          className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-extrabold px-6 py-3 rounded-full text-xs cursor-pointer transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 select-none"
                        >
                           {isSavingTravel ? "儲存更動..." : `💾 儲存 D${modeDayCount} 行程`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-3 font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModeForDetail(null);
                          handleOpenAdd(dateStr);
                        }}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold px-4 py-3 rounded-full text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                         ➕ 建立一般日行程事件
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedModeForDetail(null)}
                        className="bg-[#3C332D] hover:bg-[#2D2622] text-white font-extrabold px-6 py-3 rounded-full text-xs cursor-pointer transition shadow-sm"
                      >
                         關閉視窗
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⚠️ Prompt: Synchronize multi-day calendar event into a Special Period */}
      {promptSpecialPeriod && pendingAddPayload && (
        <div id="sync-special-modal" className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full shadow-2xl space-y-6 relative text-center">
            
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#EAA59E] block">
                跨日行程同步偵測
              </span>
              <h3 className="text-lg font-black text-[#3C332D]">
                📅 這是一個多日行程
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed px-2 font-medium">
                偵測到活動期間為 <span className="font-bold text-[#EAA59E] font-mono">{pendingAddPayload.startDate} ~ {pendingAddPayload.endDate}</span>，是否同步建立為 <span className="font-black text-[#A67C52] bg-[#FAF8F5] px-2 py-0.5 rounded-lg border border-[#EFEAE2]">特別期間安排</span>？
              </p>
            </div>

            <div className="space-y-3 font-sans">
              <button
                type="button"
                onClick={() => setChosenSpecialType("select-type")}
                className="w-full py-4 bg-[#6B859E] hover:bg-[#5C748B] text-white font-black rounded-2xl shadow-md transition hover:scale-[1.01] cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                🏕️ 建立特別期間安排 (推薦連結)
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    setErrorMessage(null);
                    // Standard calendar event adding
                    await onAddEvent(pendingAddPayload);
                    setSuccessToast({ show: true, title: pendingAddPayload.title });
                    setTimeout(() => setSuccessToast(null), 2500);
                    // Close all
                    setPromptSpecialPeriod(false);
                    setPendingAddPayload(null);
                    setShowAddForm(false);
                  } catch (err: any) {
                    console.error("Only normal error:", err);
                    setErrorMessage(err instanceof Error ? err.message : String(err));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full py-3 bg-[#FCFBF9] hover:bg-[#F2ECE0] text-[#5B493E] font-black rounded-2xl border border-gray-200 transition hover:scale-[1.01] cursor-pointer text-xs"
              >
                僅建立一般日曆多日行程
              </button>

              <button
                type="button"
                onClick={() => {
                  setPromptSpecialPeriod(false);
                  setPendingAddPayload(null);
                }}
                className="w-full py-2 text-center text-xs font-bold text-gray-400 hover:text-gray-500 transition cursor-pointer"
              >
                先不要 (取消建立)
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-bold text-left border border-red-100">
                🚨 錯誤：{errorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏕️ Choose Special Period Type popup */}
      {chosenSpecialType === "select-type" && pendingAddPayload && (
        <div id="choose-special-type-modal" className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full shadow-2xl space-y-6 text-center">
            
            <div className="space-y-1.5 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5B7283] block">
                SPECIAL PERIOD TYPE
              </span>
              <h3 className="text-base font-black text-gray-900">
                請選擇特別期間類型：
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                這將同步開展特定生活作息與客製加成機制：
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 font-sans">
              {[
                { label: "✈️ 我們要去旅遊了", val: "travel", type: SystemMode.TRAVEL, icon: "✈️", color: "orange" },
                { label: "📚 要考試了", val: "exam", type: SystemMode.EXAM, icon: "📚", color: "yellow" },
                { label: "🏖 放暑假了", val: "vacation", type: SystemMode.VACATION, icon: "🏖", color: "green", customType: "放暑假了" },
                { label: "🎒 夏令營", val: "camp", type: SystemMode.VACATION, icon: "🎒", color: "green", customType: "夏令營" },
                { label: "🏡 其他家庭安排", val: "custom", type: SystemMode.CUSTOM, icon: "🏡", color: "indigo", customType: "其他家庭安排" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setErrorMessage(null);
                      
                      const spId = `sp_${Math.random().toString(36).substr(2, 9)}`;
                      const specialPeriodObj: ConfiguredMode = {
                        id: spId,
                        type: opt.type,
                        name: pendingAddPayload.title,
                        icon: opt.icon,
                        color: opt.color,
                        startDate: pendingAddPayload.startDate,
                        endDate: pendingAddPayload.endDate,
                        createdAt: new Date(),
                        ...(opt.customType ? { vacationType: opt.customType } : {}),
                        ...(opt.type === SystemMode.TRAVEL ? { travelType: "international" } : {}),
                      };

                      if (onSaveConfiguredMode) {
                        await onSaveConfiguredMode(specialPeriodObj);
                      }

                      // Link calendar event with specialPeriodId
                      const linkedPayload = {
                        ...pendingAddPayload,
                        specialPeriodId: spId,
                      };

                      await onAddEvent(linkedPayload);

                      setSuccessToast({ show: true, title: pendingAddPayload.title, specialCreated: true });
                      setTimeout(() => setSuccessToast(null), 2500);

                      // Clear out
                      setPromptSpecialPeriod(false);
                      setChosenSpecialType(null);
                      setPendingAddPayload(null);
                      setShowAddForm(false);
                    } catch (err: any) {
                      console.error("Link adding error:", err);
                      setErrorMessage(err instanceof Error ? err.message : String(err));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full text-left py-3.5 px-5 bg-[#FFFDF9] hover:bg-[#FAF6EE] text-gray-700 font-extrabold border border-[#EFEAE2] rounded-2xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-between"
                >
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-gray-400">➔</span>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setChosenSpecialType(null)}
                className="text-xs font-bold text-gray-400 hover:text-gray-500 cursor-pointer"
              >
                返回上一步
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-bold text-left border border-red-100">
                🚨 錯誤：{errorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎉 Smooth Success Toast message overlay */}
      {successToast && (
        <div id="success-toast" className="fixed bottom-6 right-6 z-50 bg-[#344] text-white p-4.5 rounded-2xl flex items-center gap-3.5 shadow-2xl border border-gray-100/15 animate-in slide-in-from-bottom-4 duration-200 font-sans">
          <div className="h-9 w-9 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg shadow-sm font-black">
            ✓
          </div>
          <div className="space-y-0.5 text-left">
            <h4 className="text-xs font-black text-white">
              {(successToast as any).isDeleted ? "✅ 行程已刪除" : "日曆更新完成！"}
            </h4>
            <p className="text-[10.5px] text-gray-300 font-bold max-w-xs truncate">
              {(successToast as any).isDeleted 
                ? `您已成功刪除行程「${successToast.title}」。`
                : `已經作業成功，更新行程「${successToast.title}」。`}
            </p>
            {successToast.specialCreated && (
              <p className="text-[10px] text-emerald-400 font-black">
                ✨ 並且也已自動配置對應的【特別期間安排】
              </p>
            )}
          </div>
        </div>
      )}

      {/* 📱 PORTABLE POPUP DIALOG (DRILL-IN AGENDA DETAIL) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 font-sans md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsDrawerOpen(false)}
          />
          {/* Content (centered modal dialog) */}
          <div className="relative w-full max-w-sm bg-white rounded-[24px] shadow-2xl border border-[#EFEAE2] flex flex-col max-h-[75vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 text-[#3C332D]">
            <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-[#F2ECE5] shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-black text-[#3C332D] flex items-center gap-1.5">
                  <span>📅</span> {selectedMobileMonthDayStr} 行程明細
                </h3>
                {(() => {
                  const holiday = getHolidayForDate(selectedMobileDate);
                  const activeMode = getActiveModeForDate(selectedMobileDate);
                  return (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {holiday && (
                        <span className="inline-block text-[9px] bg-[#FFEBEB] text-[#E53935] border border-[#FFD5D4] px-1.5 py-0.5 rounded font-bold">
                          {holiday.emoji} {holiday.name}
                        </span>
                      )}
                      {activeMode && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDrawerOpen(false);
                            setSelectedModeForDetail({ mode: activeMode, dateStr: selectedMobileDate });
                          }}
                          className="inline-block text-[10px] bg-sky-50 text-sky-800 border-2 border-sky-200 hover:bg-sky-100 px-2 py-0.5 rounded font-black cursor-pointer shadow-sm transition select-none flex items-center gap-0.5"
                        >
                          🏕️ {activeMode.name} (查看詳情)
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-extrabold text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable container section with safety padding at bottom to avoid blocking by sticky footer button */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-32">
              {getEventsForDate(selectedMobileDate).length === 0 ? (
                <div className="py-8 text-center border border-dashed border-[#EFEAE2] rounded-2xl bg-white/40">
                  <span className="text-2xl block mb-1">🍵</span>
                  <p className="text-xs text-gray-400 font-black font-sans">當天沒有任何行程安排，好愜意！</p>
                </div>
              ) : (
                <div className="space-y-2.5 font-sans">
                  {getEventsForDate(selectedMobileDate).map((evt) => {
                    const isBday = (evt as any).isBirthday;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setIsDrawerOpen(false); // Close first to prevent overlap
                          handleOpenEdit(evt, selectedMobileDate);
                        }}
                        className={`p-3.5 text-left flex flex-col gap-1.5 shadow-xs relative cursor-pointer hover:opacity-90 transition-all ${getAppletEventStyleClasses(evt, isBday, selectedMobileDate, "month")}`}
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <span className="font-black text-sm md:text-base text-[#3C332D] truncate block max-w-[70%]">
                            {getEventTitleWithPrefix(evt, isBday, selectedMobileDate)}
                          </span>
                          
                          {evt.location && (
                            <button
                              type="button"
                              title="開啟地圖"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location || "")}`, '_blank');
                              }}
                              className="text-[10px] hover:scale-120 active:scale-95 transition-transform p-0.5 cursor-pointer bg-white border border-[#EAA59E]/20 shadow-xs rounded-full inline-flex items-center justify-center w-5 h-5 ml-auto shrink-0 select-none"
                            >
                              📍
                            </button>
                          )}
                          
                          {isUserAllowedToDelete(evt) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerDeleteConfirm(evt, selectedMobileDate);
                              }}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {evt.time && (
                          <span className="text-xs font-mono font-extrabold text-gray-550 flex items-center gap-1">
                            🕐 {evt.time}
                          </span>
                        )}

                        {isMultiDayEvent(evt) && evt.startDate && evt.endDate && (
                          <span className="text-[9px] bg-sky-50 text-sky-850 border border-sky-100 rounded px-1.5 py-0.2 font-bold self-start font-mono">
                            跨日行程 · 第 {getMultiDayLabel(evt.startDate, evt.endDate, selectedMobileDate).dayIndex} 天
                          </span>
                        )}

                        {evt.dailyNotes?.[selectedMobileDate] && (
                          <div className="text-[10px] text-[#004B8F] font-bold bg-[#E1F0FF]/55 border border-sky-150 rounded-lg px-2 py-1">
                            📝 {evt.dailyNotes[selectedMobileDate]}
                          </div>
                        )}

                        {evt.location && (
                          <div className="text-[10.5px] md:text-[11px] font-sans font-bold text-amber-900 border border-amber-900/10 bg-amber-50/15 px-1.5 py-0.5 rounded flex items-center gap-1 mt-0.5 truncate max-w-full text-left self-start select-none">
                            <span>📍</span>
                            <span className="truncate">{evt.location}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ➕ Sticky Footer for Adding Event */}
            {canCreateCalendar && (
              <div 
                className="shrink-0 border-t border-[#F2ECE5] bg-[#FFFDF8] px-5 py-4 z-30 shadow-sm relative rounded-b-[24px]"
              >
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    handleOpenAdd(selectedMobileDate);
                  }}
                  className="w-full py-3.5 bg-[#EAA59E] hover:bg-[#D98E85] text-white text-sm font-black rounded-2xl shadow-sm transition active:scale-97 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>➕</span> 新增行程
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Choice Modal for adding General Event vs. Travel Mode */}
      {showAddTypeSelection && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full soft-journal-shadow relative space-y-6 text-center">
            <button
              type="button"
              onClick={() => setShowAddTypeSelection(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition cursor-pointer p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1.5 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#A67C52] block">
                行程建立選項 / {showAddTypeSelection.dateStr}
              </span>
              <h3 className="text-base font-black text-[#3C332D]">
                選擇要新增的類型
              </h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                您可以新增一般單日/跨日日曆事件，或直接安排家庭旅遊計畫：
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 font-sans">
              <button
                type="button"
                onClick={() => {
                  const dateStr = showAddTypeSelection.dateStr;
                  setShowAddTypeSelection(null);
                  handleOpenAdd(dateStr);
                }}
                className="w-full py-4 bg-[#FFFDF8] hover:bg-[#FAF6FF] text-[#5B7283] border border-[#EFEAE2] font-black rounded-2xl shadow-sm transition hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>➕</span> 新增一般行程 / 事件
              </button>

              <button
                type="button"
                className="w-full py-4 bg-[#EAA59E] hover:bg-[#D98E85] text-white font-black rounded-2xl shadow-sm transition hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer text-sm"
                onClick={() => {
                  const dateStr = showAddTypeSelection.dateStr;
                  setShowAddTypeSelection(null);
                  setNewTravelName("");
                  setNewTravelStartDate(dateStr);
                  setNewTravelEndDate(dateStr);
                  setNewTravelType("international");
                  setShowCreateTravelModal({ startDate: dateStr, endDate: dateStr });
                }}
              >
                <span>✈️</span> 新增旅遊行程安排
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✈️ Custom Travel Mode Creator Modal */}
      {showCreateTravelModal && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] max-w-md w-full soft-journal-shadow relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-[#EFEAE2] flex items-center justify-between bg-[#FFFDF8] rounded-t-[24px]">
              <h3 className="text-lg font-black text-[#3C332D] flex items-center gap-2">
                <span>✈️</span> 建立家庭旅遊行程
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTravelModal(null)}
                className="text-gray-400 hover:text-gray-700 transition cursor-pointer p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#5B7283] mb-1.5">旅遊活動名稱</label>
                <input
                  type="text"
                  required
                  placeholder="請輸入旅遊活動名稱 (例如：沖繩暑假自駕五日遊)"
                  value={newTravelName}
                  onChange={(e) => setNewTravelName(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#5B7283] mb-1.5">起始日期</label>
                  <input
                    type="date"
                    required
                    value={newTravelStartDate}
                    onChange={(e) => setNewTravelStartDate(e.target.value)}
                    className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5B7283] mb-1.5">結束日期</label>
                  <input
                    type="date"
                    required
                    value={newTravelEndDate}
                    onChange={(e) => setNewTravelEndDate(e.target.value)}
                    className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B7283] mb-1.5">旅遊範圍</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewTravelType("international")}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      newTravelType === "international"
                        ? "bg-[#DAEFFF] text-[#0066CC] border-[#0066CC]"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-55"
                    }`}
                  >
                    🌏 國外旅遊/出國
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTravelType("domestic")}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      newTravelType === "domestic"
                        ? "bg-[#FFF4E6] text-[#D97706] border-[#D97706]"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-55"
                    }`}
                  >
                    🚗 國內旅遊/近郊
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[11px] leading-relaxed text-amber-900 font-bold">
                  💡 貼心地建立後：您可以於各旅遊日期，直接點選行事曆以隨時編輯各天之【每日主題、餐食規劃、時段活動、機票交通與筆記】，享受全家人的旅遊手冊！
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#EFEAE2] flex justify-end gap-3 bg-[#FFFDF8] rounded-b-[24px]">
              <button
                type="button"
                onClick={() => setShowCreateTravelModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!newTravelName.trim()) {
                      alert("請輸入旅遊目的地或名稱！");
                      return;
                    }
                    if (!newTravelStartDate || !newTravelEndDate) {
                      alert("請填寫旅遊日期！");
                      return;
                    }
                    if (newTravelStartDate > newTravelEndDate) {
                      alert("結束日期不可小於起始日期！");
                      return;
                    }
                    if (!onSaveConfiguredMode) {
                      alert("資料儲存器未就緒！");
                      return;
                    }

                    const spId = `sp_${Math.random().toString(36).substr(2, 9)}`;
                    const travelModeObj: ConfiguredMode = {
                      id: spId,
                      type: SystemMode.TRAVEL,
                      name: newTravelName.trim(),
                      icon: "✈️",
                      color: "orange",
                      startDate: newTravelStartDate,
                      endDate: newTravelEndDate,
                      travelType: newTravelType,
                      createdAt: new Date(),
                      itinerary: {},
                    };

                    await onSaveConfiguredMode(travelModeObj);
                    setShowCreateTravelModal(null);
                    // Open the travel detailed notebook immediately!
                    setSelectedModeForDetail({ mode: travelModeObj, dateStr: newTravelStartDate });
                  } catch (err: any) {
                    alert("建立旅遊行程失敗: " + err.message);
                  }
                }}
                className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-extrabold px-6 py-2.5 rounded-full text-xs cursor-pointer transition shadow-xs"
              >
                💾 建立並編輯行程內容
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
