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
    return `🎂 ${(evt as any).birthdayMemberName} ${(evt as any).birthdayAge}歲生日`;
  }
  const emoji = getEventEmoji(evt.title);
  if (isMultiDayEvent(evt) && currentDateStr && evt.startDate && evt.endDate) {
    const info = getMultiDayLabel(evt.startDate, evt.endDate, currentDateStr);
    return `${emoji} ${evt.title} Day${info.dayIndex}`;
  }
  return `${emoji} ${evt.title}`;
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
  
  const title = evt.title || "";
  const matchesSpecialPeriod =
    title.includes("旅行") || title.includes("旅遊") || title.includes("模式") ||
    title.includes("出遊") || title.includes("考試") || title.includes("期中考") ||
    title.includes("期末考") || title.includes("寒假") || title.includes("暑假") ||
    title.includes("放假");
    
  if (matchesSpecialPeriod) {
    if (title.includes("旅") || title.includes("出遊")) {
      return "border border-orange-200 bg-[#FFF9F5] text-[#D35400] hover:bg-orange-50/80 shadow-sm rounded-xl";
    } else if (title.includes("考") || title.includes("試")) {
      return "border border-amber-300 bg-[#FFFDF5] text-[#825615] hover:bg-amber-50/80 shadow-sm rounded-xl";
    } else if (title.includes("寒假") || title.includes("暑假") || title.includes("放") || title.includes("假")) {
      return "border border-emerald-200 bg-[#F7FCF9] text-emerald-850 hover:bg-emerald-50/80 shadow-sm rounded-xl";
    }
  }

  // 1. 每週重複行程 (isFixed == true): 【晨霧藍色】
  if (evt.isFixed) {
    return "border border-[#D2E2EC] bg-[#F4F8FA] hover:bg-[#EAF3F7] text-[#1E3A54] shadow-sm rounded-xl";
  }

  // 2. 私人專屬行程 (!isPublic): 【柔粉橘色】
  if (!evt.isPublic) {
    return "border border-[#FAD6C5] bg-[#FFF5F0] hover:bg-[#FFEAE0] text-[#7A3A23] shadow-sm rounded-xl";
  }

  // 3. 家庭公共事項 / 其他 (isPublic && !isFixed): 【淺米香檳色】
  return "border border-[#E7E2D8] bg-[#F7F5F0] hover:bg-[#F2ECE0] text-[#3C332D] rounded-xl";
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

  const [viewType, setViewType] = useState<"list" | "month" | "week">("list");
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(todayDateStr);
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
    return allEvents.filter((e) => {
      if (e.isFixed) {
        if (e.exceptionDates?.includes(dateStr)) return false;
        if (e.startDate && dateStr < e.startDate) return false;
        if (e.endDate && dateStr > e.endDate) return false;
        const [y, m, d] = dateStr.split("-").map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        return e.weekdays?.includes(dow);
      }
      if (e.startDate && e.endDate) {
        return dateStr >= e.startDate && dateStr <= e.endDate;
      }
      return e.date === dateStr;
    });
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

        list.push({
          id: `birthday-${member.uid || Math.random()}-${genYear}`,
          familyId: member.familyId || "",
          title: `🎂 ${member.displayName} ${age}歲生日`,
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
        } as any);
      });
    });

    return list;
  }, [events, familyMembers, currentDate]);

  // Form State
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isFixed, setIsFixed] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedFavId, setSelectedFavId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

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
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      for (let m = 0; m < 60; m += 15) {
        const mm = String(m).padStart(2, "0");
        list.push(`${hh}:${mm}`);
      }
    }
    return list;
  }, []);

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
    setIsFixed(false);
    setWeekdays([]);
    setNote("");
    setIsPublic(true);
    setSelectedFavId("");
    setSaveAsFav(false);
    setIsCrossDay(false);
    setEndDate(dateStr);
    setFormDailyNotes({});
    setIsDailyNotesExpanded(false);

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
    setIsFixed(evt.isFixed || false);
    setWeekdays(evt.weekdays || []);
    setNote(evt.note || "");
    setIsPublic(evt.isPublic !== false);
    setSelectedFavId("");
    if (evt.time && evt.time.includes("~") && evt.time !== "~") {
      const [start, end] = evt.time.split("~");
      setStartTime(start || "");
      setEndTime(end || "");
    } else {
      setStartTime("");
      setEndTime("");
    }
    
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

    const payload = {
      title: title.trim(),
      date: isFixed ? "" : selectedDate,
      time: (startTime && endTime) ? `${startTime}~${endTime}` : "",
      isFixed,
      weekdays: isFixed ? weekdays : [],
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
          time: (startTime && endTime) ? `${startTime}~${endTime}` : "",
          category: "",
          isFixed,
          weekdays: isFixed ? weekdays : [],
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

  const isUserAllowedToDelete = (evt: CalendarEvent) => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT) {
      return true;
    }
    return currentUser.role === UserRole.KID && !evt.isPublic && evt.creatorUid === currentUser.uid;
  };

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
    <div id="calendar-module" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className="w-full max-w-full bg-transparent md:bg-white md:rounded-[24px] md:border md:border-[#EFEAE2] p-2 md:p-6 lg:p-8 md:soft-journal-shadow space-y-3 md:space-y-6">
      
      {/* Calendar header controls - Sticky top below primary app navigation bar */}
      <div className="sticky top-[48px] md:top-[74px] bg-white z-30 py-2.5 md:py-3 border-b border-[#EFEAE2]/60 flex flex-col md:flex-row justify-between items-center gap-3">
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
            className="text-xs md:text-sm font-black px-3.5 py-2 bg-[#F7F3EB] text-[#5B7283] border border-[#EFEAE2] rounded-full hover:bg-white transition cursor-pointer"
          >
            📍 今天
          </button>
        </div>

        {/* Calendar View Toggle switches - 3 Tabs for Mobile, beautifully horizontal & scrollable */}
        <div className="flex items-center gap-1 p-1 bg-[#FFFDF8] border border-[#EFEAE2] rounded-full font-sans w-full md:w-auto justify-between md:justify-start overflow-x-auto scrollbar-none animate-in fade-in">
          <button
            onClick={() => setViewType("list")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "list"
                ? "bg-amber-100 text-amber-800 border border-amber-200 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-[#F7F3EB]"
            }`}
          >
            列表
          </button>
          <button
            onClick={() => setViewType("month")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "month"
                ? "bg-amber-100 text-amber-800 border border-amber-200 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-[#F7F3EB]"
            }`}
          >
            月曆
          </button>
          <button
            onClick={() => setViewType("week")}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-black transition rounded-full cursor-pointer whitespace-nowrap ${
              viewType === "week"
                ? "bg-amber-100 text-amber-800 border border-amber-200 shadow-sm"
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
            <button
              onClick={() => handleOpenAdd(todayDateStr)}
              className="text-xs font-black bg-[#EAA59E] hover:bg-[#D98E85] text-white px-4 py-2 rounded-full transition shadow-xs"
            >
              + 新增本日行程
            </button>
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
                    <button
                      onClick={() => handleOpenAdd(todayDateStr)}
                      className="mt-3 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-4 py-2 rounded-full transition font-black"
                    >
                      ＋ 建立第一個行程
                    </button>
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
                        ? "bg-[#FFE9EF]/55 text-rose-700 border border-rose-100/50" 
                        : "bg-[#FFFDFB]/85 text-[#3C332D]"
                    }`}>
                      <span className="font-mono">
                        {formatListDayHeader(dayCell.dateStr)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full select-none animate-pulse">
                          今天
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
        <div id="monthly-view-wrapper" className="w-full border-0 md:border md:border-[#EFEAE2] rounded-none md:rounded-[24px] overflow-hidden bg-white shadow-none md:soft-journal-shadow select-none">
          {/* Weekday headers - small and elegant */}
          <div className="grid grid-cols-7 bg-[#FFFDF8] border-b border-[#EFEAE2] text-center py-2.5 md:py-3.5 text-[10px] md:text-sm font-black text-[#5B7283] tracking-wide">
            <div>週日</div>
            <div>週一</div>
            <div>週二</div>
            <div>週三</div>
            <div>週四</div>
            <div>週五</div>
            <div>週六</div>
          </div>

          <div className="grid grid-cols-7 border-collapse">
            {monthDays.map((cell, idx) => {
              const dayEvents = allEvents.filter((e) => {
                if (e.isFixed) {
                  if (e.exceptionDates?.includes(cell.dateStr)) return false;
                  if (e.startDate && cell.dateStr < e.startDate) return false;
                  if (e.endDate && cell.dateStr > e.endDate) return false;
                  const [y, m, d] = cell.dateStr.split("-").map(Number);
                  const dow = new Date(y, m - 1, d).getDay();
                  return e.weekdays?.includes(dow);
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
                // Today: light pink background instead of thick red borders, satisfying design rules
                cellBg = "bg-[#FFE9EF]/45";
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
                    if (window.innerWidth < 768) {
                      setSelectedMobileDate(cell.dateStr);
                      setIsDrawerOpen(true);
                    } else {
                      if (activeMode) {
                        setSelectedModeForDetail({ mode: activeMode, dateStr: cell.dateStr });
                      } else {
                        handleOpenAdd(cell.dateStr);
                      }
                    }
                  }}
                  className={`min-h-[80px] h-[80px] md:min-h-[160px] md:h-auto p-1 md:p-2.5 border-r border-b border-[#EFEAE2]/60 flex flex-col justify-between transition group hover:bg-[#FFFDF8]/90 cursor-pointer overflow-hidden ${cellBg}`}
                >
                  {/* MOBILE VIEW COMPACT CELL */}
                  <div className="block md:hidden text-left flex flex-col justify-between h-full w-full overflow-hidden">
                    <div className="flex justify-between items-center select-none">
                      <span
                        className={`text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center font-mono ${
                          isToday
                            ? "bg-rose-100 text-rose-600 font-extrabold"
                            : cell.isWeekend
                            ? "text-[#3C332D]/70"
                            : "text-[#3C332D]"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {holiday && (
                        <span className="text-[10px]" title={holiday.name}>
                          {holiday.emoji}
                        </span>
                      )}
                    </div>
                    
                    {/* Compact Events in date slot */}
                    <div className="flex-1 flex flex-col justify-end overflow-hidden space-y-0.5 mt-1 pb-0.5 select-none">
                      {(() => {
                        const limit = 2;
                        const displayedEvents = sortedDayEvents.slice(0, limit);
                        const hiddenCount = sortedDayEvents.length - limit;
                        return (
                          <>
                            {displayedEvents.map((evt) => {
                              const cleanTitle = cleanTitleForMobileCell(evt, cell.dateStr);
                              return (
                                <div
                                  key={evt.id}
                                  className="text-[8px] leading-[9.5px] py-[1px] px-[2px] font-bold truncate rounded bg-white/70 border border-gray-150 text-[#3C332D] tracking-tight"
                                >
                                  {cleanTitle}
                                </div>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <div className="text-[7.5px] text-gray-400 font-extrabold text-right pr-0.5 tracking-tighter leading-none mt-0.5">
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
                      <span
                        className={`text-sm font-black rounded-full h-7.5 w-7.5 flex items-center justify-center font-mono ${
                          isToday
                            ? "bg-[#EAA59E] text-white shadow-xs font-extrabold"
                            : cell.isWeekend
                            ? holiday
                               ? "text-amber-800 font-extrabold"
                               : "text-[#3C332D]/74"
                            : "text-[#3C332D]"
                        }`}
                      >
                        {cell.day}
                      </span>

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

                      {isToday && !holiday && !activeMode && (
                        <span className="text-[9px] font-sans font-black text-[#EAA59E] bg-white border border-[#EAA59E]/30 px-2 py-0.5 rounded-full scale-90 animate-pulse">
                          今天
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
                      <div className="text-[10.5px] font-semibold py-1 px-2 rounded-xl truncate shrink-0 font-sans flex items-center gap-1.5 mt-1.5"
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
                        <span>
                          {activeMode.type === "travel"
                            ? "✈️"
                            : activeMode.type === "exam"
                            ? "📚"
                            : activeMode.type === "vacation"
                            ? "🏕️"
                            : "🏠"}
                        </span>
                        <span className="truncate font-black">{activeMode.name}</span>
                      </div>
                    )}

                    <div className="flex-grow space-y-1.5 mt-2.5 overflow-hidden">
                      {sortedDayEvents.map((evt) => {
                        const isBday = (evt as any).isBirthday;
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(evt, cell.dateStr);
                            }}
                            className={`relative flex flex-col p-2 transition hover:translate-y-[-1px] group/item cursor-pointer text-xs font-bold leading-tight ${getAppletEventStyleClasses(evt, isBday, cell.dateStr, "month")}`}
                          >
                            <div className="flex items-center justify-between gap-1 overflow-hidden">
                              <span className="truncate whitespace-nowrap overflow-hidden block max-w-[85%] font-sans font-extrabold text-[#3C332D]">
                                {getEventTitleWithPrefix(evt, isBday, cell.dateStr)}
                              </span>
                              {isUserAllowedToDelete(evt) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerDeleteConfirm(evt, cell.dateStr);
                                  }}
                                  className="hidden group-hover/item:inline-block text-gray-400 hover:text-red-500 p-0.5 ml-auto cursor-pointer transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {evt.dailyNotes?.[cell.dateStr] && (
                              <div className="text-[10px] text-[#004B8F] font-bold bg-[#E1F0FF]/45 border border-sky-150 rounded px-1.5 py-0.5 mt-1 truncate max-w-full text-left font-sans self-start">
                                📝 {evt.dailyNotes[cell.dateStr]}
                              </div>
                            )}
                            {evt.time && (
                              <span className="text-[10px] font-mono font-bold text-[#5B7283] mt-1 flex items-center gap-0.5">
                                🕒 {evt.time}
                              </span>
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

          {/* MOBILE DETAILED DATE AGENDA */}
          <div className="block md:hidden border-t border-[#EFEAE2]/60 p-4 space-y-4 font-sans bg-[#FCFBF9]">
            <div className="flex justify-between items-center bg-white border border-[#EFEAE2] p-3 rounded-2xl shadow-xs">
              <div>
                <h3 className="text-xs font-black text-[#3C332D] flex items-center gap-1.5">
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
                        <span className="inline-block text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded font-bold">
                          ★ {activeMode.name}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              <button
                onClick={() => handleOpenAdd(selectedMobileDate)}
                className="text-xs font-black bg-[#EAA59E] text-white px-3 py-1.5 rounded-full hover:bg-[#D98E85] transition"
              >
                + 新增行程
              </button>
            </div>

            {getEventsForDate(selectedMobileDate).length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[#EFEAE2] rounded-2xl bg-white/40">
                <span className="text-2xl block mb-1">🍵</span>
                <p className="text-xs text-gray-400 font-semibold font-sans">當天沒有任何行程安排，好愜意！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getEventsForDate(selectedMobileDate).map((evt) => {
                  const isBday = (evt as any).isBirthday;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => handleOpenEdit(evt, selectedMobileDate)}
                      className={`p-4 rounded-2xl border text-left flex flex-col gap-2 shadow-xs relative cursor-pointer hover:bg-gray-55 transition-all duration-250 ${
                        isBday ? "bg-rose-50/50 border-rose-200 text-rose-700" : "bg-white border-[#EFEAE2]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 overflow-hidden">
                        <span className="font-extrabold text-sm text-[#3C332D] truncate block max-w-[85%]">
                          {getEventTitleWithPrefix(evt, isBday, selectedMobileDate)}
                        </span>
                        
                        {isUserAllowedToDelete(evt) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDeleteConfirm(evt, selectedMobileDate);
                            }}
                            className="text-gray-400 hover:text-red-500 p-1 rounded transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {evt.time && (
                        <span className="text-xs font-mono font-bold text-gray-500 flex items-center gap-1">
                          🕐 {evt.time}
                        </span>
                      )}

                      {isMultiDayEvent(evt) && evt.startDate && evt.endDate && (
                        <span className="text-[10px] bg-sky-50 text-sky-850 border border-sky-100 rounded px-2 py-0.5 font-bold self-start mt-0.5 font-mono">
                          📚 跨日行程 · 第 {getMultiDayLabel(evt.startDate, evt.endDate, selectedMobileDate).dayIndex} 天 / 共 {getMultiDayLabel(evt.startDate, evt.endDate, selectedMobileDate).totalDays} 天
                        </span>
                      )}

                      {evt.dailyNotes?.[selectedMobileDate] && (
                        <div className="text-xs text-[#004B8F] font-bold bg-[#E1F0FF]/55 border border-sky-150 rounded-xl px-2.5 py-1.5 font-sans mt-0.5 self-start">
                          📝 {evt.dailyNotes[selectedMobileDate]}
                        </div>
                      )}

                      <div className="text-[10px] text-gray-400 font-bold flex items-center justify-between mt-1">
                        <span>{evt.isPublic ? "🔓 家庭公開" : "🔒 私人行程"}</span>
                        {evt.creatorName && <span>由 {evt.creatorName} 建立</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly View Grid */}
      {viewType === "week" && (
        <div id="weekly-view-wrapper" className="border border-[#EFEAE2] rounded-[24px] overflow-hidden soft-journal-shadow bg-white">
          {/* DESKTOP HEADER ROW */}
          <div className="hidden md:grid grid-cols-7 bg-[#FFFDF8] border-b border-[#EFEAE2] text-center py-4 text-xs font-black text-[#5B7283] tracking-wide select-none">
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
                    <div className={`text-sm mt-0.5 font-mono inline-block ${wd.isToday ? "bg-[#EAA59E] text-white rounded-full px-2.5 py-0.5 font-extrabold shadow-sm" : ""}`}>
                      {wd.day} 日
                    </div>
                  </div>
                  {activeMode && (
                    <div className="text-[10px] w-full p-1 rounded-lg font-bold font-sans mt-2 space-y-0.5 leading-tight truncate select-none shadow-sm"
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
          <div className="hidden md:grid grid-cols-7 min-h-[400px]">
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
                cellBg = "bg-[#FFE8EF]/40 ring-1 ring-[#EAA59E] ring-inset";
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
                    if (activeMode) {
                      setSelectedModeForDetail({ mode: activeMode, dateStr: cell.dateStr });
                    } else {
                      handleOpenAdd(cell.dateStr);
                    }
                  }}
                  className={`p-4 border-r border-[#EFEAE2] flex flex-col justify-between hover:bg-[#FFFDF8]/60 cursor-pointer min-h-[350px] transition ${cellBg}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-[#5B7283] bg-white border border-[#EFEAE2] px-2 py-0.5 rounded-full font-mono">
                        {cell.dateStr.slice(5)}
                      </span>
                      {activeMode && (
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider shadow-none flex items-center gap-0.5"
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
                      const emoji = getEventEmoji(evt.title);
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
                            <h4 className="text-sm font-extrabold font-sans tracking-tight text-[#3C332D]">
                              {getEventTitleWithPrefix(evt, isBday, cell.dateStr)}
                            </h4>
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
                  className={`border border-[#EFEAE2] rounded-2xl p-4 bg-white shadow-xs relative ${
                    wd.isToday ? "ring-2 ring-[#EAA59E] z-10" : ""
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        wd.isToday ? "bg-[#EAA59E] text-white" : "bg-[#FFFDF8] text-[#5B7283] border border-[#EFEAE2]"
                      }`}>
                        {wd.dayName} {wd.day}日
                      </span>
                      {wd.isToday && (
                        <span className="text-[9px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full select-none shrink-0">今天</span>
                      )}
                      {holiday && (
                        <span className="text-[9px] bg-[#FFEBEB] text-[#E53935] border border-[#FFD5D4] px-1.5 py-0.5 rounded-full font-bold select-none shrink-0">
                          {holiday.emoji} {holiday.name}
                        </span>
                      )}
                      {activeMode && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-full font-bold select-none shrink-0">
                          {activeMode.name}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenAdd(wd.dateStr)}
                      className="text-[10px] font-bold text-[#5B7283] hover:text-[#3C332D] px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-[#EFEAE2] transition"
                    >
                      + 新增行程
                    </button>
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
                            className={`p-3.5 rounded-xl border flex flex-col gap-1.5 text-left relative cursor-pointer hover:bg-gray-55 transition-all duration-200 ${
                              isBday ? "bg-rose-50/40 border-rose-150 text-rose-700" : "bg-[#FFFDFB]/80 border-[#EFEAE2]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-extrabold text-xs text-[#3C332D] truncate block max-w-[85%]">
                                {getEventTitleWithPrefix(evt, isBday, wd.dateStr)}
                              </span>
                              
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
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-sans">
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
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-sans">
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
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-sans">
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
                onClick={() => handleApplyRecurringUpdate(false)}
                className="w-full text-left p-4 text-xs font-bold text-[#5B7283] bg-[#FFFBF0] hover:bg-[#FDF6E2] border border-[#EDD091]/50 rounded-2xl transition cursor-pointer"
              >
                <div>【只更新這次】</div>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">僅更新目前所選的單日行程，其餘星期數重複的課程時間保持不變。</p>
              </button>
              
              <button
                onClick={() => handleApplyRecurringUpdate(true)}
                className="w-full text-left p-4 text-xs font-extrabold text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-2xl transition cursor-pointer soft-journal-shadow"
              >
                <div>【更新全部未來活動】</div>
                <p className="text-[11px] text-gray-100/80 mt-1 font-medium">同步將此次更改套用到行事曆上所有往後的相同固定重複活動。</p>
              </button>

              <button
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
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-sans">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white rounded-[24px] border border-[#EFEAE2] max-w-md w-full soft-journal-shadow relative flex flex-col max-h-[90vh] md:max-h-[800px]"
          >
            {/* Header (Fixed) */}
            <div className="p-6 pb-4 border-b border-[#EFEAE2] flex items-center justify-between shrink-0 bg-[#FFFDF8]">
              <h3 className="text-lg font-black text-[#3C332D] flex items-center gap-2">
                <CalendarDays className="h-5.5 w-5.5 text-[#5B7283]" />
                {editingEvent ? "編輯/查看行程" : "新增行事曆行程"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-700 transition cursor-pointer p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="p-6 overflow-y-auto space-y-4 flex-grow select-none">
              {/* Quick autofill select bar */}
              {!editingEvent && favoriteActivities.length > 0 && (() => {
                const calendarTemplates = favoriteActivities.filter((t) => {
                  const ut = t.usageType || t.type;
                  return ut === "calendar" || ut === "both";
                });
                if (calendarTemplates.length === 0) return null;
                return (
                  <div id="fav-autofill-section" className="bg-[#FFFDF8] border border-[#EFEAE2] p-4 rounded-2xl mb-1 shadow-inner">
                    <label className="block text-xs font-bold text-[#5B7283] mb-1.5 flex items-center gap-1 select-none">
                      <FileSpreadsheet className="h-4 w-4 text-[#EAA59E]" />
                      💡 快速載入常用事項資料：
                    </label>
                    <select
                      value={selectedFavId}
                      onChange={(e) => handleSelectFavItem(e.target.value)}
                      className="w-full text-xs font-bold border border-[#EFEAE2] bg-white rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      <option value="">-- 點擊選擇載入常用事項 --</option>
                      {calendarTemplates.map((fav) => (
                        <option key={fav.id} value={fav.id}>
                          {fav.title} ({fav.isRecurring ? "每週固定" : "單次固定"} {fav.defaultStartTime ? `| ${fav.defaultStartTime}~${fav.defaultEndTime}` : ""})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-[#5B7283] mb-1.5">活動名稱</label>
                <input
                  type="text"
                  required
                  placeholder="請輸入活動名稱... (例如：畫畫課)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283]"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isFixed"
                  checked={isFixed}
                  onChange={(e) => setIsFixed(e.target.checked)}
                  className="h-5 w-5 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded-lg cursor-pointer"
                />
                <label htmlFor="isFixed" className="text-xs font-bold text-[#3C332D] select-none cursor-pointer">
                  🔄 固定活動 / 週課表 (每週重複)
                </label>
              </div>

              {!isFixed ? (
                <div className="space-y-4">
                  {isCrossDay ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-xs font-bold text-[#5B7283] mb-1.5">期間日期</label>
                        <button
                          type="button"
                          onClick={() => setShowRangePicker(!showRangePicker)}
                          className="w-full text-left font-mono font-bold text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] hover:bg-[#FAF8F5] transition duration-150 focus:outline-none flex items-center justify-between cursor-pointer shadow-sm select-none"
                        >
                          <span className="text-[#3C332D] flex items-center gap-2">
                            <span>📅</span> {selectedDate.replace(/-/g, "/")} ～ {endDate.replace(/-/g, "/")}
                          </span>
                          <span className="text-xs text-amber-600 font-extrabold bg-amber-50 px-2 py-1 rounded-lg">
                            共 {calcDurationDays(selectedDate, endDate)} 天
                          </span>
                        </button>
                        
                        {/* Interactive mini Month Calendar dropdown */}
                        {showRangePicker && (
                          <div className="mt-2.5 p-4 bg-white border border-[#EFEAE2] rounded-2xl space-y-3.5 shadow-xl animate-in fade-in slide-in-from-top-1.5 duration-200">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleRangeMonthChange(-1)}
                                className="p-1.5 px-3 border border-[#EFEAE2]/80 bg-white hover:bg-gray-50 rounded-lg text-xs font-bold transition cursor-pointer select-none"
                              >
                                上個月
                              </button>
                              <span className="text-xs font-bold text-[#3C332D] select-none">
                                {rangePickerYear}年 {rangePickerMonth + 1}月
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRangeMonthChange(1)}
                                className="p-1.5 px-3 border border-[#EFEAE2]/80 bg-white hover:bg-gray-50 rounded-lg text-xs font-bold transition cursor-pointer select-none"
                              >
                                下個月
                              </button>
                            </div>
                            
                            {/* Mini calendar grid */}
                            <div className="grid grid-cols-7 gap-1 text-center font-sans">
                              {["日", "一", "二", "三", "四", "五", "六"].map((w, index) => (
                                <span key={index} className={`font-bold text-[10px] py-1 ${(index === 0 || index === 6) ? "text-rose-500" : "text-gray-400"}`}>
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
                                
                                let dayClass = "text-[#3C332D] hover:bg-[#FAF6F0] rounded-lg";
                                if (isSelectedStart) {
                                  dayClass = "bg-[#7C6354] hover:bg-[#7C6354] text-white font-black rounded-lg shadow-sm";
                                } else if (isSelectedEnd) {
                                  dayClass = "bg-[#7C6354] hover:bg-[#7C6354] text-white font-black rounded-lg shadow-sm";
                                } else if (isInRange) {
                                  dayClass = "bg-[#FAF0E6] hover:bg-[#FAF0E6] text-[#7C6354] font-bold rounded-none";
                                } else if (tempRangeStart && dateStr === tempRangeStart) {
                                  dayClass = "bg-[#7C6354] hover:bg-[#7C6354] text-white font-black rounded-lg shadow-sm";
                                }
                                
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    onClick={() => handleRangeDayClick(dateStr)}
                                    className={`py-1.5 transition font-mono relative text-[11px] font-bold flex items-center justify-center cursor-pointer ${dayClass}`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {/* Tips */}
                            <div className="text-[10px] text-gray-400 font-bold text-center select-none pt-1 border-t border-[#FAF6F0]">
                              {!tempRangeStart ? "💡 點選第一個日期作為【開始日期】" : !tempRangeEnd ? "💡 點選第二個日期作為【結束日期】" : "✅ 區間已選妥，可點擊日期重新選取"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          id="isCrossDay"
                          checked={isCrossDay}
                          onChange={(e) => {
                            setIsCrossDay(e.target.checked);
                            if (!e.target.checked) setEndDate(selectedDate);
                          }}
                          className="h-4 w-4 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded cursor-pointer"
                        />
                        <label htmlFor="isCrossDay" className="text-xs font-bold text-[#5B7283] select-none cursor-pointer">
                          📅 跨日行程（多天行程）
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#5B7283] mb-1.5">活動日期</label>
                        <input
                          type="date"
                          required
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setEndDate(e.target.value);
                            setTempRangeStart(e.target.value);
                            setTempRangeEnd(e.target.value);
                          }}
                          className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283] font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          id="isCrossDay"
                          checked={isCrossDay}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsCrossDay(checked);
                            if (!checked) {
                              setEndDate(selectedDate);
                              setTempRangeEnd(selectedDate);
                            } else {
                              // If checked, default to tomorrow
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
                          className="h-4 w-4 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded cursor-pointer"
                        />
                        <label htmlFor="isCrossDay" className="text-xs font-bold text-[#5B7283] select-none cursor-pointer">
                          📅 跨日行程（多天行程）
                        </label>
                      </div>
                    </div>
                  )}

                  {isCrossDay && calcDurationDays(selectedDate, endDate) >= 3 && (
                    <div className="bg-[#FAF6F0] border border-[#E7DCD0] p-3 rounded-2xl space-y-2 animate-in fade-in duration-200">
                      <div className="text-[11px] leading-relaxed text-[#846A55] font-medium">
                        💡 跨日行程已超過 2 天（共 <span className="font-bold text-[#A87243]">{calcDurationDays(selectedDate, endDate)}</span> 天），建議將其快速轉換為「特別期間安排（旅遊/考試/放假）」，享受專屬一鍵管理！
                      </div>
                      <button
                        type="button"
                        onClick={handleQuickConvertToSpecialPeriod}
                        className="w-full text-center py-1.5 px-3 bg-[#E7DCD0] hover:bg-[#D9CDBF] text-[#5C4535] rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        ⚡ 快速建立為「特別期間安排」
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#5B7283]">重複星期幾 (可複選)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS_LIST.map((wd) => {
                      const isActive = weekdays.includes(wd.value);
                      return (
                        <button
                          type="button"
                          key={wd.value}
                          onClick={() => toggleWeekday(wd.value)}
                          className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition cursor-pointer ${
                            isActive
                              ? "bg-[#5B7283] text-white border-[#5B7283]"
                              : "bg-[#FFFDF8] text-gray-500 border-[#EFEAE2] hover:bg-[#F7F3EB]"
                          }`}
                        >
                          {wd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

               <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#5B7283] mb-1.5">開始時間（選填）</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono cursor-pointer"
                  >
                    <option value="">請選擇或無</option>
                    {TIME_CHOICES.map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5B7283] mb-1.5">結束時間（選填）</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono cursor-pointer"
                  >
                    <option value="">請選擇或無</option>
                    {TIME_CHOICES.map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B7283] mb-1.5">備註說明</label>
                <textarea
                  rows={2}
                  placeholder="可在此輸入事項備註細節..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283] resize-none"
                />
              </div>

              {isCrossDay && !isFixed && selectedDate && endDate && (
                <div className="border border-sky-150 bg-[#F0F8FF]/80 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => setIsDailyNotesExpanded(!isDailyNotesExpanded)}
                    className="w-full text-left flex items-center justify-between text-xs font-black text-[#004B8F] select-none cursor-pointer focus:outline-none"
                  >
                    <span className="flex items-center gap-1 text-[11px]">
                      <span>📘</span> 每日內容規劃（{calcDurationDays(selectedDate, endDate)} 天）
                    </span>
                    <span className="text-[10px] text-sky-600 font-bold bg-sky-100 hover:bg-[#E1F0FF] px-2 py-0.5 rounded-md flex items-center gap-0.5 transition select-none shrink-0 border border-sky-200">
                      {isDailyNotesExpanded ? "▲ 點擊收合" : "▼ 點擊展開"}
                    </span>
                  </button>

                  {isDailyNotesExpanded && (
                    <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 border-t border-sky-200 pt-3 animate-in slide-in-from-top-1 duration-150">
                      {getDatesInRange(selectedDate, endDate).map((dateStr, idx) => {
                        const dayNum = idx + 1;
                        const dateDisplay = dateStr.replace(/-/g, "/").slice(5); // e.g. "06/23"
                        return (
                          <div key={dateStr} className="p-2.5 bg-white/70 border border-sky-100 rounded-xl space-y-1.5 shadow-sm max-h-[92px]">
                            <div className="flex justify-between items-center text-[11px] font-extrabold text-sky-800">
                              <span className="flex items-center gap-1 shrink-0">📘 第 {dayNum} 天 ({dateDisplay})</span>
                              <span className="text-[10px] font-mono text-gray-400 font-normal shrink-0">{dateStr}</span>
                            </div>
                            <input
                              type="text"
                              placeholder={`例如：期末考 Day${dayNum} 考科/自訂安排...`}
                              value={formDailyNotes[dateStr] || ""}
                              onChange={(e) => {
                                setFormDailyNotes({
                                  ...formDailyNotes,
                                  [dateStr]: e.target.value,
                                });
                              }}
                              className="w-full text-xs border border-sky-200 rounded-lg px-2.5 py-1.5 bg-[#FFFDF8] focus:outline-none focus:ring-1 focus:ring-sky-300 font-bold"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#5B7283] mb-1.5">隱私限制</label>
                <select
                  value={isPublic ? "true" : "false"}
                  onChange={(e) => setIsPublic(e.target.value === "true")}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3.5 py-2.5 bg-[#FFFDF8] focus:outline-none cursor-pointer"
                >
                  <option value="true">🔓 公開 (家庭全員皆可見)</option>
                  <option value="false">🔒 私人 (僅自己以及管理員媽媽可見)</option>
                </select>
              </div>

              {!editingEvent && onAddFavorite && (
                <div className="border-t border-[#EFEAE2] pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveAsFav"
                      checked={saveAsFav}
                      onChange={(e) => setSaveAsFav(e.target.checked)}
                      className="h-5 w-5 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded-lg cursor-pointer"
                    />
                    <label htmlFor="saveAsFav" className="text-xs font-bold text-[#5B7283] select-none cursor-pointer">
                      ⭐ 順便存入常用事項清單
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer (Fixed) */}
            <div className="p-6 border-t border-[#EFEAE2] flex justify-between items-center bg-[#FFFDF8] shrink-0 rounded-b-[24px]">
              {editingEvent && isUserAllowedToDelete(editingEvent) ? (
                <button
                  type="button"
                  onClick={() => triggerDeleteConfirm(editingEvent)}
                  className="px-4.5 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-full transition cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除日程
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 border border-[#EFEAE2] rounded-full transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-black text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-full transition disabled:opacity-50 cursor-pointer soft-journal-shadow"
                >
                  {isSubmitting ? "正在儲存..." : editingEvent ? "確認修改" : "新增事項"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {birthdayAlert && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
        
        // Calculate day count
        let modeDayCount = 1;
        try {
          const parseDateStr = (str: string) => {
            const parts = str.split("-");
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          };
          const startD = parseDateStr(mode.startDate);
          const clickD = parseDateStr(dateStr);
          modeDayCount = Math.floor((clickD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
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
                      {/* Day 1 Flight Ticket Information (Only for international/國外旅遊 and first day) */}
                      {modeDayCount === 1 && mode.travelType === "international" && (
                        <div className="bg-[#FAF6F0] border border-[#E3DCD0] rounded-2xl p-5 space-y-4 animate-fade-in shadow-sm relative overflow-hidden">
                          {/* Boarding pass styled decor */}
                          <div className="absolute right-4 top-2 text-[#E2D8C9] font-black text-[13px] tracking-widest pointer-events-none select-none opacity-40">
                            BOARDING PASS / 國外機票
                          </div>
                          
                          <div className="font-extrabold text-[#7C6250] text-sm flex items-center gap-1.5 pb-2 border-b border-dashed border-[#E3DCD0]">
                            <span>✈️</span> 機票重要資訊
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs text-[#5B4E44]">
                            <div>
                              <label className="text-[11px] text-[#8C7A6B] font-bold block mb-1">航空公司</label>
                              <input
                                id="travel-edit-airline"
                                type="text"
                                value={editingItinerary?.airline || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, airline: e.target.value } : null)}
                                placeholder="例如：星宇航空"
                                className="w-full bg-white/95 rounded-xl px-3 py-2 text-xs text-gray-700 border border-[#D5CDBD] focus:border-[#7C6250] focus:ring-1 focus:ring-[#7C6250] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-[#8C7A6B] font-bold block mb-1">航班</label>
                              <input
                                id="travel-edit-flight-no"
                                type="text"
                                value={editingItinerary?.flightNumber || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, flightNumber: e.target.value } : null)}
                                placeholder="例如：JX800"
                                className="w-full bg-white/95 rounded-xl px-3 py-2 text-xs text-gray-700 border border-[#D5CDBD] focus:border-[#7C6250] focus:ring-1 focus:ring-[#7C6250] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-[#8C7A6B] font-bold block mb-1">出發時間</label>
                              <input
                                id="travel-edit-dep-time"
                                type="text"
                                value={editingItinerary?.departureTime || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, departureTime: e.target.value } : null)}
                                placeholder="例如：08:30"
                                className="w-full bg-white/95 rounded-xl px-3 py-2 text-xs text-gray-700 border border-[#D5CDBD] focus:border-[#7C6250] focus:ring-1 focus:ring-[#7C6250] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-[#8C7A6B] font-bold block mb-1">回程時間</label>
                              <input
                                id="travel-edit-ret-time"
                                type="text"
                                value={editingItinerary?.returnTime || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, returnTime: e.target.value } : null)}
                                placeholder="例如：19:20"
                                className="w-full bg-white/95 rounded-xl px-3 py-2 text-xs text-gray-700 border border-[#D5CDBD] focus:border-[#7C6250] focus:ring-1 focus:ring-[#7C6250] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[11px] text-[#8C7A6B] font-bold block mb-1">航廈</label>
                              <input
                                id="travel-edit-dep-terminal"
                                type="text"
                                value={editingItinerary?.departureTerminal || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, departureTerminal: e.target.value } : null)}
                                placeholder="例如：第二航廈"
                                className="w-full bg-white/95 rounded-xl px-3 py-2 text-xs text-gray-700 border border-[#D5CDBD] focus:border-[#7C6250] focus:ring-1 focus:ring-[#7C6250] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 今日重點&提醒 section */}
                      <div className="bg-[#FFF8F0] border-2 border-dashed border-[#E3DCD0] rounded-3xl p-5 space-y-4 shadow-xs">
                        <div className="font-extrabold text-[15px] text-[#A27B5C] flex items-center gap-1.5 pb-1 select-none border-b border-[#E3DCD0]/50">
                          <span className="text-base">📌</span> 今日主題 & 備註提醒
                        </div>
                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-black text-[#8C7A6B] mb-1.5 flex items-center gap-1">
                              <span>🌴</span> 今日主題：
                            </label>
                            <input
                              id="travel-notebook-today-theme"
                              type="text"
                              value={editingItinerary?.todayTheme || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, todayTheme: e.target.value } : null)}
                              placeholder="例如：放空海灘日、文化探索日、親子樂園日..."
                              className="w-full bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-2.5 text-xs text-gray-700 focus:border-[#A27B5C] focus:ring-1 focus:ring-[#A27B5C] focus:outline-none transition-all placeholder:text-gray-300 font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-[#8C7A6B] mb-1.5 flex items-center gap-1">
                              <span>📝</span> 今日備註：
                            </label>
                            <textarea
                              id="travel-notebook-today-remarks"
                              rows={3}
                              value={editingItinerary?.todayRemarks || ""}
                              onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, todayRemarks: e.target.value } : null)}
                              placeholder="例如：&#10;14:00 SPA預約&#10;17:30 看夕陽&#10;記得帶防蚊液"
                              className="w-full bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-2.5 text-xs text-gray-700 focus:border-[#A27B5C] focus:ring-1 focus:ring-[#A27B5C] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Travel Notebook: Three Large Cards */}
                      <div className="space-y-4">
                        {/* Card 1: 🌅 早上 */}
                        <div className="bg-[#FFFDF6] border border-[#E9E4DC] rounded-3xl p-5 space-y-3.5 shadow-sm">
                          <div className="font-extrabold text-[14px] text-[#A27B5C] flex items-center gap-1.5 pb-1 select-none">
                            <span className="text-base">🌅</span> 早上
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">早餐：</span>
                              <input
                                id="travel-notebook-breakfast"
                                type="text"
                                value={editingItinerary?.breakfast || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, breakfast: e.target.value } : null)}
                                placeholder="填寫早餐安排 (如：飯店享用 / 街邊早餐)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#A27B5C] focus:ring-1 focus:ring-[#A27B5C] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">行程：</span>
                              <input
                                id="travel-notebook-morning"
                                type="text"
                                value={editingItinerary?.morning || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, morning: e.target.value } : null)}
                                placeholder="填寫早上行程 (如：漫步老街、景點探訪)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#A27B5C] focus:ring-1 focus:ring-[#A27B5C] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Card 2: ☀️ 下午 */}
                        <div className="bg-[#FFFDF6] border border-[#E9E4DC] rounded-3xl p-5 space-y-3.5 shadow-sm">
                          <div className="font-extrabold text-[14px] text-[#D8A25E] flex items-center gap-1.5 pb-1 select-none">
                            <span className="text-base">☀️</span> 下午
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">午餐：</span>
                              <input
                                id="travel-notebook-lunch"
                                type="text"
                                value={editingItinerary?.lunch || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, lunch: e.target.value } : null)}
                                placeholder="填寫午餐享用 (如：當地人氣餐廳 / 美食街)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#D8A25E] focus:ring-1 focus:ring-[#D8A25E] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">行程：</span>
                              <input
                                id="travel-notebook-afternoon"
                                type="text"
                                value={editingItinerary?.afternoon || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, afternoon: e.target.value } : null)}
                                placeholder="填寫下午休閒 (如：下午茶、商圈逛街)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#D8A25E] focus:ring-1 focus:ring-[#D8A25E] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Card 3: 🌙 晚上 */}
                        <div className="bg-[#FFFDF6] border border-[#E9E4DC] rounded-3xl p-5 space-y-3.5 shadow-sm">
                          <div className="font-extrabold text-[14px] text-[#2C3E50] flex items-center gap-1.5 pb-1 select-none">
                            <span className="text-base">🌙</span> 晚上
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">晚餐：</span>
                              <input
                                id="travel-notebook-dinner"
                                type="text"
                                value={editingItinerary?.dinner || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, dinner: e.target.value } : null)}
                                placeholder="填寫晚餐大餐 (如：名勝燒肉 / 百貨美食)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#2C3E50] focus:ring-1 focus:ring-[#2C3E50] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">行程：</span>
                              <input
                                id="travel-notebook-night"
                                type="text"
                                value={editingItinerary?.night || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, night: e.target.value } : null)}
                                placeholder="填寫晚間放鬆 (如：夜遊鴨川、觀賞夜景)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#2C3E50] focus:ring-1 focus:ring-[#2C3E50] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8C7A6B] font-black w-14 shrink-0">飯店：</span>
                              <input
                                id="travel-notebook-lodging"
                                type="text"
                                value={editingItinerary?.lodging || ""}
                                onChange={(e) => setEditingItinerary(prev => prev ? { ...prev, lodging: e.target.value } : null)}
                                placeholder="填寫下榻旅宿 (如：溫泉飯店、市區商旅)"
                                className="flex-grow bg-white border border-[#E3DCD0] rounded-xl px-3.5 py-1.5 text-xs text-gray-700 focus:border-[#2C3E50] focus:ring-1 focus:ring-[#2C3E50] focus:outline-none transition-all placeholder:text-gray-300 font-semibold"
                              />
                            </div>
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

                {/* Footer buttons */}
                <div className="border-t border-gray-100 pt-5">
                  {isTravel ? (
                    <div className="flex w-full items-center justify-end gap-3 font-sans">
                      <button
                        onClick={() => setSelectedModeForDetail(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-6 py-3 rounded-full text-xs cursor-pointer transition"
                      >
                         取消
                      </button>
                      <button
                        onClick={handleSaveTravelItinerary}
                        disabled={isSavingTravel}
                        className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-extrabold px-7 py-3 rounded-full text-xs cursor-pointer transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                      >
                         {isSavingTravel ? "正在儲存更動..." : `💾 儲存 D${modeDayCount} 行程`}
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-3 font-sans">
                      <button
                        onClick={() => {
                          setSelectedModeForDetail(null);
                          handleOpenAdd(dateStr);
                        }}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold px-4 py-3 rounded-full text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                         ➕ 建立一般日行程事件
                      </button>

                      <button
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
        <div id="sync-special-modal" className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
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
        <div id="choose-special-type-modal" className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
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
        <div id="success-toast" className="fixed bottom-6 right-6 z-50 bg-[#344] text-white p-4.5 rounded-2xl flex items-center gap-3.5 shadow-2xl border border-gray-100/15 animate-in slide-in-from-bottom-4 duration-200">
          <div className="h-9 w-9 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg shadow-sm font-black">
            ✓
          </div>
          <div className="space-y-0.5 text-left font-sans">
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
    </div>
  );
}
