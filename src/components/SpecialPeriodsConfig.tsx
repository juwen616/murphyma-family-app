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
  
  // Form values
  const [modeFormType, setModeFormType] = useState<SystemMode>(SystemMode.TRAVEL);
  const [modeFormName, setModeFormName] = useState("");
  const [modeFormStartDate, setModeFormStartDate] = useState("2026-07-18");
  const [modeFormEndDate, setModeFormEndDate] = useState("2026-07-25");
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
  const [passportReminder, setPassportReminder] = useState(false);
  const [visaReminder, setVisaReminder] = useState(false);
  const [notes, setNotes] = useState("");
  const [transportation, setTransportation] = useState("drive");
  const [customTransportation, setCustomTransportation] = useState("");

  // Mode Specific - Exam
  const [examSubjects, setExamSubjects] = useState<Array<{ name: string; target: string }>>([
    { name: "國語", target: "" },
    { name: "數學", target: "" },
    { name: "英文", target: "" },
  ]);
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [examDailyPlans, setExamDailyPlans] = useState<Array<{ id: string; startTime: string; endTime: string; subjectName: string }>>([
    { id: "1", startTime: "18:00", endTime: "18:30", subjectName: "數學" },
    { id: "2", startTime: "18:30", endTime: "19:00", subjectName: "英文" },
  ]);

  // Mode Specific - Vacation
  const [vacationType, setVacationType] = useState("暑假");
  const [vacationDailyTasks, setVacationDailyTasks] = useState<Array<{ id: string; text: string }>>([
    { id: "1", text: "閱讀30分鐘" },
    { id: "2", text: "練鋼琴" },
    { id: "3", text: "寫作業" },
  ]);
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
    // End date defaults to +7 days
    const nextWeek = new Date(new Date(today).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setModeFormStartDate(today);
    setModeFormEndDate(nextWeek);

    if (typeState === SystemMode.TRAVEL) {
      setModeFormName("峇里島渡假之旅");
      setModeFormIcon("✈");
      setModeFormColor("orange");
      setTravelType("international");
      setAirLine("星宇航空");
      setFlightNumber("JX721");
      setDepartureTime("09:50");
      setReturnTime("16:45");
      setDepartureTerminal("T2");
      setReturnTerminal("T1");
      setPassportReminder(true);
      setVisaReminder(true);
      setNotes("記得帶防曬、泳裝與泳帽");
    } else if (typeState === SystemMode.EXAM) {
      setModeFormName("期末考衝刺週");
      setModeFormIcon("📚");
      setModeFormColor("purple");
      setExamSubjects([
        { name: "國語", target: "複習生字與課文" },
        { name: "數學", target: "加強練習單元八九" },
        { name: "英文", target: "熟背第三單元單字" },
      ]);
    } else if (typeState === SystemMode.VACATION) {
      setModeFormName("暑假自主學堂");
      setModeFormIcon("🏡");
      setModeFormColor("emerald");
      setVacationType("暑假");
      setVacationDailyTasks([
        { id: "1", text: "閱讀30分鐘" },
        { id: "2", text: "練鋼琴打卡" },
        { id: "3", text: "做假期作業一頁" },
      ]);
    } else {
      setModeFormName("家庭特別安排計畫");
      setModeFormIcon("🎨");
      setModeFormColor("indigo");
      setCustomTasks([
        { id: "1", text: "收拾自己的小房間" },
        { id: "2", text: "每天喝水量達 1200cc" },
      ]);
    }

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

    if (mode.type === SystemMode.TRAVEL) {
      setTravelType(mode.travelType || "international");
      setAirLine(mode.airline || "");
      setFlightNumber(mode.flightNumber || "");
      setDepartureTime(mode.departureTime || "");
      setReturnTime(mode.returnTime || "");
      setDepartureTerminal(mode.departureTerminal || "");
      setReturnTerminal(mode.returnTerminal || "");
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
    }

    setShowModeModal(true);
  };

  // Save changes submit
  const handleSaveModeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    const modeId = editingModeConfig?.id || `mode_v_${Math.random().toString(36).substr(2, 9)}`;

    const payload: ConfiguredMode = {
      id: modeId,
      type: modeFormType,
      name: modeFormName || (
        modeFormType === SystemMode.TRAVEL ? "峇里島旅行" :
        modeFormType === SystemMode.EXAM ? "期中考" :
        modeFormType === SystemMode.VACATION ? "暑假規劃" : "自訂計畫"
      ),
      icon: modeFormIcon,
      color: modeFormColor,
      startDate: modeFormStartDate || getLocalToday(),
      endDate: modeFormEndDate || "2026-06-30",
      createdAt: editingModeConfig?.createdAt || new Date(),
    };

    if (modeFormType === SystemMode.TRAVEL) {
      payload.travelType = travelType;
      payload.airline = airLine;
      payload.flightNumber = flightNumber;
      payload.departureTime = departureTime;
      payload.returnTime = returnTime;
      payload.departureTerminal = departureTerminal;
      payload.returnTerminal = returnTerminal;
      payload.passportReminder = passportReminder;
      payload.visaReminder = visaReminder;
      payload.notes = notes;
      payload.transportation = transportation === "custom" ? (customTransportation || "自訂交通") : transportation;

      if (editingModeConfig?.itinerary) {
        payload.itinerary = editingModeConfig.itinerary;
      } else {
        const genItinerary: any = {};
        const start = new Date(payload.startDate);
        const end = new Date(payload.endDate);
        const current = new Date(start);
        let idx = 1;
        while (current <= end) {
          const dStr = current.toISOString().split("T")[0];
          if (idx === 1) {
            genItinerary[dStr] = {
              breakfast: "別墅附贈活力朝食",
              morning: "機場辦理登機通關 ✈",
              lunch: "飛機美味輕食餐盒",
              afternoon: "飛抵浪漫度假島、專車接送飯店",
              dinner: "在地南洋沙爹風味串燒饗宴",
              night: "海濱沙灘散步吹海風、沉澱身心",
              lodging: "海景景觀豪華大飯店",
              transport: "貼心包車接引",
              customNotes: "第一天早點安歇，調適行李時差唷！",
              todayTheme: "移動日",
              todayRemarks: "記得隨身準備護照，第一天調適時差早點休息！",
            };
          } else {
            genItinerary[dStr] = {
              breakfast: "飯店美式自助早餐",
              morning: "走訪藝術市集與精緻手作",
              lunch: "印尼皇家香烤髒鴨風味餐",
              afternoon: "放鬆舒壓的精油 SPA 按摩體驗",
              dinner: "金色夕陽海灘精緻海鮮熱烈 BBQ",
              night: "大廳現場樂隊演奏、品味鮮椰子汁",
              lodging: "海灘五星度假別墅",
              transport: "專業導遊包車",
              customNotes: "買手工藝品要用點心技巧殺價喔！",
              todayTheme: "文化探索日",
              todayRemarks: "14:00 SPA預約\n17:30 看金色夕陽\n傍晚海灘可能風大，帶件薄外套唷！",
            };
          }
          current.setDate(current.getDate() + 1);
          idx++;
        }
        payload.itinerary = genItinerary;
      }
    } else if (modeFormType === SystemMode.EXAM) {
      payload.subjects = examSubjects.filter(s => s.name.trim() !== "");
      payload.dailyPlan = examDailyPlans;
    } else if (modeFormType === SystemMode.VACATION) {
      payload.vacationType = vacationType;
      payload.dailyTasks = vacationDailyTasks.map(t => ({ id: t.id, text: t.text, completed: false }));
    } else if (modeFormType === SystemMode.CUSTOM) {
      payload.customTasks = customTasks.map(t => ({ id: t.id, text: t.text, completed: false }));
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
    <div className="space-y-6">
      {/* 🚀 Header Brand Description */}
      <div className="bg-gradient-to-r from-[#9DC2C9]/20 to-[#FAF8F4] border border-[#E8E2D8] rounded-3xl p-6 shadow-xs font-sans">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center border border-[#9DC2C9] text-2xl shadow-sm shrink-0">
            🗓️
          </div>
          <div>
            <h2 className="text-sm font-black text-[#3C332D]">🗓️ 特別期間安排</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              家庭專屬的行事曆規劃站！在這裡可以集中安排孩子們的【旅遊計畫】、家督【考試計畫】或愉悅的【寒暑假計畫】。
              生效期間，月曆網格與每日作息小幫手將同步換裝，讓孩子一目了然接下來的精彩時間。
            </p>
          </div>
        </div>
      </div>

      {/* 🧩 Step 1: Four Large Preset Creator Cards (Parents Only) */}
      {isParent ? (
        <div className="space-y-3.5">
          <h3 className="text-xs font-black text-[#5C3A21] tracking-wider uppercase">✨ 建立新的家庭特別期間：</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Travel Plane Card */}
            <div className="bg-[#EAF6FF]/60 border border-[#BFDFFF] rounded-2xl p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-md flex flex-col justify-between h-[180px]">
              <div className="space-y-1.5">
                <div className="text-3xl">✈️</div>
                <h4 className="font-extrabold text-xs text-blue-900">我們要去旅遊了！</h4>
                <p className="text-[10px] text-blue-700/80 leading-snug">
                  自由設定國內外班機或自駕行程序，自動啟用碧藍假期卡片提示
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.TRAVEL)}
                className="w-full py-2 text-center text-[10px] font-black bg-[#478ECC] hover:bg-[#3476B0] text-white rounded-xl shadow-xs cursor-pointer transition uppercase"
              >
                + 建立旅行計畫
              </button>
            </div>

            {/* 2. Exam Study Card */}
            <div className="bg-[#FFF5D9]/60 border border-[#FFE6A3] rounded-2xl p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-md flex flex-col justify-between h-[180px]">
              <div className="space-y-1.5">
                <div className="text-3xl">📚</div>
                <h4 className="font-extrabold text-xs text-yellow-905">孩子要準備考試了！</h4>
                <p className="text-[10px] text-amber-805/80 leading-snug">
                  預先提醒學科重點、複習項目，家長提振士氣的最佳督導
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.EXAM)}
                className="w-full py-2 text-center text-[10px] font-black bg-[#DCA21D] hover:bg-[#C28E14] text-white rounded-xl shadow-xs cursor-pointer transition uppercase"
              >
                + 建立考試計畫
              </button>
            </div>

            {/* 3. Vacation Camps Card */}
            <div className="bg-[#F2FFF0]/60 border border-[#D8F3D1] rounded-2xl p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-md flex flex-col justify-between h-[180px]">
              <div className="space-y-1.5">
                <div className="text-3xl">🏕️</div>
                <h4 className="font-extrabold text-xs text-emerald-900">要放寒暑假囉！</h4>
                <p className="text-[10px] text-emerald-800/80 leading-snug">
                  制訂夏令營、生活作息規律打卡清單，與日常星星獎勵聯動
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.VACATION)}
                className="w-full py-2 text-center text-[10px] font-black bg-[#2E7D32] hover:bg-[#206023] text-white rounded-xl shadow-xs cursor-pointer transition uppercase"
              >
                + 建立假期計畫
              </button>
            </div>

            {/* 4. Custom arrangements Theme Card */}
            <div className="bg-[#EEF2FF]/65 border border-[#CCD6FF] rounded-2xl p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-md flex flex-col justify-between h-[180px]">
              <div className="space-y-1.5">
                <div className="text-3xl">🎨</div>
                <h4 className="font-extrabold text-xs text-indigo-900">其他家庭特別安排！</h4>
                <p className="text-[10px] text-indigo-700/80 leading-snug">
                  如搬家打掃、體能拉練，任意創造自己獨一無二的日常儀式
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddMode(SystemMode.CUSTOM)}
                className="w-full py-2 text-center text-[10px] font-black bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl shadow-xs cursor-pointer transition uppercase"
              >
                + 建立自訂計畫
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#FFFDF9] border border-[#E8E2D8] rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-800 shadow-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="font-bold">
            📢 爸爸和媽媽細心打理了我們全家的特別安排！點擊下方的計畫清單，能一起查看完整的每日安排唷。
          </p>
        </div>
      )}

      {/* 🗓️ List part: Currently Arranged Periods */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-[#5C3A21] tracking-wider uppercase flex items-center gap-1.5">
            🗺️ 目前已安排的特別期間 ({configuredModes.length})
          </h3>
        </div>

        {configuredModes.length === 0 ? (
          <div className="bg-[#FFFDF9] border border-dashed border-gray-200 rounded-3xl p-10 text-center text-gray-400 text-xs font-sans">
            <Calendar className="h-8 w-8 mx-auto text-gray-300 stroke-[1.5] mb-2" />
            <p className="font-bold text-[#6D5D53]">目前沒有已排定的特別期間計畫喔！</p>
            {isParent && <p className="text-[10px] text-[#A59285] mt-1">快用上方的大型卡片為全家建立一個吧 ✨</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 font-sans text-xs">
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
                  className="rounded-2xl p-4.5 transition shadow-xs flex flex-col gap-3 relative"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl select-none">{mode.icon || "✈️"}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-xs text-[#3C332D]">{mode.name}</h4>
                          <span className={`text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full border ${themeBg}`}>
                            {badgeLabel}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200 animate-pulse">
                              進行中 | 第 {elapsedDays} 天
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                              未開始 | 倒數 {Math.round((start.getTime() - today.getTime()) / (1000 * 3600 * 24))} 天
                            </span>
                          )}
                          {isPast && (
                            <span className="text-[8px] font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                              已結束歷史
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-450 font-mono mt-1 flex items-center gap-1 font-bold">
                          <span>📅</span>
                          <span>{mode.startDate} ～ {mode.endDate} ({totalDays} 天)</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedModeId(isExpanded ? null : mode.id)}
                        className="p-1.5 rounded-xl bg-white hover:bg-gray-50 border border-[#E8E2D8] text-[#7C6354] transition cursor-pointer flex items-center gap-1"
                        title="查看詳細計畫手記"
                      >
                        <span className="text-[9px] font-bold">詳情</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      
                      {isParent && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditMode(mode)}
                            className="p-1.5 rounded-xl bg-white hover:bg-sky-50 border border-[#E8E2D8] text-sky-600 transition cursor-pointer"
                            title="編輯此計畫"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModeClick(mode.id, mode.name)}
                            className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-[#E8E2D8] text-rose-500 transition cursor-pointer"
                            title="刪除此計畫"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Plan Details Container */}
                  {isExpanded && (
                    <div className="mt-2 pt-3.5 border-t border-dashed border-[#E8E2D8] space-y-3">
                      
                      {/* A. Travel Module Details */}
                      {mode.type === SystemMode.TRAVEL && (
                        <div className="space-y-3">
                          <div className="bg-orange-50/25 p-3 rounded-xl border border-orange-200/50 space-y-1.5 text-gray-650">
                            <p className="font-extrabold flex items-center gap-1 text-[#5E4029]">
                              ✈️ 航班乘降與旅途交通：
                              <span className="bg-orange-100 text-[10px] px-2 py-0.5 rounded font-mono font-black border border-orange-200 text-orange-850">
                                {mode.airline} {mode.flightNumber}
                              </span>
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium">
                              去程預定 <b>{mode.departureTime}</b>（{mode.departureTerminal || "T2"} 航廈） ｜ 回程預定 <b>{mode.returnTime}</b>（{mode.returnTerminal || "T1"} 航廈）
                            </p>
                            {mode.notes && (
                              <p className="italic text-gray-500 text-[10px] border-l-2 border-orange-200 pl-2">
                                備註小叮嚀：{mode.notes}
                              </p>
                            )}
                          </div>

                          <span className="font-extrabold text-[#5E4029] block mt-1 text-[10.5px] uppercase tracking-wider">
                            🗺️ 每日詳細行程與食宿安排 {isParent && "(家長Blur直接儲存)"}：
                          </span>
                          
                          <div className="space-y-2.5 bg-white p-3 rounded-2xl border border-gray-200 max-h-[300px] overflow-y-auto">
                            {Object.keys(mode.itinerary || {}).sort().map((date, idx) => {
                              const item = mode.itinerary?.[date] || {};
                              const isTargetEdit = activeItineraryDate === `${mode.id}-${date}`;
                              
                              return (
                                <div key={date} className="pb-3 border-b border-gray-100 last:border-b-0 last:pb-0 space-y-1 text-xs">
                                  <div className="flex items-center gap-2 justify-between flex-wrap">
                                    <span className="bg-[#FFF8F5] text-orange-900 border border-orange-100 px-2.5 py-0.5 rounded-lg font-black shrink-0">
                                      Day {idx + 1} ({date})
                                    </span>
                                    {isParent ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItineraryDate(isTargetEdit ? "" : `${mode.id}-${date}`);
                                        }}
                                        className="text-[10px] text-sky-600 hover:underline font-bold"
                                      >
                                        {isTargetEdit ? "關閉編輯 ✔" : "🔧 點此編輯食宿與行程"}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-mono text-gray-400 font-black shrink-0">
                                        🏨 住宿: {item.lodging || "自選"} ｜ 🚗 交通: {item.transport || "安排"}
                                      </span>
                                    )}
                                  </div>

                                  {isTargetEdit && isParent ? (
                                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-orange-200 space-y-2.5 mt-2">
                                      {/* 今日重點 & 提醒 edit block at the top */}
                                      <div className="bg-[#FFFDF4] border border-[#EDE2D2] rounded-lg p-2.5 space-y-2">
                                        <div>
                                          <span className="text-[9px] text-gray-500 font-bold block mb-1">🌴 今日主題:</span>
                                          <input
                                            type="text"
                                            defaultValue={item.todayTheme || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "todayTheme", e.target.value)}
                                            placeholder="例如：放空海灘日、文化探索日..."
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium font-bold text-gray-800"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[9px] text-gray-500 font-bold block mb-1">📝 今日備註:</span>
                                          <textarea
                                            rows={2}
                                            defaultValue={item.todayRemarks || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "todayRemarks", e.target.value)}
                                            placeholder="例如：14:00 SPA預約、17:30 看夕陽、記得帶防蚊液"
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium resize-none text-gray-800 leading-normal"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <span className="text-[9px] text-gray-400 font-bold block mb-1">☀️ 早上活動:</span>
                                          <input
                                            type="text"
                                            defaultValue={item.morning || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "morning", e.target.value)}
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[9px] text-gray-400 font-bold block mb-1">⛅ 下午活動:</span>
                                          <input
                                            type="text"
                                            defaultValue={item.afternoon || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "afternoon", e.target.value)}
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <span className="text-[9px] text-gray-400 font-bold block mb-1">🏨 入住宿宿:</span>
                                          <input
                                            type="text"
                                            defaultValue={item.lodging || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "lodging", e.target.value)}
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[9px] text-gray-400 font-bold block mb-1">🚌 交通轉乘:</span>
                                          <input
                                            type="text"
                                            defaultValue={item.transport || ""}
                                            onBlur={(e) => handleUpdateExpandedItinerary(mode, date, "transport", e.target.value)}
                                            className="w-full bg-white border border-[#E8E2D8] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-250 font-medium"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-gray-650 leading-relaxed space-y-1.5">
                                      {/* Today's Key Points and Remarks at the top of daily plan */}
                                      {(item.todayTheme || item.todayRemarks) && (
                                        <div className="bg-[#FFFDF6] border border-[#EDE2D2] p-2.5 rounded-lg text-[11px] space-y-1 text-[#5E3F27] mb-1">
                                          {item.todayTheme && (
                                            <p className="font-bold flex items-center gap-1 text-[11px]">
                                              <span>🌴 今日主題：</span>
                                              <span className="font-extrabold text-[#9A3412] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FDE68A]">{item.todayTheme}</span>
                                            </p>
                                          )}
                                          {item.todayRemarks && (
                                            <div className="font-semibold text-[10px] text-gray-600 bg-white/70 p-2 rounded border border-dashed border-[#EDE2D2] whitespace-pre-wrap leading-relaxed">
                                              📝 今日備註：{item.todayRemarks}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <p className="font-medium">
                                        🌅 <b>清晨：</b>{item.breakfast || "經典精緻朝食"} ｜ <b>朝：</b>{item.morning || "自在逛街放鬆"}
                                      </p>
                                      <p className="font-medium">
                                        🍜 <b>午餐：</b>{item.lunch || "自選美味體驗"} ｜ <b>午後：</b>{item.afternoon || "景區名所自由行"}
                                      </p>
                                      <p className="font-medium">
                                        🍖 <b>晩餐：</b>{item.dinner || "地方特色好料美食"} ｜ <b>夜：</b>{item.night || "夜遊散步度假"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* B. Exam Subjects Checklist */}
                      {mode.type === SystemMode.EXAM && (
                        <div className="space-y-2 bg-[#FFFDF7] border border-purple-100 p-4 rounded-2xl text-purple-950">
                          <p className="font-extrabold text-xs text-purple-900 border-b border-purple-100 pb-1.5 flex items-center gap-1">
                            📚 期考大作戰：複習科目焦點與承諾事項
                          </p>
                          {mode.subjects && mode.subjects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-medium">
                              {mode.subjects.map((sub: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-2.5 bg-white border border-purple-100/60 rounded-xl shadow-xs">
                                  <span className="font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg shrink-0 text-xs">
                                    {sub.name}
                                  </span>
                                  <span className="text-gray-600 text-[11px] font-bold text-right truncate max-w-[200px]">
                                    {sub.target || "精熟全書重點"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-[11px]">尚未添加科目規劃</p>
                          )}
                        </div>
                      )}

                      {/* C. Vacation Daily Tasks Indicator */}
                      {mode.type === SystemMode.VACATION && (
                        <div className="space-y-2.5 bg-[#F9FFF8] border border-emerald-100 p-4 rounded-2xl text-emerald-950">
                          <p className="font-extrabold text-xs text-emerald-900 border-b border-emerald-50 pb-1.5 flex items-center justify-between">
                            <span>🌻 {mode.vacationType || "寒暑期"}打卡清單 (打勾完成自我進度)：</span>
                          </p>
                          {mode.dailyTasks && mode.dailyTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5 font-bold">
                              {mode.dailyTasks.map((task: any, idx: number) => (
                                <div 
                                  key={task.id || idx} 
                                  onClick={() => handleToggleTaskCompleted(mode, task.id, "vacation")}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition ${
                                    task.completed 
                                      ? "bg-emerald-50/50 border-emerald-300 text-emerald-800 line-through opacity-70"
                                      : "bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/20"
                                  }`}
                                >
                                  <div className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                                    task.completed ? "bg-emerald-600 border-emerald-600 text-white" : "border-emerald-300 bg-white"
                                  }`}>
                                    {task.completed && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-[11px] font-bold">{task.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-[11px]">尚未添加每日生活打卡清單</p>
                          )}
                        </div>
                      )}

                      {/* D. Custom Tasks Checklist */}
                      {mode.type === SystemMode.CUSTOM && (
                        <div className="space-y-2.5 bg-[#FCFDFF] border border-indigo-100 p-4 rounded-2xl text-indigo-950">
                          <p className="font-extrabold text-xs text-indigo-900 border-b border-indigo-50 pb-1.5 flex items-center justify-between">
                            <span>🎨 家庭自訂活約定 (打勾紀錄本日進度)：</span>
                          </p>
                          {mode.customTasks && mode.customTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5 font-extrabold">
                              {mode.customTasks.map((task: any, idx: number) => (
                                <div 
                                  key={task.id || idx} 
                                  onClick={() => handleToggleTaskCompleted(mode, task.id, "custom")}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition ${
                                    task.completed 
                                      ? "bg-indigo-50/50 border-indigo-300 text-indigo-800 line-through opacity-70"
                                      : "bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/20"
                                  }`}
                                >
                                  <div className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                                    task.completed ? "bg-indigo-600 border-indigo-600 text-white" : "border-indigo-300 bg-white"
                                  }`}>
                                    {task.completed && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-[11px] font-bold">{task.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic text-[11px]">尚未添加自訂生活打卡清單</p>
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
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: SystemMode.TRAVEL, label: "✈ 旅遊計畫", icon: "✈" },
                    { id: SystemMode.EXAM, label: "📚 考試計畫", icon: "📚" },
                    { id: SystemMode.VACATION, label: "🏡 假期計畫", icon: "🏡" },
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
                  placeholder="例如：日本東京旅行、期末考、暑假規劃..."
                  value={modeFormName}
                  onChange={(e) => setModeFormName(e.target.value)}
                  className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none text-xs font-bold"
                />
              </div>

              {/* Date interval */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-black text-gray-755">📅 開始生效日期：</label>
                  <input
                    type="date"
                    required
                    value={modeFormStartDate}
                    onChange={(e) => setModeFormStartDate(e.target.value)}
                    className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-black text-gray-755">📅 結束失效日期：</label>
                  <input
                    type="date"
                    required
                    value={modeFormEndDate}
                    onChange={(e) => setModeFormEndDate(e.target.value)}
                    className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Dynamic form payload options */}
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

                    {travelType === "international" ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-450 font-bold">航空公司：</label>
                            <input
                              type="text"
                              value={airLine}
                              onChange={(e) => setAirLine(e.target.value)}
                              placeholder="星宇航空、長榮"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-455 font-bold">去程班號：</label>
                            <input
                              type="text"
                              value={flightNumber}
                              onChange={(e) => setFlightNumber(e.target.value)}
                              placeholder="JX721 or BR255"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-450 font-bold">出發起飛時間：</label>
                            <input
                              type="text"
                              value={departureTime}
                              placeholder="09:50"
                              onChange={(e) => setDepartureTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-450 font-bold">回程降落時間：</label>
                            <input
                              type="text"
                              value={returnTime}
                              placeholder="16:15"
                              onChange={(e) => setReturnTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-450 font-bold">起飛 Terminal：</label>
                            <input
                              type="text"
                              value={departureTerminal}
                              placeholder="T2"
                              onChange={(e) => setDepartureTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-450 font-bold">降落 Terminal：</label>
                            <input
                              type="text"
                              value={returnTerminal}
                              placeholder="T1"
                              onChange={(e) => setReturnTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px] font-bold"
                            />
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

                {/* 4. Custom Config Options */}
                {modeFormType === SystemMode.CUSTOM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-[#3F3D56] border-b pb-1">🎨 其它家庭特殊活動時光</h4>
                    <div className="space-y-2.5">
                      <div className="flex gap-2 items-center text-xs">
                        <label className="font-bold w-16 text-gray-500 shrink-0">主題圖示：</label>
                        <select
                          value={modeFormIcon}
                          onChange={(e) => setModeFormIcon(e.target.value)}
                          className="bg-white rounded-lg p-1.5 border border-gray-200 font-sans font-bold"
                        >
                          <option value="🚼">🍼 新生兒育嬰時光</option>
                          <option value="🏕">🏕 戶外野營挑戰</option>
                          <option value="📦">📦 搬家整理包裝</option>
                          <option value="🏃">🏃 體能核心拉練</option>
                          <option value="🧹">🧹 年終大掃除打掃</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-bold">自訂每日作息提示項目：</label>
                        <div className="space-y-1 text-xs">
                          {customTasks.map((t) => (
                            <div key={t.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-gray-100 font-medium">
                              <span>{t.text}</span>
                              <button
                                type="button"
                                onClick={() => setCustomTasks(customTasks.filter(item => item.id !== t.id))}
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
                            value={newCustomTaskInput}
                            placeholder="打包自訂特殊任務項目..."
                            onChange={(e) => setNewCustomTaskInput(e.target.value)}
                            className="flex-grow bg-white rounded-lg p-1.5 border border-[#E8E2D8] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newCustomTaskInput.trim()) return;
                              setCustomTasks([...customTasks, { id: `${Date.now()}`, text: newCustomTaskInput.trim() }]);
                              setNewCustomTaskInput("");
                            }}
                            className="bg-indigo-600 text-white rounded-lg font-bold px-3 text-xs"
                          >
                            加入
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                className="w-full py-2.5 text-xs font-black text-white bg-red-650 hover:bg-red-700 rounded-xl shadow-md transition hover:scale-[1.01] cursor-pointer text-center"
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
