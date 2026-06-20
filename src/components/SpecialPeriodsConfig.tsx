import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  Star, 
  CheckCircle2, 
  Clock, 
  Info,
  MapPin,
  Compass,
  Check
} from "lucide-react";
import { SystemMode, ConfiguredMode, UserRole } from "../types";

interface SpecialPeriodsConfigProps {
  configuredModes: ConfiguredMode[];
  systemMode: SystemMode;
  onSaveConfiguredMode: (mode: ConfiguredMode) => Promise<void>;
  onDeleteConfiguredMode: (id: string, deleteRelatedEvents?: boolean) => Promise<void>;
  simulatedTodayDate: string;
  currentUser: any;
}

// Format Date Utility
const getLocalToday = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export const SpecialPeriodsConfig: React.FC<SpecialPeriodsConfigProps> = ({
  configuredModes,
  systemMode,
  onSaveConfiguredMode,
  onDeleteConfiguredMode,
  simulatedTodayDate,
  currentUser,
}) => {
  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;

  // Expansion and editing states
  const [expandedModeId, setExpandedModeId] = useState<string | null>(null);
  const [activeItineraryDate, setActiveItineraryDate] = useState<string>("");

  // Modal control
  const [showModeModal, setShowModeModal] = useState(false);
  const [editingModeConfig, setEditingModeConfig] = useState<ConfiguredMode | null>(null);
  
  // Date Range Picker State
  const [showRangeCalendar, setShowRangeCalendar] = useState(false);
  const [rangeSelectStep, setRangeSelectStep] = useState<"start" | "end">("start");
  const [pickerYear, setPickerYear] = useState(2100);
  const [pickerMonth, setPickerMonth] = useState(0);
  const [validationError, setValidationError] = useState("");

  // Form values
  const [modeFormType, setModeFormType] = useState<SystemMode>(SystemMode.TRAVEL);
  const [modeFormName, setModeFormName] = useState("");
  const [modeFormStartDate, setModeFormStartDate] = useState("");
  const [modeFormEndDate, setModeFormEndDate] = useState("");
  const [modeFormIcon, setModeFormIcon] = useState("✈");
  const [modeFormColor, setModeFormColor] = useState("orange");

  // Mode Specific - Travel
  const [travelType, setTravelType] = useState<"international" | "domestic">("international");
  const [airLine, setAirLine] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [departureTerminal, setDepartureTerminal] = useState("");
  const [returnTerminal, setReturnTerminal] = useState("");

  // New detailed Departure Information
  const [departureAirline, setDepartureAirline] = useState("");
  const [departureFlightNumber, setDepartureFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureArrivalDate, setDepartureArrivalDate] = useState("");
  const [departureArrivalTime, setDepartureArrivalTime] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [departureArrivalAirport, setDepartureArrivalAirport] = useState("");

  // New detailed Return Information
  const [returnAirline, setReturnAirline] = useState("");
  const [returnFlightNumber, setReturnFlightNumber] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnArrivalDate, setReturnArrivalDate] = useState("");
  const [returnArrivalTime, setReturnArrivalTime] = useState("");
  const [returnAirport, setReturnAirport] = useState("");
  const [returnArrivalAirport, setReturnArrivalAirport] = useState("");
  const [passportReminder, setPassportReminder] = useState(false);
  const [visaReminder, setVisaReminder] = useState(false);
  const [notes, setNotes] = useState("");
  const [transportation, setTransportation] = useState("drive");
  const [customTransportation, setCustomTransportation] = useState("");

  // Mode Specific - Exam
  const [examSubjects, setExamSubjects] = useState<Array<{ name: string; target: string }>>([]);
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [examDailyPlans, setExamDailyPlans] = useState<Array<{ id: string; startTime: string; endTime: string; subjectName: string }>>([]);

  // Mode Specific - Vacation
  const [vacationType, setVacationType] = useState("暑假");
  const [vacationDailyTasks, setVacationDailyTasks] = useState<Array<{ id: string; text: string }>>([]);
  const [newVacationTask, setNewVacationTask] = useState("");

  // Mode Specific - Custom
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; text: string }>>([]);
  const [newCustomTaskInput, setNewCustomTaskInput] = useState("");

  // Deletion confirm popup
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Open creation modal with preset defaults
  const handleOpenAddMode = (typeState: SystemMode) => {
    if (!isParent) return;
    setEditingModeConfig(null);
    setModeFormType(typeState);

    const today = simulatedTodayDate || getLocalToday();
    const tYear = parseInt(today.split("-")[0]) || 2026;
    const tMonth = (parseInt(today.split("-")[1]) - 1) || 5;

    setPickerYear(tYear);
    setPickerMonth(tMonth);

    // ALL created periods must start ENTIRELY BLANK
    setModeFormStartDate("");
    setModeFormEndDate("");
    setModeFormName("");
    setModeFormIcon(typeState === SystemMode.TRAVEL ? "✈" : typeState === SystemMode.EXAM ? "📚" : typeState === SystemMode.VACATION ? "🏡" : "🎨");
    setModeFormColor(typeState === SystemMode.TRAVEL ? "orange" : typeState === SystemMode.EXAM ? "purple" : typeState === SystemMode.VACATION ? "emerald" : "indigo");

    // Clear all mode-specific variables completely
    setAirLine("");
    setFlightNumber("");
    setDepartureTime("");
    setReturnTime("");
    setDepartureTerminal("");
    setReturnTerminal("");
    
    // Clear new detailed departure & return variables
    setDepartureAirline("");
    setDepartureFlightNumber("");
    setDepartureDate("");
    setDepartureArrivalDate("");
    setDepartureArrivalTime("");
    setDepartureAirport("");
    setDepartureArrivalAirport("");

    setReturnAirline("");
    setReturnFlightNumber("");
    setReturnDate("");
    setReturnArrivalDate("");
    setReturnArrivalTime("");
    setReturnAirport("");
    setReturnArrivalAirport("");

    setPassportReminder(false);
    setVisaReminder(false);
    setNotes("");
    setTransportation("drive");
    setCustomTransportation("");

    setExamSubjects([]);
    setExamDailyPlans([]);

    setVacationType("暑假");
    setVacationDailyTasks([]);

    setCustomTasks([]);

    setNewSubjectInput("");
    setNewVacationTask("");
    setNewCustomTaskInput("");

    setValidationError("");
    setRangeSelectStep("start");
    setShowRangeCalendar(false);

    setShowModeModal(true);
  };

  // Open existing mode editor
  const handleOpenEditMode = (mode: ConfiguredMode) => {
    if (!isParent) return;
    setEditingModeConfig(mode);
    setModeFormType(mode.type);
    setModeFormName(mode.name);
    setModeFormStartDate(mode.startDate);
    setModeFormEndDate(mode.endDate);
    setModeFormIcon(mode.icon || "⭐");
    setModeFormColor(mode.color || "orange");

    const today = mode.startDate || simulatedTodayDate || getLocalToday();
    const tYear = parseInt(today.split("-")[0]) || 2026;
    const tMonth = (parseInt(today.split("-")[1]) - 1) || 5;
    setPickerYear(tYear);
    setPickerMonth(tMonth);

    setValidationError("");
    setRangeSelectStep("start");
    setShowRangeCalendar(false);

    if (mode.type === SystemMode.TRAVEL) {
      setTravelType(mode.travelType || "international");
      setAirLine(mode.airline || "");
      setFlightNumber(mode.flightNumber || "");
      setDepartureTime(mode.departureTime || "");
      setReturnTime(mode.returnTime || "");
      setDepartureTerminal(mode.departureTerminal || "");
      setReturnTerminal(mode.returnTerminal || "");

      // Load detailed, newly supported departure & return flight parameters with fallbacks
      setDepartureAirline(mode.departureAirline || mode.airline || "");
      setDepartureFlightNumber(mode.departureFlightNumber || mode.flightNumber || "");
      setDepartureDate(mode.departureDate || mode.startDate || "");
      setDepartureArrivalDate(mode.departureArrivalDate || mode.startDate || "");
      setDepartureArrivalTime(mode.departureArrivalTime || "");
      setDepartureAirport(mode.departureAirport || "");
      setDepartureArrivalAirport(mode.departureArrivalAirport || "");

      setReturnAirline(mode.returnAirline || "");
      setReturnFlightNumber(mode.returnFlightNumber || "");
      setReturnDate(mode.returnDate || mode.endDate || "");
      setReturnArrivalDate(mode.returnArrivalDate || mode.endDate || "");
      setReturnArrivalTime(mode.returnArrivalTime || "");
      setReturnAirport(mode.returnAirport || "");
      setReturnArrivalAirport(mode.returnArrivalAirport || "");

      setPassportReminder(mode.passportReminder || false);
      setVisaReminder(mode.visaReminder || false);
      setNotes(mode.notes || "");
      
      const trans = mode.transportation || "drive";
      if (["drive", "hightrain", "train", "bus", "rent"].includes(trans)) {
        setTransportation(trans);
        setCustomTransportation("");
      } else {
        setTransportation("custom");
        setCustomTransportation(trans);
      }
    } else if (mode.type === SystemMode.EXAM) {
      setExamSubjects(mode.subjects || []);
      setExamDailyPlans(mode.dailyPlan || []);
    } else if (mode.type === SystemMode.VACATION) {
      setVacationType(mode.vacationType || "暑假");
      setVacationDailyTasks((mode.dailyTasks || []).map(t => ({ id: t.id, text: t.text })));
    } else if (mode.type === SystemMode.CUSTOM) {
      setCustomTasks((mode.customTasks || []).map(t => ({ id: t.id, text: t.text })));
      setNotes(mode.notes || "");
    }

    setShowModeModal(true);
  };

  // Save changes submit
  const handleSaveModeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!modeFormStartDate || !modeFormEndDate) {
      setValidationError("請先點選並設定活動的『開始』與『結束』日期區間喔！📅");
      return;
    }

    setIsUpdating(true);
    setValidationError("");

    const modeId = editingModeConfig?.id || `mode_v_${Math.random().toString(36).substr(2, 9)}`;

    const payload: ConfiguredMode = {
      id: modeId,
      type: modeFormType,
      name: modeFormName || (
        modeFormType === SystemMode.TRAVEL ? "家庭旅行" :
        modeFormType === SystemMode.EXAM ? "考試衝刺" :
        modeFormType === SystemMode.VACATION ? "假期規劃" : "自訂計畫"
      ),
      icon: modeFormIcon,
      color: modeFormColor,
      startDate: modeFormStartDate,
      endDate: modeFormEndDate,
      createdAt: editingModeConfig?.createdAt || new Date(),
    };

    if (modeFormType === SystemMode.TRAVEL) {
      payload.travelType = travelType;
      
      // Save legacy compatible properties
      payload.airline = departureAirline;
      payload.flightNumber = departureFlightNumber;
      payload.departureTime = departureTime;
      payload.returnTime = returnTime;
      payload.departureTerminal = departureTerminal;
      payload.returnTerminal = returnTerminal;
      payload.passportReminder = passportReminder;
      payload.visaReminder = visaReminder;
      payload.notes = notes;
      payload.transportation = transportation === "custom" ? (customTransportation || "自訂交通") : transportation;

      // Save detailed Departure Information
      payload.departureAirline = departureAirline;
      payload.departureFlightNumber = departureFlightNumber;
      payload.departureDate = departureDate || modeFormStartDate;
      payload.departureArrivalDate = departureArrivalDate || modeFormStartDate;
      payload.departureArrivalTime = departureArrivalTime;
      payload.departureAirport = departureAirport;
      payload.departureArrivalAirport = departureArrivalAirport;

      // Save detailed Return Information
      payload.returnAirline = returnAirline;
      payload.returnFlightNumber = returnFlightNumber;
      payload.returnDate = returnDate || modeFormEndDate;
      payload.returnArrivalDate = returnArrivalDate || modeFormEndDate;
      payload.returnArrivalTime = returnArrivalTime;
      payload.returnAirport = returnAirport;
      payload.returnArrivalAirport = returnArrivalAirport;
    } else if (modeFormType === SystemMode.EXAM) {
      payload.subjects = examSubjects.filter(s => s.name.trim() !== "");
      payload.dailyPlan = examDailyPlans;
    } else if (modeFormType === SystemMode.VACATION) {
      payload.vacationType = vacationType;
      payload.dailyTasks = vacationDailyTasks.map(t => ({ id: t.id, text: t.text, completed: false }));
    } else if (modeFormType === SystemMode.CUSTOM) {
      payload.notes = notes;
      payload.customTasks = [];
    }

    // Initialize/Maintain clean daily itinerary structure - ALL modes are initialized completely block & empty
    if (editingModeConfig?.itinerary) {
      payload.itinerary = editingModeConfig.itinerary;
    } else {
      const genItinerary: any = {};
      const start = new Date(payload.startDate);
      const end = new Date(payload.endDate);
      const current = new Date(start);
      while (current <= end) {
        const dStr = current.toISOString().split("T")[0];
        genItinerary[dStr] = {
          morning: "",
          afternoon: "",
          evening: "",
          breakfast: "",
          lunch: "",
          dinner: "",
          note: "",
          theme: "",
          morningTask: "",
          afternoonTask: "",
          eveningTask: "",
          night: "",
          lodging: "",
          transport: "",
          customNotes: "",
          todayTheme: "",
          todayRemarks: "",
        };
        current.setDate(current.getDate() + 1);
      }
      payload.itinerary = genItinerary;
    }

    try {
      await onSaveConfiguredMode(payload);
      setShowModeModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Live Inline Travel Itinerary Editor Handler
  const handleUpdateExpandedItinerary = async (mode: ConfiguredMode, date: string, field: string, value: string) => {
    if (!onSaveConfiguredMode || !isParent) return;
    const updatedItinerary = { ...(mode.itinerary || {}) };
    if (!updatedItinerary[date]) {
      updatedItinerary[date] = {};
    }
    updatedItinerary[date] = {
      ...updatedItinerary[date],
      [field]: value
    };

    const updatedMode = {
      ...mode,
      itinerary: updatedItinerary
    };

    try {
      await onSaveConfiguredMode(updatedMode);
    } catch (err) {
      console.error("Failed to save live itinerary item update:", err);
    }
  };

  // Toggle tasks checkbox (for kids/parents during execution)
  const handleToggleTaskCompleted = async (mode: ConfiguredMode, taskId: string, type: "vacation" | "custom") => {
    const isVacation = type === "vacation";
    const taskList = isVacation ? (mode.dailyTasks || []) : (mode.customTasks || []);
    
    const updatedTasks = taskList.map(task => {
      if (task.id === taskId) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });

    const updatedMode = {
      ...mode,
      ...(isVacation ? { dailyTasks: updatedTasks } : { customTasks: updatedTasks })
    };

    try {
      await onSaveConfiguredMode(updatedMode);
    } catch (err) {
      console.error("Failed to toggle verification state:", err);
    }
  };

  // Delete flow trigger
  const handleDeleteModeClick = (id: string, name: string) => {
    if (!isParent) return;
    setConfirmDeleteId(id);
    setConfirmDeleteName(name);
  };

  const handleConfirmDeleteSubmit = async (deleteEvents: boolean) => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await onDeleteConfiguredMode(confirmDeleteId, deleteEvents);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 🚀 Thin Brand Header Description (strictly < 90px in height) */}
      <div className="bg-gradient-to-r from-[#9DC2C9]/15 to-[#FAF8F4] border border-[#E8E2D8] rounded-2xl p-3 shadow-xs font-sans">
        <div className="flex items-center gap-3">
          <span className="text-xl shrink-0">🗓️</span>
          <div>
            <h2 className="text-sm md:text-base font-black text-[#3C332D]">特別期間計畫看板</h2>
            <p className="text-xs md:text-sm text-gray-400 font-bold mt-1 leading-normal">
              集中排定旅遊計畫、考前溫書準備或寒暑假作息。網格網頁與作息同步換裝，幸福滿滿。
            </p>
          </div>
        </div>
      </div>

      {/* 🧩 Step 1: Compact Creator List (Parents Only) */}
      {isParent ? (
        <div className="space-y-3 font-sans">
          <h3 className="text-sm md:text-base font-black text-[#5C3A21] tracking-wider uppercase">✨ 建立新的家庭特別期間：</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* 1. Travel Plane Card */}
            <div className="bg-[#EAF6FF]/60 border border-[#BFDFFF] rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-[70px] transition hover:shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-3xl shrink-0">✈️</div>
                <div className="min-w-0">
                  <h4 className="font-black text-xs md:text-sm text-blue-900 leading-tight">出遊計畫</h4>
                  <p className="text-xs text-blue-700/85 mt-1 leading-none truncate">自訂機票、行李提醒與通知</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.TRAVEL)}
                className="py-2 px-4 shrink-0 text-xs font-black bg-[#478ECC] hover:bg-[#3476B0] text-white rounded-lg shadow-xs cursor-pointer transition uppercase"
              >
                + 建立
              </button>
            </div>

            {/* 4. Custom arrangements Theme Card */}
            <div className="bg-[#EEF2FF]/65 border border-[#CCD6FF] rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-[70px] transition hover:shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-3xl shrink-0">🎨</div>
                <div className="min-w-0">
                  <h4 className="font-black text-xs md:text-sm text-indigo-950 leading-tight">自訂主題計畫</h4>
                  <p className="text-xs text-indigo-700/88 mt-1 leading-none truncate">建立家庭特別計畫活動</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.CUSTOM)}
                className="py-2 px-4 shrink-0 text-xs font-black bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg shadow-xs cursor-pointer transition uppercase"
              >
                + 建立
              </button>
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-[#FFFDF9] border border-[#E8E2D8] rounded-2xl p-3 flex items-center gap-2.5 text-xs text-amber-800 shadow-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="font-bold text-[10.5px]">
            📢 爸媽細心安排了此階段的特別計畫，在下方可展開完整日程和清單！
          </p>
        </div>
      )}

      {/* 🗓️ List part: Currently Arranged Periods */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm md:text-base font-black text-[#5C3A21] tracking-wider uppercase flex items-center gap-1.5">
            🗺️ 目前已安排的特別期間 ({configuredModes.length})
          </h3>
        </div>

        {configuredModes.length === 0 ? (
          <div className="bg-[#FFFDF9] border border-dashed border-gray-200 rounded-3xl p-10 text-center text-gray-400 text-sm font-sans">
            <Calendar className="h-8 w-8 mx-auto text-gray-300 stroke-[1.5] mb-2" />
            <p className="font-bold text-[#6D5D53]">目前沒有已排定的特別期間計畫喔！</p>
            {isParent && <p className="text-xs text-[#A59285] mt-1">快用上方的大型卡片為全家建立一個吧 ✨</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 font-sans text-sm md:text-base">
            {configuredModes.map((mode) => {
              const isExpanded = expandedModeId === mode.id;
              
              // Calculate status
              const today = new Date(simulatedTodayDate || getLocalToday());
              today.setHours(0,0,0,0);
              const start = new Date(mode.startDate);
              start.setHours(0,0,0,0);
              const end = new Date(mode.endDate);
              end.setHours(0,0,0,0);
              
              const isCurrentActive = today >= start && today <= end;
              const isFuture = today < start;
              const isPast = today > end;

              let themeBg = "bg-orange-50/75 border-orange-200/60 text-orange-950";
              let badgeLabel = "特別旅行";
              if (mode.type === SystemMode.EXAM) {
                themeBg = "bg-purple-50/75 border-purple-200/60 text-purple-950";
                badgeLabel = "考試衝刺";
              } else if (mode.type === SystemMode.VACATION) {
                themeBg = "bg-emerald-50/75 border-emerald-200/60 text-emerald-950";
                badgeLabel = "寒暑假自主";
              } else if (mode.type === SystemMode.CUSTOM) {
                themeBg = "bg-indigo-50/75 border-indigo-200/60 text-indigo-950";
                badgeLabel = "自訂計畫";
              }

              // Calculate day intervals
              const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const elapsedDays = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const remainingDays = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;

              return (
                <div
                  key={mode.id}
                  style={{
                    border: isCurrentActive ? "2px solid #5B7283" : "1px solid #E8E2D8",
                    background: isCurrentActive ? "#FFF" : "#FCFBF9",
                  }}
                  className="rounded-2xl p-5.5 transition shadow-xs flex flex-col gap-3.5 relative cursor-pointer hover:bg-white/80 hover:shadow-md"
                  onClick={() => setExpandedModeId(isExpanded ? null : mode.id)}
                >
                  {/* Desktop Layout - Hidden on mobile */}
                  <div className="hidden md:flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3.5">
                      <span className="text-3xl select-none">{mode.icon || "✈️"}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm md:text-lg text-[#3C332D]">{mode.name}</h4>
                          <span className={`text-[10.5px] md:text-sm font-black tracking-wider px-2.5 py-1 rounded-full border ${themeBg}`}>
                            {badgeLabel}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[10.5px] md:text-sm font-black bg-rose-100 text-rose-700 px-3 py-1 rounded-full border border-rose-200 animate-pulse">
                              進行中 | 第 {elapsedDays} 天
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[10.5px] md:text-sm font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-200">
                              未開始 | 倒數 {Math.round((start.getTime() - today.getTime()) / (1000 * 3600 * 24))} 天
                            </span>
                          )}
                          {isPast && (
                            <span className="text-[10.5px] md:text-sm font-normal bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">
                              已結束歷史
                            </span>
                          )}
                        </div>
                        <p className="text-xs md:text-base text-gray-450 font-mono mt-1.5 flex items-center gap-1.5 font-bold">
                          <span>📅</span>
                          <span>{mode.startDate} ～ {mode.endDate} ({totalDays} 天)</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedModeId(isExpanded ? null : mode.id);
                        }}
                        className="p-2 px-3.5 md:p-3 md:px-5 rounded-xl bg-white hover:bg-gray-100 border-2 border-[#E8E2D8] text-[#7C6354] transition cursor-pointer flex items-center gap-1.5"
                        title="查看詳細計畫手記"
                      >
                        <span className="text-xs md:text-sm font-black">詳情</span>
                        {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                      </button>
                      
                      {isParent && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditMode(mode);
                            }}
                            className="p-2.5 md:p-3.5 rounded-xl bg-white hover:bg-sky-50 border-2 border-[#E8E2D8] text-sky-600 transition cursor-pointer"
                            title="編輯此計畫"
                          >
                            <Edit3 className="h-4.5 w-4.5 md:h-5 md:w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModeClick(mode.id, mode.name);
                            }}
                            className="p-2.5 md:p-3.5 rounded-xl bg-white hover:bg-rose-50 border-2 border-[#E8E2D8] text-rose-500 transition cursor-pointer"
                            title="刪除此計畫"
                          >
                            <Trash2 className="h-4.5 w-4.5 md:h-5 md:w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout - Show only on mobile */}
                  <div className="md:hidden flex flex-col gap-3.5 w-full">
                    {/* Row 1: Icon + Title, Status Badge + Category */}
                    <div className="flex items-start gap-3">
                      <span className="text-3xl select-none shrink-0">{mode.icon || "✈️"}</span>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-extrabold text-[#3C332D] text-base leading-snug break-words">{mode.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border ${themeBg}`}>
                            🏷️ {badgeLabel}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                              🔴 進行中 | 第 {elapsedDays} 天
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                              🔵 未開始 | 倒數 {Math.round((start.getTime() - today.getTime()) / (1000 * 3600 * 24))} 天
                            </span>
                          )}
                          {isPast && (
                            <span className="text-[10px] font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                              ⚪ 已結束歷史
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Date + Days Range */}
                    <div className="bg-[#FAF8F5] border border-[#F0ECE4] rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-750 font-bold">
                        <span className="text-sm">📅</span>
                        <span>{mode.startDate.replace(/-/g, "/")} ～ {mode.endDate.replace(/-/g, "/")}</span>
                      </div>
                      <span className="text-xs font-black bg-amber-50 text-[#8B6B56] border border-amber-200/50 px-2 py-0.5 rounded-md">
                        共 {totalDays} 天
                      </span>
                    </div>

                    {/* Divider line before control buttons */}
                    <div className="border-t border-[#F0ECE4] my-0.5" />

                    {/* Row 3: Actions buttons wrapper */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedModeId(isExpanded ? null : mode.id);
                        }}
                        className="h-9 px-4 rounded-xl bg-white hover:bg-gray-100 border border-[#E8E2D8] text-[#7C6354] transition cursor-pointer flex items-center justify-center gap-1 flex-1 shadow-xs"
                        title="查看詳細計畫手記"
                      >
                        <span className="text-xs font-black">詳細</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isParent && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditMode(mode);
                            }}
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white hover:bg-sky-50 border border-[#E8E2D8] text-sky-600 transition cursor-pointer shadow-xs shrink-0"
                            title="編輯此計畫"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModeClick(mode.id, mode.name);
                            }}
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white hover:bg-rose-50 border border-[#E8E2D8] text-rose-500 transition cursor-pointer shadow-xs shrink-0"
                            title="刪除此計畫"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Plan Details Container */}
                  {isExpanded && (
                    <div className="mt-3.5 pt-4.5 border-t border-dashed border-[#E8E2D8] space-y-4" onClick={(e) => e.stopPropagation()}>
                      
                      {/* A. Travel Module Details */}
                      {mode.type === SystemMode.TRAVEL && (
                        <div className="space-y-4">
                          <div className="bg-orange-50/25 p-4 rounded-xl border-2 border-orange-200/50 space-y-2 text-gray-750">
                            <p className="font-extrabold flex items-center gap-1.5 text-sm md:text-base text-[#5E4029]">
                              ✈️ 航班乘降與旅途交通：
                              <span className="bg-orange-100 text-xs px-2.5 py-1 rounded font-mono font-black border border-orange-200 text-orange-850">
                                {mode.airline} {mode.flightNumber}
                              </span>
                            </p>
                            <p className="text-xs md:text-sm text-gray-500 font-bold leading-normal">
                              去程預定 <b>{mode.departureTime}</b>（{mode.departureTerminal || "T2"} 航廈） ｜ 回程預定 <b>{mode.returnTime}</b>（{mode.returnTerminal || "T1"} 航廈）
                            </p>
                            {mode.notes && (
                              <p className="italic text-gray-555 text-xs md:text-sm border-l-4 border-orange-250 pl-3 leading-relaxed">
                                備註小叮嚀：{mode.notes}
                              </p>
                            )}
                          </div>

                          <span className="font-black text-[#5E4029] block mt-1.5 text-xs md:text-sm uppercase tracking-wider">
                            🗺️ 每日詳細行程與食宿精簡表 (家長可點擊直接輸入且 Blur 儲存)：
                          </span>
                          
                          <div className="space-y-6 bg-white p-5 rounded-2xl border border-orange-200 max-h-[450px] overflow-y-auto">
                            {Object.keys(mode.itinerary || {}).sort().map((date, idx) => {
                              const item = mode.itinerary?.[date] || {};
                              
                              return (
                                <div key={date} className="pb-5 border-b border-gray-150 last:border-b-0 last:pb-0 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-[#FFF8F5] text-orange-950 border border-orange-150 px-3 py-1 rounded-xl font-bold text-xs sm:text-sm">
                                      Day {idx + 1} ({date})
                                    </span>
                                  </div>

                                  <div className="space-y-2.5 pl-1.5 font-sans">
                                    {/* Row 1: 早上行程 */}
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                                        早上行程：
                                      </span>
                                      <input
                                        type="text"
                                        defaultValue={item.morning || ""}
                                        disabled={!isParent}
                                        onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "morning", e.target.value)}
                                        placeholder={isParent ? "輸入行程，例：搭飛機前往北海道..." : "（未設定）"}
                                        className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 text-xs sm:text-sm font-semibold text-gray-850 transition-all focus:outline-none"
                                      />
                                    </div>

                                    {/* Row 2: 下午行程 */}
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                                        下午行程：
                                      </span>
                                      <input
                                        type="text"
                                        defaultValue={item.afternoon || ""}
                                        disabled={!isParent}
                                        onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "afternoon", e.target.value)}
                                        placeholder={isParent ? "輸入行程，例：小樽運河散步..." : "（未設定）"}
                                        className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 text-xs sm:text-sm font-semibold text-gray-850 transition-all focus:outline-none"
                                      />
                                    </div>

                                    {/* Row 3: 午餐安排 */}
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                                        午餐安排：
                                      </span>
                                      <input
                                        type="text"
                                        defaultValue={item.lunch || ""}
                                        disabled={!isParent}
                                        onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "lunch", e.target.value)}
                                        placeholder={isParent ? "輸入午餐，例：機場餐廳..." : "（未設定）"}
                                        className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 text-xs sm:text-sm font-semibold text-gray-850 transition-all focus:outline-none"
                                      />
                                    </div>

                                    {/* Row 4: 晚餐安排 */}
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                                        晚餐安排：
                                      </span>
                                      <input
                                        type="text"
                                        defaultValue={item.dinner || ""}
                                        disabled={!isParent}
                                        onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "dinner", e.target.value)}
                                        placeholder={isParent ? "輸入晚餐，例：海鮮丼飯..." : "（未設定）"}
                                        className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 text-xs sm:text-sm font-semibold text-gray-850 transition-all focus:outline-none"
                                      />
                                    </div>

                                    {/* Row 5: 住宿 */}
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-gray-600 font-bold text-xs sm:text-sm shrink-0 w-[72px] text-right">
                                        住宿：
                                      </span>
                                      <input
                                        type="text"
                                        defaultValue={item.lodging || ""}
                                        disabled={!isParent}
                                        onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "lodging", e.target.value)}
                                        placeholder={isParent ? "輸入住宿，例：札幌王子飯店..." : "（未設定）"}
                                        className="flex-grow bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 text-xs sm:text-sm font-semibold text-gray-850 transition-all focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* B. Exam Subjects Checklist */}
                      {mode.type === SystemMode.EXAM && (
                        <div className="space-y-3 bg-[#FFFDF7] border-2 border-purple-150 p-5 rounded-2xl text-purple-950">
                          <p className="font-black text-xs md:text-base text-purple-900 border-b-2 border-purple-100 pb-2 flex items-center gap-1.5">
                            📚 期考大作戰：複習科目焦點與承諾事項
                          </p>
                          {mode.subjects && mode.subjects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 font-bold text-sm md:text-base">
                              {mode.subjects.map((sub: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3.5 bg-white border border-purple-150 rounded-xl shadow-xs">
                                  <span className="font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-lg shrink-0 text-xs md:text-sm">
                                    {sub.name}
                                  </span>
                                  <span className="text-gray-650 font-black text-right truncate max-w-[200px]">
                                    {sub.target || "精熟全書重點"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-sm">尚未新增考科規劃</p>
                          )}
                        </div>
                      )}

                      {/* C. Vacation Daily Tasks Indicator */}
                      {mode.type === SystemMode.VACATION && (
                        <div className="space-y-3 bg-[#F9FFF8] border-2 border-emerald-150 p-5 rounded-2xl text-emerald-950">
                          <p className="font-black text-xs md:text-base text-emerald-900 border-b-2 border-emerald-50 pb-2 flex items-center justify-between">
                            <span>🌻 {mode.vacationType || "寒暑期"}打卡清單 (打勾完成自我進度)：</span>
                          </p>
                          {mode.dailyTasks && mode.dailyTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5 font-bold text-sm md:text-base">
                              {mode.dailyTasks.map((task: any, idx: number) => (
                                <div 
                                  key={task.id || idx} 
                                  onClick={() => handleToggleTaskCompleted(mode, task.id, "vacation")}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer select-none transition ${
                                    task.completed 
                                      ? "bg-emerald-50/50 border-emerald-300 text-emerald-800 line-through opacity-70"
                                      : "bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/20"
                                  }`}
                                >
                                  <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition shrink-0 ${
                                    task.completed ? "bg-emerald-600 border-emerald-600 text-white" : "border-emerald-300 bg-white"
                                  }`}>
                                    {task.completed && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-xs md:text-sm font-black">{task.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-sm">尚未新增每日生活打卡清單</p>
                          )}
                        </div>
                      )}

                      {/* D. Custom Tasks Checklist */}
                      {mode.type === SystemMode.CUSTOM && (
                        <div className="space-y-3 bg-[#FCFDFF] border-2 border-indigo-150 p-5 rounded-2xl text-indigo-950">
                          <p className="font-black text-xs md:text-base text-indigo-900 border-b-2 border-indigo-50 pb-2 flex items-center justify-between">
                            <span>🎨 家庭自訂活約定 (打勾紀錄本日進度)：</span>
                          </p>
                          {mode.customTasks && mode.customTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5 font-black text-sm md:text-base">
                              {mode.customTasks.map((task: any, idx: number) => (
                                <div 
                                  key={task.id || idx} 
                                  onClick={() => handleToggleTaskCompleted(mode, task.id, "custom")}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer select-none transition ${
                                    task.completed 
                                      ? "bg-indigo-50/50 border-indigo-300 text-indigo-800 line-through opacity-70"
                                      : "bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/20"
                                  }`}
                                >
                                  <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition shrink-0 ${
                                    task.completed ? "bg-indigo-600 border-indigo-600 text-white" : "border-indigo-300 bg-white"
                                  }`}>
                                    {task.completed && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-xs md:text-sm font-black">{task.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-sm">尚未新增自訂生活打卡清單</p>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔮 Mode Scheduling Creator Form Modal */}
      {showModeModal && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-lg w-full shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowModeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#2D2926]">
                  {editingModeConfig ? "🔧 編輯特別期間設定" : "✨ 建立特別期間安排"}
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">預約特別期間，系統將自動套用色彩與對應作息小提示</p>
              </div>
            </div>

            <form onSubmit={handleSaveModeSubmit} className="space-y-4 font-sans text-xs">
              
              {/* Type Category Selection */}
              <div className="space-y-1">
                <label className="block font-black text-[#3C332D]">1. 選擇特別期間類別：</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: SystemMode.TRAVEL, label: "✈ 旅遊計畫", icon: "✈" },
                    { id: SystemMode.CUSTOM, label: "🎨 其它自訂", icon: "🎨" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => {
                        setModeFormType(opt.id);
                        setModeFormIcon(opt.icon);
                        if (opt.id === SystemMode.TRAVEL) {
                          setModeFormName("峇里島渡假之旅");
                          setModeFormColor("orange");
                        } else if (opt.id === SystemMode.EXAM) {
                          setModeFormName("期末考衝刺週");
                          setModeFormColor("purple");
                        } else if (opt.id === SystemMode.VACATION) {
                          setModeFormName("暑假自主學堂");
                          setModeFormColor("emerald");
                        } else {
                          setModeFormName("家庭特別安排計畫");
                          setModeFormColor("indigo");
                        }
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                        modeFormType === opt.id
                          ? "ring-2 ring-indigo-500 bg-indigo-50/20 border-transparent font-extrabold"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-[9px] truncate font-bold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name input */}
              <div className="space-y-1">
                <label className="block font-black text-gray-750">2. 自訂特別期間名稱：</label>
                <input
                  type="text"
                  required
                  placeholder={
                    modeFormType === SystemMode.TRAVEL
                      ? "例如：峇里島親子旅行"
                      : modeFormType === SystemMode.EXAM
                      ? "例如：期末考衝刺週"
                      : modeFormType === SystemMode.VACATION
                      ? "例如：暑假自主學堂"
                      : "例如：家庭自訂計畫..."
                  }
                  value={modeFormName}
                  onChange={(e) => setModeFormName(e.target.value)}
                  className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none text-xs font-bold"
                />
              </div>

              {/* Date interval (Single Date Range Picker) */}
              <div className="space-y-1.5 relative font-sans">
                <label className="block text-xs font-black text-gray-700">3. 📅 選擇活動日期區間：</label>
                <button
                  type="button"
                  onClick={() => setShowRangeCalendar(!showRangeCalendar)}
                  className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center justify-between transition text-xs font-bold text-gray-800 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    📅 {modeFormStartDate ? modeFormStartDate.replace(/-/g, "/") : "尚未選擇開始日"} ～ {modeFormEndDate ? modeFormEndDate.replace(/-/g, "/") : "尚未選擇結束日"}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-extrabold hover:underline">
                    {showRangeCalendar ? "▲ 收起日曆" : "▼ 展開日曆"}
                  </span>
                </button>

                {showRangeCalendar && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl p-3 shadow-xl z-55 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (pickerMonth === 0) {
                            setPickerMonth(11);
                            setPickerYear(pickerYear - 1);
                          } else {
                            setPickerMonth(pickerMonth - 1);
                          }
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 font-bold"
                      >
                        ◀
                      </button>
                      <span className="font-extrabold text-gray-800 text-xs">
                        {pickerYear} 年 {pickerMonth + 1} 月
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (pickerMonth === 11) {
                            setPickerMonth(0);
                            setPickerYear(pickerYear + 1);
                          } else {
                            setPickerMonth(pickerMonth + 1);
                          }
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 font-bold"
                      >
                        ▶
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-gray-400">
                      {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
                        <div key={w} className="py-0.5">{w}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty cells representing days of previous month */}
                      {Array.from({ length: getFirstDayOfMonth(pickerYear, pickerMonth) }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}

                      {/* Actual days of active picker month */}
                      {Array.from({ length: getDaysInMonth(pickerYear, pickerMonth) }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                        
                        const isStart = dateStr === modeFormStartDate;
                        const isEnd = dateStr === modeFormEndDate;
                        const inBetween = modeFormStartDate && modeFormEndDate && dateStr > modeFormStartDate && dateStr < modeFormEndDate;
                        const isToday = dateStr === (simulatedTodayDate || getLocalToday());

                        let cellClass = "p-1.5 rounded-lg text-center cursor-pointer text-xs font-bold transition hover:bg-indigo-50 ";
                        if (isStart || isEnd) {
                          cellClass += "bg-indigo-600 text-white font-black hover:bg-indigo-700";
                        } else if (inBetween) {
                          cellClass += "bg-indigo-50 text-indigo-905 border border-dashed border-indigo-200";
                        } else if (isToday) {
                          cellClass += "bg-amber-50 text-amber-900 border border-amber-300 font-black";
                        } else {
                          cellClass += "text-gray-700 bg-white hover:bg-gray-50";
                        }

                        return (
                          <button
                            type="button"
                            key={dayNum}
                            onClick={() => {
                              if (rangeSelectStep === "start") {
                                setModeFormStartDate(dateStr);
                                setModeFormEndDate(""); // clear past end upon picking new start
                                setRangeSelectStep("end");
                              } else {
                                if (dateStr < modeFormStartDate) {
                                  // Clicked date is earlier than start, make it start instead
                                  setModeFormStartDate(dateStr);
                                  setRangeSelectStep("end");
                                } else {
                                  setModeFormEndDate(dateStr);
                                  setRangeSelectStep("start");
                                  setShowRangeCalendar(false); // Done selector, auto close
                                }
                              }
                            }}
                            className={cellClass}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 text-[10px] text-gray-400 font-normal leading-normal flex items-center justify-between border-t">
                      <span>💡 點選第一個日期設定起始、第二個日期設定結束</span>
                      <button
                        type="button"
                        onClick={() => {
                          setModeFormStartDate("");
                          setModeFormEndDate("");
                          setRangeSelectStep("start");
                        }}
                        className="text-indigo-605 hover:underline font-bold"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Validation error display */}
              {validationError && (
                <div className="bg-red-50 text-red-650 border border-red-200 text-xs rounded-xl px-3 py-2 font-bold leading-normal">
                  ⚠️ {validationError}
                </div>
              )}

              {/* Dynamic form payload options */}
              {modeFormType === SystemMode.CUSTOM ? (
                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-black text-gray-700">4. 📝 自訂備註與備忘內容：</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="例如：自訂計畫描述、每日任務、隨行提醒等..."
                    className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-[#E8E2D8] focus:border-indigo-400 focus:bg-white focus:outline-none text-xs font-bold leading-normal"
                  />
                </div>
              ) : (
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 max-h-[220px] overflow-y-auto space-y-3 font-sans">
                
                {/* 1. Travel Config Options */}
                {modeFormType === SystemMode.TRAVEL && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-extrabold text-[#7C6354] border-b pb-1">✈ 預填航班與交通計畫：</h4>
                    
                    <div className="space-y-1">
                      <label className="block font-bold">目的地類別：</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="trType"
                            checked={travelType === "international"}
                            onChange={() => setTravelType("international")}
                          />
                          <span>🌎 境外國外旅遊</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="trType"
                            checked={travelType === "domestic"}
                            onChange={() => setTravelType("domestic")}
                          />
                          <span>🚗 境內國內旅遊</span>
                        </label>
                      </div>
                    </div>

                    {travelType === "international" ? ( // Verified Flight Block Extension
                      <div className="space-y-4">
                        {/* 去程資訊 */}
                        <div className="bg-[#FAF8F5] border border-[#E9E4DB] rounded-xl p-3 space-y-2.5">
                          <h5 className="font-extrabold text-[#7C6250] text-[11.5px] pb-1 border-b border-[#E9E4DB]/60 flex items-center gap-1">
                            ✈️ 去程航班 (Departure Flight)
                          </h5>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">航空公司：</label>
                              <input
                                type="text"
                                value={departureAirline}
                                onChange={(e) => {
                                  setDepartureAirline(e.target.value);
                                  setAirLine(e.target.value);
                                }}
                                placeholder="例如：中華航空"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">航班號碼：</label>
                              <input
                                type="text"
                                value={departureFlightNumber}
                                onChange={(e) => {
                                  setDepartureFlightNumber(e.target.value);
                                  setFlightNumber(e.target.value);
                                }}
                                placeholder="例如：CI771"
                                className="w-full bg-[#FCFBF8] rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發日期：</label>
                              <input
                                type="text"
                                value={departureDate}
                                onChange={(e) => setDepartureDate(e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發時間：</label>
                              <input
                                type="text"
                                value={departureTime}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                placeholder="例如：09:10"
                                className="w-full bg-[#FCFBF8] rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="col-span-2">
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達日期：</label>
                              <input
                                type="text"
                                value={departureArrivalDate}
                                onChange={(e) => setDepartureArrivalDate(e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達時間：</label>
                              <input
                                type="text"
                                value={departureArrivalTime}
                                onChange={(e) => setDepartureArrivalTime(e.target.value)}
                                placeholder="14:35"
                                className="w-full bg-[#FCFBF8] rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發機場：</label>
                              <input
                                type="text"
                                value={departureAirport}
                                onChange={(e) => setDepartureAirport(e.target.value)}
                                placeholder="例如：桃園機場"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達機場：</label>
                              <input
                                type="text"
                                value={departureArrivalAirport}
                                onChange={(e) => setDepartureArrivalAirport(e.target.value)}
                                placeholder="新千歲機場"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">Terminal：</label>
                              <input
                                type="text"
                                value={departureTerminal}
                                onChange={(e) => setDepartureTerminal(e.target.value)}
                                placeholder="T2"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 回程資訊 */}
                        <div className="bg-[#F5F8FA] border border-[#DCE4E9] rounded-xl p-3 space-y-2.5">
                          <h5 className="font-extrabold text-[#4A6076] text-[11.5px] pb-1 border-b border-[#DCE4E9]/60 flex items-center gap-1">
                            ✈️ 回程航班 (Return Flight)
                          </h5>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">航空公司：</label>
                              <input
                                type="text"
                                value={returnAirline}
                                onChange={(e) => setReturnAirline(e.target.value)}
                                placeholder="例如：中華航空"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">航班號碼：</label>
                              <input
                                type="text"
                                value={returnFlightNumber}
                                onChange={(e) => setReturnFlightNumber(e.target.value)}
                                placeholder="例如：CI772"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發日期：</label>
                              <input
                                type="text"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發時間：</label>
                              <input
                                type="text"
                                value={returnTime}
                                onChange={(e) => setReturnTime(e.target.value)}
                                placeholder="例如：15:20"
                                className="w-full bg-[#FCFBF8] rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="col-span-2">
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達日期：</label>
                              <input
                                type="text"
                                value={returnArrivalDate}
                                onChange={(e) => setReturnArrivalDate(e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達時間：</label>
                              <input
                                type="text"
                                value={returnArrivalTime}
                                onChange={(e) => setReturnArrivalTime(e.target.value)}
                                placeholder="18:45"
                                className="w-full bg-[#FCFBF8] rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">出發機場：</label>
                              <input
                                type="text"
                                value={returnAirport}
                                onChange={(e) => setReturnAirport(e.target.value)}
                                placeholder="例如：新千歲機場"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">抵達機場：</label>
                              <input
                                type="text"
                                value={returnArrivalAirport}
                                onChange={(e) => setReturnArrivalAirport(e.target.value)}
                                placeholder="桃園機場"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 font-extrabold block">Terminal：</label>
                              <input
                                type="text"
                                value={returnTerminal}
                                onChange={(e) => setReturnTerminal(e.target.value)}
                                placeholder="T2"
                                className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-semibold text-gray-750"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={passportReminder}
                              onChange={(e) => setPassportReminder(e.target.checked)}
                            />
                            <span className="font-bold text-gray-700">🔍 護照檢查提示</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={visaReminder}
                              onChange={(e) => setVisaReminder(e.target.checked)}
                            />
                            <span className="font-bold text-gray-700">🔍 簽證登記提示</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-gray-400">主要自駕/公共交通：</label>
                          <select
                            value={transportation}
                            onChange={(e) => setTransportation(e.target.value)}
                            className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                          >
                            <option value="drive">🚗 自行開車</option>
                            <option value="hightrain">🚄 台灣高鐵</option>
                            <option value="train">🚆 台灣鐵路</option>
                            <option value="bus">🚌 長途客運</option>
                            <option value="rent">🔑 租車自駕</option>
                            <option value="custom">🛠 其他自訂</option>
                          </select>
                        </div>
                        {transportation === "custom" && (
                          <div>
                            <label className="text-[10px] text-gray-400">填寫自訂交通：</label>
                            <input
                              type="text"
                              value={customTransportation}
                              onChange={(e) => setCustomTransportation(e.target.value)}
                              placeholder="例如包車遊覽、接駁..."
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-gray-400 font-bold">隨行備註、重要提示：</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="帶泳裝、水杯、防曬、感冒藥..."
                        className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Exam Config Options */}
                {modeFormType === SystemMode.EXAM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-purple-700 border-b pb-1 pb-1">📚 溫理衝刺：各科目複習指標設定</h4>
                    <p className="text-[9px] text-gray-400 leading-normal leading-normal">
                      為孩子預填考試科目，系統生效期間將自動加乘日常作業與自律表現的星星回饋！
                    </p>
                    <div className="space-y-2">
                      {examSubjects.map((subject, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-1.5 rounded-lg border border-gray-200 font-sans">
                          <span className="font-black text-[#3C332D] w-12 shrink-0">{subject.name}</span>
                          <input
                            type="text"
                            value={subject.target}
                            onChange={(e) => {
                              const newList = [...examSubjects];
                              newList[idx].target = e.target.value;
                              setExamSubjects(newList);
                            }}
                            placeholder="輸入此科目擬考進度複習焦點..."
                            className="bg-transparent flex-grow text-[11px] p-0.5 border-b border-gray-150 focus:border-purple-300 focus:outline-none font-bold"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 font-sans text-xs">
                      <span className="font-extrabold text-[10px] block mb-1">🔍 擴充增設科目：</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSubjectInput}
                          placeholder="例如 社會、自然、體育"
                          onChange={(e) => setNewSubjectInput(e.target.value)}
                          className="flex-grow bg-white p-1.5 border rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubjectInput.trim()) return;
                            setExamSubjects([...examSubjects, { name: newSubjectInput.trim(), target: "" }]);
                            setNewSubjectInput("");
                          }}
                          className="px-3 bg-purple-600 text-white rounded-lg font-bold text-xs"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Vacation Config Options */}
                {modeFormType === SystemMode.VACATION && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-emerald-800 border-b pb-1 font-sans">🏡 寒暑假生活起居規律打卡項目</h4>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-gray-500">1. 假期主類別：</label>
                      <select
                        value={vacationType}
                        onChange={(e) => setVacationType(e.target.value)}
                        className="w-full bg-white rounded-lg p-1.5 border border-gray-200 font-bold"
                      >
                        <option value="暑假">🍉 暑假自主學習規劃</option>
                        <option value="寒假">🧣 寒假冬令作息規律</option>
                        <option value="夏令營">🏕 夏令營主題挑戰計畫</option>
                        <option value="約定寄宿">👵 寄宿別家特別約定</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-bold">2. 約定每日自我生活打卡小任務 ({vacationDailyTasks.length})：</label>
                      <div className="space-y-1 text-gray-650 font-medium font-sans text-xs">
                        {vacationDailyTasks.map((t) => (
                          <div key={t.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-gray-100">
                            <span>{t.text}</span>
                            <button
                              type="button"
                              onClick={() => setVacationDailyTasks(vacationDailyTasks.filter(item => item.id !== t.id))}
                              className="text-red-500 hover:text-red-700 font-black text-[9px] cursor-pointer"
                            >
                              移除
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1 font-sans">
                        <input
                          type="text"
                          value={newVacationTask}
                          placeholder="例如 慢跑15分鐘、背5個單字"
                          onChange={(e) => setNewVacationTask(e.target.value)}
                          className="flex-grow bg-white rounded-lg p-1.5 border border-gray-200 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newVacationTask.trim()) return;
                            setVacationDailyTasks([...vacationDailyTasks, { id: `${Date.now()}`, text: newVacationTask.trim() }]);
                            setNewVacationTask("");
                          }}
                          className="bg-emerald-600 text-white rounded-lg font-bold px-3 text-xs"
                        >
                          加入
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

              {/* Submit Button Row */}
              <div className="pt-3.5 border-t border-gray-100 flex justify-end gap-2.5 font-sans">
                <button
                  type="button"
                  onClick={() => setShowModeModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-xl transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-black bg-[#7C6354] hover:bg-[#5E4E42] text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1"
                >
                  {isUpdating ? "發定生效中..." : editingModeConfig ? "儲存修改 ✔" : "確認建立期間 ✈"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel delete confirmation modal box */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#E5E1DA] p-6 max-w-sm w-full shadow-2xl relative font-sans text-xs">
            <h3 className="text-sm font-black text-red-700 flex items-center gap-1.5 pb-2 border-b border-gray-100">
              ⚠️ 撤銷特別期間安排確認
            </h3>
            <div className="text-xs text-gray-600 leading-relaxed py-4 space-y-2">
              <p>您確定要提早撤銷 <b>{confirmDeleteName}</b> 此日期區間的特別期間安排嗎？</p>
              <p className="block mt-2.5 text-[#855D46] bg-[#FFFBF7] p-2.5 rounded-xl border border-[#F2ECE4] font-black">
                📢 同步處理解除設定：您希望連同月曆中對應建立的活動行程，一起撤銷刪除嗎？
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => handleConfirmDeleteSubmit(true)}
                disabled={isDeleting}
                className="w-full py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition hover:scale-[1.01] cursor-pointer text-center"
              >
                {isDeleting ? "處理中..." : "💥 全部刪除 (連同月曆行程)"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteSubmit(false)}
                disabled={isDeleting}
                className="w-full py-2.5 text-xs font-bold text-[#5B493E] bg-[#FAFAF7] hover:bg-[#F2ECE0] rounded-xl border border-[#EAF0F6] transition hover:scale-[1.01] cursor-pointer text-center"
              >
                {isDeleting ? "處理中..." : "🗑️ 只刪除特別期間 (保留月曆行程)"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer text-center mt-1"
              >
                先不要 (取消)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
