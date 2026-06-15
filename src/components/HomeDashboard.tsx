import React, { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import {
  CalendarEvent,
  Announcement,
  Task,
  TaskStatus,
  UserProfile,
  UserRole,
  SystemMode,
  Reward,
  RewardStatus,
  getLocalToday,
  ConfiguredMode,
  Redemption,
} from "../types";
import { getHolidayForDate } from "../utils/holidayService";
import {
  Bell,
  CheckCircle,
  FileText,
  Trash2,
  Calendar,
  Award,
  Zap,
  Plus,
  Star,
  Cake,
  TrendingUp,
  Smile,
  Flame,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Sparkle,
  Edit3,
  X
} from "lucide-react";

const isMom = (displayName?: string) => {
  if (!displayName) return false;
  const nameLower = displayName.toLowerCase();
  return nameLower.includes("媽媽") || nameLower.includes("mama") || nameLower.includes("mom") || nameLower.includes("mami") || nameLower.includes("mother") || nameLower === "媽媽" || nameLower === "mom";
};

interface HomeDashboardProps {
  currentUser: UserProfile;
  events: CalendarEvent[];
  announcements: Announcement[];
  tasks: Task[];
  familyMembers: UserProfile[];
  systemMode: SystemMode;
  rewards?: Reward[];
  redemptions?: Redemption[];
  onAddAnnouncement: (title: string, content: string) => Promise<void>;
  onUpdateAnnouncement?: (id: string, title: string, content: string) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onNavigateToEvent?: (eventId: string, date: string) => void;
  onAddEvent?: (eventData: any) => Promise<any>;
  activeModeConfig?: any;
  configuredModes?: any[];
  simulatedTodayDate?: string;
  onSetSimulatedTodayDate?: (date: string) => void;
  onSaveConfiguredMode?: (payload: ConfiguredMode) => Promise<void>;
  onDeleteConfiguredMode?: (id: string, deleteRelatedEvents?: boolean) => Promise<void>;
  onChangePage?: (page: any) => void;
  dataLoaded?: {
    family: boolean;
    settings: boolean;
    members: boolean;
    events: boolean;
    tasks: boolean;
    rewards: boolean;
    announcements: boolean;
    favorites: boolean;
    redemptions: boolean;
  };
  activeFamily?: any;
}

function ShimmerSkeleton({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-50/60 rounded-xl p-3.5 border border-[#F2EDE4] space-y-2 text-left">
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200/60 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

interface ParsedTimeStatus {
  hasTime: boolean;
  isOngoing: boolean;
  isEnded: boolean;
  isUpcoming: boolean;
  startTimeMins: number;
}

const isMultiDayEvent = (evt: CalendarEvent): boolean => {
  return !evt.isFixed && !!evt.startDate && !!evt.endDate && evt.startDate !== evt.endDate;
};

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

function parseEventTime(timeStr: string | undefined): ParsedTimeStatus {
  if (!timeStr || !timeStr.trim()) {
    return {
      hasTime: false,
      isOngoing: false,
      isEnded: false,
      isUpcoming: false,
      startTimeMins: 9999,
    };
  }

  const parts = timeStr.split(/[~-]/);
  if (parts.length >= 1) {
    const startPart = parts[0].trim();
    const endPart = parts[1] ? parts[1].trim() : "";

    const startMatch = startPart.match(/^([0-9]{1,2}):([0-9]{2})$/);
    if (startMatch) {
      const startH = parseInt(startMatch[1], 10);
      const startM = parseInt(startMatch[2], 10);
      const startTimeMins = startH * 60 + startM;

      let endTimeMins = startTimeMins + 60; // fallback 1 hour
      if (endPart) {
        const endMatch = endPart.match(/^([0-9]{1,2}):([0-9]{2})$/);
        if (endMatch) {
          const endH = parseInt(endMatch[1], 10);
          const endM = parseInt(endMatch[2], 10);
          endTimeMins = endH * 60 + endM;
        }
      }

      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      if (nowMins < startTimeMins) {
        return {
          hasTime: true,
          isOngoing: false,
          isEnded: false,
          isUpcoming: true,
          startTimeMins,
        };
      } else if (nowMins >= startTimeMins && nowMins <= endTimeMins) {
        return {
          hasTime: true,
          isOngoing: true,
          isEnded: false,
          isUpcoming: false,
          startTimeMins,
        };
      } else {
        return {
          hasTime: true,
          isOngoing: false,
          isEnded: true,
          isUpcoming: false,
          startTimeMins,
        };
      }
    }
  }

  return {
    hasTime: false,
    isOngoing: false,
    isEnded: false,
    isUpcoming: false,
    startTimeMins: 9999,
  };
}

export default function HomeDashboard({
  currentUser,
  events,
  announcements,
  tasks,
  familyMembers,
  systemMode,
  rewards = [],
  redemptions = [],
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onNavigateToEvent,
  onAddEvent,
  activeModeConfig,
  configuredModes = [],
  simulatedTodayDate,
  onSetSimulatedTodayDate,
  onSaveConfiguredMode,
  onDeleteConfiguredMode,
  onChangePage,
  dataLoaded,
  activeFamily,
}: HomeDashboardProps) {
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnContent, setNewAnnContent] = useState("");
  const [showAddAnnModal, setShowAddAnnModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nestedBirthdayMembers = useMemo(() => {
    if (!familyMembers) return [];

    const rawList = familyMembers.map((member) => ({
      id: member.uid || (member as any).id || (member as any).memberId,
      uid: member.uid,
      memberId: (member as any).memberId || member.uid,
      displayName: member.displayName || "家庭成員",
      birthday: member.birthday,
      showAge: member.showAgeInCalendar ?? (member as any).showAge ?? true,
      showAgeInCalendar: member.showAgeInCalendar ?? (member as any).showAge ?? true,
      avatar: member.photoURL || "",
      photoURL: member.photoURL || "🙂",
      gender: member.gender || "",
      source: "familyMembers (users)"
    }));

    const uniqueList: any[] = [];
    const seenUids = new Set<string>();
    const seenMemberIds = new Set<string>();
    const seenNamesAndBirthdays = new Set<string>();

    rawList.forEach((item) => {
      if (!item.birthday) return;

      const itemUid = item.uid;
      const itemMemberId = item.memberId;
      const itemName = (item.displayName || "").trim();
      const itemBirthday = item.birthday.trim().replace(/\//g, "-");

      // 1. Check Name + Birthday first to ensure no duplicate individuals exist under separate login accounts or profiles
      const combinedKey = `${itemName.toLowerCase()}_${itemBirthday}`;
      if (seenNamesAndBirthdays.has(combinedKey)) {
        console.log("Deduplicator skipped duplicated member by name+birthday:", combinedKey, itemUid);
        return;
      }

      // 2. Check Uid / MemberId
      if (itemUid) {
        if (seenUids.has(itemUid)) {
          console.log("Deduplicator skipped duplicated member by uid:", itemUid, itemName);
          return;
        }
        seenUids.add(itemUid);
      } else if (itemMemberId) {
        if (seenMemberIds.has(itemMemberId)) {
          console.log("Deduplicator skipped duplicated member by memberId:", itemMemberId, itemName);
          return;
        }
        seenMemberIds.add(itemMemberId);
      }

      seenNamesAndBirthdays.add(combinedKey);
      uniqueList.push(item);
    });

    console.log("======= 🎂 生日小幫手使用資料來源除錯紀錄 =======");
    uniqueList.forEach((member) => {
      console.log({
        "member uid": member.uid,
        "memberId": member.memberId,
        "member name": member.displayName,
        "birthday": member.birthday,
        "source": member.source || "familyMembers"
      });
    });
    console.log(`================ 正式家庭成員總數: ${familyMembers.length} 筆 | 生日小幫手顯示總數: ${uniqueList.length} 筆 =================`);

    return uniqueList;
  }, [familyMembers]);

  // States for announcement deletion confirmation & debugging
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [showDeleteAnnConfirm, setShowDeleteAnnConfirm] = useState(false);
  const [isDeletingAnn, setIsDeletingAnn] = useState(false);
  const [deleteAnnError, setDeleteAnnError] = useState<string | null>(null);

  const handleConfirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    const targetId = announcementToDelete.id;
    
    // Step 1
    console.log("Delete Start");
    
    // Step 2
    console.log("announcementId", targetId);
    console.log("familyId", announcementToDelete.familyId);
    console.log("currentUser.uid", currentUser.uid);
    
    // Step 3
    console.log(`實際刪除路徑: announcements/${targetId}`);

    try {
      setIsDeletingAnn(true);
      setDeleteAnnError(null);
      
      await onDeleteAnnouncement(targetId);
      
      setShowDeleteAnnConfirm(false);
      setAnnouncementToDelete(null);
    } catch (err: any) {
      console.error("公告刪除失敗");
      console.error("Firebase Error Code:", err?.code || "N/A");
      console.error("Firebase Error Message:", err?.message || err?.toString());
      console.error(err);
      
      const errorCode = err?.code || "UNKNOWN";
      const errorMessage = err?.message || err?.toString() || "刪除發生未知錯誤";
      
      if (errorCode === "permission-denied" || errorMessage.includes("permission")) {
        setDeleteAnnError("公告刪除失敗：\nFirebase 權限不足");
      } else {
        setDeleteAnnError(`刪除失敗\nError Code:\n${errorCode}\n\nError Message:\n${errorMessage}`);
      }
    } finally {
      setIsDeletingAnn(false);
    }
  };

  // Quick add event states & handler (used by next 7 days mobile layout)
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddTime, setQuickAddTime] = useState("");
  const [quickAddNote, setQuickAddNote] = useState("");
  const [quickAddPublic, setQuickAddPublic] = useState(true);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddDate || !quickAddTitle.trim()) {
      toast.error("⚠️ 請輸入行程名稱！");
      return;
    }
    if (!onAddEvent) {
      toast.error("❌ 系統未就緒，無法新增行程。");
      return;
    }
    try {
      setIsSubmitting(true);
      await onAddEvent({
        title: quickAddTitle.trim(),
        date: quickAddDate,
        time: quickAddTime.trim(),
        note: quickAddNote.trim(),
        isPublic: quickAddPublic,
        isFixed: false,
        familyId: currentUser.familyId || "",
      });
      // Clear states & inputs
      setQuickAddTitle("");
      setQuickAddTime("");
      setQuickAddNote("");
      setQuickAddPublic(true);
      setQuickAddDate(null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Collapsible sections
  const [isTodayPointsExpanded, setIsTodayPointsExpanded] = useState(true);
  const [isSevenDaysExpanded, setIsSevenDaysExpanded] = useState(true);
  const [isAnnouncementExpanded, setIsAnnouncementExpanded] = useState(true);
  const [isStarCenterExpanded, setIsStarCenterExpanded] = useState(true);
  const [isUpcomingTasksExpanded, setIsUpcomingTasksExpanded] = useState(true);
  const [isBirthdayHelperExpanded, setIsBirthdayHelperExpanded] = useState(true);
  const [isRecentlyCompletedExpanded, setIsRecentlyCompletedExpanded] = useState(false);

  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;

  // Helper roles for announcements permissions
  const currentUserRoleLower = (currentUser.role || "").toLowerCase();
  const isOwner = currentUserRoleLower === "owner" || currentUserRoleLower === "admin" || currentUserRoleLower === "superadmin" || (currentUser.role as any) === "Admin" || (currentUser.role as any) === UserRole.OWNER;
  const isParentRole = currentUserRoleLower === "parent" || currentUser.role === UserRole.PARENT;
  const isChildRole = currentUserRoleLower === "child" || currentUserRoleLower === "kid" || currentUser.role === UserRole.CHILD || (currentUser.role as any) === "Kid";

  const canCreateAnnouncement = isOwner || isParentRole || isChildRole;
  const canEditAnnouncement = (ann: any) => {
    if (!ann) return false;
    if (isOwner || isParentRole) return true;
    if (isChildRole && ann.creatorUid === currentUser.uid) return true;
    return false;
  };

  // Mobile Dashboard specific states
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string>("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState<boolean>(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  // Expanded Mode detail viewing
  const [expandedModeId, setExpandedModeId] = useState<string | null>(null);
  const [activeItineraryDate, setActiveItineraryDate] = useState<string>("");

  // Period Mode configuration states
  const [showModeModal, setShowModeModal] = useState(false);
  const [editingModeConfig, setEditingModeConfig] = useState<ConfiguredMode | null>(null);
  
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
  const [newPlanStart, setNewPlanStart] = useState("18:00");
  const [newPlanEnd, setNewPlanEnd] = useState("18:30");
  const [newPlanSubject, setNewPlanSubject] = useState("數學");

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

  // Modals / Deletion Confirm states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleOpenAddMode = () => {
    setEditingModeConfig(null);
    setModeFormType(SystemMode.TRAVEL);
    setModeFormName("峇里島旅行");
    setModeFormStartDate("2026-07-18");
    setModeFormEndDate("2026-07-25");
    setModeFormIcon("✈");
    setModeFormColor("orange");

    // Travel Defaults
    setTravelType("international");
    setAirLine("星宇航空");
    setFlightNumber("JX721");
    setDepartureTime("09:50");
    setReturnTime("16:45");
    setDepartureTerminal("T2");
    setReturnTerminal("T1");
    setPassportReminder(true);
    setVisaReminder(true);
    setNotes("帶泳裝、防曬乳、防蚊液");
    setTransportation("drive");
    setCustomTransportation("");

    // Exam Defaults
    setExamSubjects([
      { name: "國語", target: "複習一到六課生字" },
      { name: "數學", target: "完成兩回總複習考卷" },
      { name: "英文", target: "背完單字500個" },
      { name: "自然", target: "寫完第三單元筆記" },
    ]);
    setExamDailyPlans([
      { id: "1", startTime: "18:00", endTime: "18:30", subjectName: "數學" },
      { id: "2", startTime: "18:30", endTime: "19:00", subjectName: "英文" },
      { id: "3", startTime: "19:30", endTime: "20:00", subjectName: "國語" },
    ]);

    // Vacation Defaults
    setVacationType("暑假");
    setVacationDailyTasks([
      { id: "1", text: "閱讀30分鐘" },
      { id: "2", text: "練鋼琴" },
      { id: "3", text: "寫作業" },
      { id: "4", text: "游泳課" },
      { id: "5", text: "畫畫課" },
    ]);

    // Custom Defaults
    setCustomTasks([
      { id: "1", text: "收拾自己的行李箱" },
      { id: "2", text: "每天喝水量達1200cc" },
    ]);

    setShowModeModal(true);
  };

  const handleOpenEditMode = (mode: ConfiguredMode) => {
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

  const handleSaveModeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveConfiguredMode) return;
    setIsUpdating(true);

    const modeId = editingModeConfig?.id || `mode_v_${Math.random().toString(36).substr(2, 9)}`;

    const payload: ConfiguredMode = {
      id: modeId,
      type: modeFormType,
      name: modeFormName || (
        modeFormType === SystemMode.TRAVEL ? "峇里島旅行" :
        modeFormType === SystemMode.EXAM ? "期中考" :
        modeFormType === SystemMode.VACATION ? "暑假規劃" : "自訂模式"
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
              breakfast: "自理 / 機場漢堡",
              morning: "機場報到、通關登機 ✈",
              lunch: "飛機餐餐盒",
              afternoon: "飛往峇里島、辦理通關",
              dinner: "海灘印尼風味快炒餐廳",
              night: "入住飯店、沙灘放空散步",
              lodging: "海灘五星度假別墅",
              transport: "包車接載",
              customNotes: "第一天早點睡，適應熱帶風情！",
              todayTheme: "移動日",
              todayRemarks: "記得準備護照！第一天早點睡，適應熱帶風情！",
            };
          } else {
            genItinerary[dStr] = {
              breakfast: "別墅池畔早餐",
              morning: "烏布市集手工雕刻閒逛",
              lunch: "香烤髒鴨餐風味宴",
              afternoon: "全身精油 SPA 放鬆紓壓",
              dinner: "落日海灘 BBQ 海鮮吃到飽",
              night: "大廳現場彈唱、喝椰子汁",
              lodging: "海灘五星度假別墅",
              transport: "導遊包車",
              customNotes: "下午去市集可以殺價喔！",
              todayTheme: "放空海灘日",
              todayRemarks: "14:05 SPA預約\n17:30 看夕陽\n記得準備防蚊液與泳衣",
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

  const handleUpdateExpandedItinerary = async (mode: ConfiguredMode, date: string, field: string, value: string) => {
    if (!onSaveConfiguredMode) return;
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
      console.error(err);
    }
  };

  const handleDeleteMode = async (id: string, name: string) => {
    if (!onDeleteConfiguredMode || !isParent) return;
    setConfirmDeleteId(id);
    setConfirmDeleteName(name);
    setDeleteErrorMessage(null);
  };

  const handleConfirmDeleteMode = async (deleteEvents: boolean) => {
    if (!confirmDeleteId || !onDeleteConfiguredMode || !isParent) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      await onDeleteConfiguredMode(confirmDeleteId, deleteEvents);
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error("刪除失敗", err);
      setDeleteErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Use either the shared simulatedTodayDate or default browser local time
  const todayDateStr = simulatedTodayDate || getLocalToday();
  const todayHoliday = getHolidayForDate(todayDateStr);

  // Dynamic Birthday Calculations (Auto-recurring, age calculated based on current calendar year)
  const birthdayReminders = useMemo(() => {
    const todayStars: any[] = [];
    const warningCards: any[] = [];
    const countdownList: any[] = [];
    const allUpcoming: any[] = [];

    if (!nestedBirthdayMembers || nestedBirthdayMembers.length === 0) {
      return { todayStars, warningCards, countdownList, allUpcoming };
    }

    const todayPartY = parseInt(todayDateStr.split("-")[0], 10) || 2026;
    const todayPartM = parseInt(todayDateStr.split("-")[1], 10) || 6;
    const todayPartD = parseInt(todayDateStr.split("-")[2], 10) || 6;
    const todayDateOnly = new Date(todayPartY, todayPartM - 1, todayPartD);

    nestedBirthdayMembers.forEach((member) => {
      if (!member.birthday) return;
      const cleanBday = member.birthday.replace(/\//g, "-");
      const parts = cleanBday.split("-");
      if (parts.length < 3) return;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);
      if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return;

      // Construct birthday date in today's simulated year
      let targetYear = todayPartY;
      let bdayDate = new Date(targetYear, birthMonth - 1, birthDay);

      // Diff calculation in days
      let diffMs = bdayDate.getTime() - todayDateOnly.getTime();
      let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Already passed this year, check next year
        targetYear = todayPartY + 1;
        bdayDate = new Date(targetYear, birthMonth - 1, birthDay);
        diffMs = bdayDate.getTime() - todayDateOnly.getTime();
        diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      }

      const age = targetYear - birthYear;
      
      const item = {
        member,
        birthMonth,
        birthDay,
        age,
        diffDays,
        targetYear,
        birthdayStr: `${birthMonth}/${birthDay}`,
      };

      if (diffDays === 0) {
        todayStars.push(item);
      } else {
        // 14 days, 7 days, 3 days, 1 day checklists:
        if ([14, 7, 3, 1].includes(diffDays)) {
          warningCards.push(item);
        }
        // 7 days countdown short banner warning:
        if (diffDays <= 7 && diffDays > 0) {
          countdownList.push(item);
        }
      }

      if (diffDays <= 60) {
        allUpcoming.push(item);
      }
    });

    // Sort all upcoming birthdays by days remaining
    allUpcoming.sort((a, b) => a.diffDays - b.diffDays);

    return { todayStars, warningCards, countdownList, allUpcoming };
  }, [nestedBirthdayMembers, todayDateStr]);

  const monthlyFestivals = useMemo(() => {
    const list: any[] = [];
    const parts = todayDateStr.split("-");
    if (parts.length < 3) return list;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const todayDateOnly = new Date(year, month - 1, day);

    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const holiday = getHolidayForDate(dStr);
      if (holiday) {
        const currentBDate = new Date(year, month - 1, d);
        const diffMs = currentBDate.getTime() - todayDateOnly.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        list.push({
          name: holiday.name,
          emoji: holiday.emoji,
          isNational: holiday.isNational,
          dateStr: `${month}/${d}`,
          rawDateStr: dStr,
          isToday: diffDays === 0,
          diffDays,
        });
      }
    }

    return list.sort((a, b) => {
      if (a.isToday) return -1;
      if (b.isToday) return 1;
      return a.rawDateStr.localeCompare(b.rawDateStr);
    });
  }, [todayDateStr]);

  const getInvolvedMembers = (evt: CalendarEvent) => {
    const list: string[] = [];
    if ((evt as any).isBirthday && (evt as any).birthdayMemberName) {
      list.push((evt as any).birthdayMemberName);
    } else {
      if ((evt as any).assignedTo) {
        const assignedUid = (evt as any).assignedTo;
        const found = familyMembers.find(m => m.uid === assignedUid);
        if (found) {
          list.push(found.displayName);
        }
      }
      if (familyMembers && familyMembers.length > 0) {
        familyMembers.forEach(m => {
          if (m.displayName && m.displayName.trim().length > 0) {
            if (
              evt.title?.includes(m.displayName) ||
              evt.note?.includes(m.displayName)
            ) {
              if (!list.includes(m.displayName)) {
                list.push(m.displayName);
              }
            }
          }
        });
      }
    }
    return list;
  };

  // Compute all events including birthdays to inject automatically
  const allEvents = useMemo(() => {
    const list = [...events];
    if (!nestedBirthdayMembers) return list;

    nestedBirthdayMembers.forEach((member) => {
      if (!member.birthday) return;
      const birthdayClean = member.birthday.replace(/\//g, "-");
      const parts = birthdayClean.split("-");
      if (parts.length < 3) return;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);
      if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return;

      const genYear = 2026;
      const age = genYear - birthYear;
      const eventDateStr = `${genYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

      const showAge = member.showAgeInCalendar !== false;
      list.push({
        id: `birthday-${member.uid || Math.random()}-${genYear}`,
        familyId: member.familyId || "",
        title: showAge ? `🎂 ${member.displayName} ${age}歲生日` : `🎂 ${member.displayName}生日`,
        date: eventDateStr,
        time: "", // All-day
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

    return list;
  }, [events, nestedBirthdayMembers]);

  // Filter today's events dynamically
  const todayEvents = useMemo(() => {
    // Find weekday of todayDateStr dynamically (0=Sunday, 1=Monday, ..., 6=Saturday)
    let simulatedWeekday = 6;
    try {
      const d = new Date(todayDateStr);
      const day = d.getDay();
      if (!isNaN(day)) simulatedWeekday = day;
    } catch (e) {
      simulatedWeekday = 6;
    }

    // 1. Get raw candidate events for today
    const rawEvents = allEvents.filter((e) => {
      if (e.isFixed) {
        if (e.exceptionDates?.includes(todayDateStr)) return false;
        if (e.startDate && todayDateStr < e.startDate) return false;
        if (e.endDate && todayDateStr > e.endDate) return false;
        return e.weekdays?.includes(simulatedWeekday);
      }
      if (e.startDate && e.endDate) {
        return todayDateStr >= e.startDate && todayDateStr <= e.endDate;
      }
      return e.date === todayDateStr;
    });

    // 2. Map and parse time statuses
    const withStatus = rawEvents.map((e) => {
      const status = parseEventTime(e.time);
      return { event: e, status };
    });

    // 3. Keep only:
    //    - Non-timed events (which are displayed all day until 23:59)
    //    - Ongoing timed events
    //    - Upcoming timed events
    // (This means we exclude: timed events which are already ended, i.e. status.hasTime && status.isEnded)
    const filtered = withStatus.filter((item) => {
      if (item.status.hasTime && item.status.isEnded) {
        return false;
      }
      return true;
    });

    // 4. Sort based on priority:
    //    - Priority 1: Ongoing timed events
    //    - Priority 2: Upcoming timed events
    //    - Priority 3: No-time events
    // (And sort within categories by start time mins)
    filtered.sort((a, b) => {
      const getPriority = (x: typeof a) => {
        if (x.status.hasTime && x.status.isOngoing) return 1;
        if (x.status.hasTime && x.status.isUpcoming) return 2;
        return 3; // no-time / all-day
      };

      const priA = getPriority(a);
      const priB = getPriority(b);

      if (priA !== priB) {
        return priA - priB;
      }

      // Within same priority, sort by actual start time if available
      if (a.status.hasTime && b.status.hasTime) {
        return a.status.startTimeMins - b.status.startTimeMins;
      }

      return 0;
    });

    return filtered.map((item) => item.event);
  }, [allEvents, todayDateStr]);

  const bannerText = useMemo(() => {
    const remainingCount = todayEvents.length;
    if (remainingCount === 0) {
      return "今天剩餘 0 個行程";
    }
    return `今天還有 ${remainingCount} 個待完成事項`;
  }, [todayEvents]);

  // Future 7 days calculation relative to dynamic todayDateStr
  const nextSevenDays = useMemo(() => {
    const list = [];
    let baseDate = new Date();
    try {
      const parts = todayDateStr.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        baseDate = new Date(y, m, d);
      }
    } catch(err) {
      baseDate = new Date(2026, 5, 6);
    }

    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(baseDate.getDate() + i);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
      const dd = String(nextDate.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dow = nextDate.getDay();

      const dayEvents = allEvents.filter((e) => {
        if (e.isFixed) {
          if (e.exceptionDates?.includes(dateStr)) return false;
          if (e.startDate && dateStr < e.startDate) return false;
          if (e.endDate && dateStr > e.endDate) return false;
          return e.weekdays?.includes(dow);
        }
        if (e.startDate && e.endDate) {
          return dateStr >= e.startDate && dateStr <= e.endDate;
        }
        return e.date === dateStr;
      });

      const dayOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][dow];
      const holiday = getHolidayForDate(dateStr);

      list.push({
        dateStr,
        displayDate: `${mm}月${dd}日（${dayOfWeek}）`,
        isToday: i === 0,
        events: dayEvents,
        holiday,
      });
    }
    return list;
  }, [allEvents, todayDateStr]);

  // Recent approved tasks in the past 3 days relative to todayDateStr
  const recentAchievements = useMemo(() => {
    let baseTime = new Date().getTime() - 3 * 24 * 60 * 60 * 1000;
    try {
      const parts = todayDateStr.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const bD = new Date(y, m, d);
        bD.setDate(bD.getDate() - 3);
        baseTime = bD.getTime();
      }
    } catch(e) {}

    return tasks
      .filter((t) => {
        if (t.status !== "approved") return false;
        const approvedTime = t.approvedAt?.seconds 
          ? t.approvedAt.seconds * 1000 
          : (t.approvedAt instanceof Date ? t.approvedAt.getTime() : 0);
        return approvedTime >= baseTime;
      })
      .sort((a, b) => {
        const timeA = a.approvedAt?.seconds || 0;
        const timeB = b.approvedAt?.seconds || 0;
        return timeB - timeA;
      });
  }, [tasks, todayDateStr]);

  // Kids star balance list (Warm and friendly styling, no hierarchical leaderboard sorting indices)
  const kidsMembers = useMemo(() => {
    return familyMembers.filter((m) => m.role === UserRole.KID);
  }, [familyMembers]);

  const getClosestGiftInfoForKid = (kidStars: number) => {
    const availableGifts = (rewards || []).filter(r => r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.APPROVED);
    if (availableGifts.length === 0) return null;
    
    // Find closest positive gap
    const unachieved = availableGifts
      .filter(r => r.starsCost > kidStars)
      .sort((a, b) => {
        const gapA = a.starsCost - kidStars;
        const gapB = b.starsCost - kidStars;
        return gapA - gapB;
      });
      
    if (unachieved.length > 0) {
      const closest = unachieved[0];
      return {
        title: closest.title,
        starsCost: closest.starsCost,
        gap: closest.starsCost - kidStars,
        isAchieved: false,
      };
    }
    
    const sortedAchieved = [...availableGifts].sort((a, b) => b.starsCost - a.starsCost);
    const highest = sortedAchieved[0];
    return {
      title: highest.title,
      starsCost: highest.starsCost,
      gap: 0,
      isAchieved: true,
    };
  };

  const kidStats = useMemo(() => {
    const kidUid = currentUser.uid;
    const today = todayDateStr || getLocalToday();
    const thisMonthPrefix = today.slice(0, 7); // e.g. "2026-06"
    
    let todayEarned = 0;
    let monthEarned = 0;
    
    tasks.forEach((t) => {
      if (t.status === "approved" && (t.submitterUid === kidUid || t.assignedTo?.split(",").includes(kidUid))) {
        const approvedTime = t.approvedAt?.seconds 
          ? new Date(t.approvedAt.seconds * 1000) 
          : (t.approvedAt instanceof Date ? t.approvedAt : (typeof t.approvedAt === 'string' ? new Date(t.approvedAt) : null));
        if (approvedTime) {
          const yearStr = approvedTime.getFullYear();
          const monthStr = String(approvedTime.getMonth() + 1).padStart(2, "0");
          const dayStr = String(approvedTime.getDate()).padStart(2, "0");
          const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
          
          if (dateStr === today) {
            todayEarned += t.starsReward || 0;
          }
          if (dateStr.startsWith(thisMonthPrefix)) {
            monthEarned += t.starsReward || 0;
          }
        }
      }
    });
    
    return {
      todayEarned,
      monthEarned,
      currentStars: currentUser.role === UserRole.KID ? (currentUser.stars || 0) : 0,
    };
  }, [tasks, currentUser, todayDateStr]);

  // Upcoming completed rewards for each kid member
  const kidRewardProgressList = useMemo(() => {
    const availablePool = rewards.filter(
      (r) => (r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.APPROVED) && r.stock > 0
    );
    if (availablePool.length === 0) return [];

    return kidsMembers.map((kid) => {
      const kidStars = kid.stars || 0;
      // Map rewards with progress calculation
      const progress = availablePool.map((r) => {
        const diff = r.starsCost - kidStars;
        const pct = Math.min(100, Math.round((kidStars / r.starsCost) * 100));
        return {
          reward: r,
          diff,
          pct,
          canRedeem: diff <= 0,
        };
      });

      // Show the closest unachieved reward, or the highest achievable one
      const sorted = [...progress].sort((a, b) => {
        if (a.canRedeem && !b.canRedeem) return 1;
        if (!a.canRedeem && b.canRedeem) return -1;
        return a.diff - b.diff; // closest diff first
      });

      return {
        kid,
        bestGoal: sorted[0] || null,
      };
    });
  }, [kidsMembers, rewards]);

  // June birthdays highlight
  const juneBirthdays = useMemo(() => {
    return nestedBirthdayMembers
      .filter((m) => {
        if (!m.birthday) return false;
        const b = m.birthday.replace(/\//g, "-");
        const parts = b.split("-");
        return parts.length >= 2 && parseInt(parts[1], 10) === 6; // June
      })
      .map((m) => {
        const b = m.birthday!.replace(/\//g, "-");
        const parts = b.split("-");
        const birthYear = parseInt(parts[0], 10);
        const age = 2026 - birthYear;
        return {
          ...m,
          birthDayStr: `${parts[1]}/${parts[2]}`,
          age,
          dateNum: parseInt(parts[2], 10),
        };
      })
      .sort((a, b) => a.dateNum - b.dateNum);
  }, [nestedBirthdayMembers]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const trimmedContent = newAnnContent ? newAnnContent.trim() : "";
      if (editingAnnouncement) {
        if (onUpdateAnnouncement) {
          await onUpdateAnnouncement(editingAnnouncement.id, newAnnTitle.trim(), trimmedContent);
          toast.success("✓ 公告修改成功！");
        } else {
          toast.error("❌ 系統不支援修改公告。");
        }
      } else {
        await onAddAnnouncement(newAnnTitle.trim(), trimmedContent);
        toast.success("🎉 公告發布成功！");
      }
      setNewAnnTitle("");
      setNewAnnContent("");
      setEditingAnnouncement(null);
      setShowAddAnnModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSystemModeName = (mode: SystemMode) => {
    switch (mode) {
      case SystemMode.TRAVEL:
        return "🎈 旅遊模式";
      case SystemMode.EXAM:
        return "📝 考前大作戰";
      case SystemMode.VACATION:
        return "☀️ 歡樂寒暑假";
      default:
        return "🏡 常規日常";
    }
  };

  const getEventIcon = (title: string): string => {
    const LowerTitle = title.toLowerCase();
    if (LowerTitle.includes("畫畫") || LowerTitle.includes("美術") || LowerTitle.includes("繪圖")) return "🎨";
    if (LowerTitle.includes("琴") || LowerTitle.includes("音樂") || LowerTitle.includes("鋼琴")) return "🎹";
    if (LowerTitle.includes("游") || LowerTitle.includes("泳")) return "🏊";
    if (LowerTitle.includes("考") || LowerTitle.includes("試") || LowerTitle.includes("複習") || LowerTitle.includes("英文")) return "📝";
    if (LowerTitle.includes("牙") || LowerTitle.includes("齒") || LowerTitle.includes("牙醫")) return "🦷";
    if (LowerTitle.includes("醫") || LowerTitle.includes("診") || LowerTitle.includes("藥") || LowerTitle.includes("看診")) return "🏥";
    if (LowerTitle.includes("聚餐") || LowerTitle.includes("吃") || LowerTitle.includes("飯") || LowerTitle.includes("餐")) return "🍲";
    if (LowerTitle.includes("旅") || LowerTitle.includes("玩") || LowerTitle.includes("出遊")) return "✈️";
    if (LowerTitle.includes("貓") || LowerTitle.includes("狗") || LowerTitle.includes("寵") || LowerTitle.includes("散步")) return "🐾";
    return "🌷";
  };

  const dateLabel = useMemo(() => {
    try {
      const parts = todayDateStr.split("-");
      const yStr = parts[0] || "2026";
      const mStr = parts[1] || "06";
      const dStr = parts[2] || "06";
      const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      
      const d = new Date(`${yStr}-${mStr}-${dStr}`);
      const dow = isNaN(d.getDay()) ? 6 : d.getDay();
      
      return `${yStr}年${mStr}月${dStr}日（${weekdays[dow]}）`;
    } catch(err) {
      return "2026年06月06日（星期六）";
    }
  }, [todayDateStr]);

  return (
    <div id="home-dashboard" className="space-y-6 select-none font-sans">
      {/* 💻 DESKTOP-ONLY INTERFACE CONTEXT */}
      <div className="hidden md:block space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (Main schedules - 60%+ Wide layout) */}
        <div className="lg:col-span-8 space-y-6">

          {/* 🏡 SATELLITE SYSTEM HEADER BANNER */}
          <div
            id="mode-hero-banner"
            style={{
              background: "#FFF6F4",
              border: "1px solid #F3CDC4",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(230, 110, 95, 0.03)",
              minHeight: "100px",
            }}
            className="p-5 flex items-center justify-between shadow-xs transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 relative z-10 font-sans">
              <div className="h-10 w-10 bg-white/50 backdrop-blur rounded-2xl flex items-center justify-center text-xl shrink-0">
                🏡
              </div>
              <div className="space-y-1 text-left">
                <h1 className="text-sm md:text-base font-black text-[#6B4B3E]">
                  今天是 {dateLabel}
                </h1>
                <p className="text-[11px] md:text-xs text-[#8A5F4E] font-bold flex items-center gap-1.5 flex-wrap leading-tight">
                  <span>{bannerText}</span>
                  <span className="bg-white/40 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider scale-95">
                    {getSystemModeName(systemMode)}
                  </span>
                </p>
                {activeModeConfig && (() => {
                  const start = new Date(activeModeConfig.startDate);
                  const end = new Date(activeModeConfig.endDate);
                  const today = new Date(todayDateStr);
                  start.setHours(0,0,0,0);
                  end.setHours(0,0,0,0);
                  today.setHours(0,0,0,0);
                  const elapsedDays = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const remainingDays = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  const emoji = activeModeConfig.type === SystemMode.TRAVEL ? "✈️"
                    : activeModeConfig.type === SystemMode.EXAM ? "📚"
                    : activeModeConfig.type === SystemMode.VACATION ? "🏕️" : "✨";

                  const text = activeModeConfig.type === SystemMode.EXAM 
                    ? `目前進行中：${activeModeConfig.name}（剩${remainingDays}天）`
                    : `目前進行中：${activeModeConfig.name}（第${elapsedDays}天）`;

                  return (
                    <div className="mt-1 flex items-center gap-1.5 bg-white/40 border border-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-black text-[#6B4B3E] shrink-0 w-fit">
                      <span>{emoji}</span>
                      <span>{text}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 🏡 {家庭名稱}的每一天 */}
            <div className="hidden sm:flex bg-white/40 backdrop-blur-md px-4 py-2.5 rounded-xl text-center flex-col justify-center border border-white/20 select-none font-sans shrink-0">
              <span className="text-[#6B4B3E] text-xs font-black tracking-tight flex items-center justify-center gap-1.5">
                🏡 {activeFamily?.name ? activeFamily.name : "我們家"}的每一天
              </span>
            </div>
          </div>

          {/* 📢 家裡公告 */}
          <section
            id="home-announcements"
            style={{
              background: "#FFFFFF",
              border: "3px solid #F3CDC4",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(230, 110, 95, 0.03)",
              minHeight: "100px",
            }}
            className="p-4 font-sans relative flex flex-col justify-between"
          >
            <div className="flex justify-between items-center pb-2 border-b border-[#F5D8D0]/60 select-none">
              <div className="flex items-center gap-2">
                <span className="text-sm">📢</span>
                <h3 className="text-xs font-black text-[#3C332D]">家裡公告</h3>
              </div>
              {canCreateAnnouncement && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAnnouncement(null);
                    setNewAnnTitle("");
                    setNewAnnContent("");
                    setShowAddAnnModal(true);
                  }}
                  className="flex items-center gap-1 px-3.5 py-1 text-[10px] font-bold text-[#5B7283] bg-[#EAF0EB] rounded-lg hover:bg-[#DEE7E0] transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>發佈</span>
                </button>
              )}
            </div>

            <div className="mt-3 flex-1 flex flex-col justify-center">
              {announcements.length === 0 ? (
                <div className="text-center py-4 bg-white/40 border border-dashed border-[#F3CDC4]/50 rounded-2xl">
                  <p className="text-xs text-gray-400 font-bold">目前沒有公告事項</p>
                </div>
              ) : (
                (() => {
                  const ann = announcements[0];
                  return (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnouncement(ann)}
                      className="relative block text-left cursor-pointer transition hover:scale-[1.002] flex-1 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 pr-16">
                        <span className="text-lg shrink-0 mt-0.5">📌</span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm md:text-base font-black text-rose-955 leading-tight tracking-tight">
                            {ann.title}
                          </h4>
                          {ann.content && (
                            <p className="text-xs md:text-sm font-bold text-rose-900/90 mt-1 break-words whitespace-pre-wrap leading-snug">
                              {ann.content}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {canEditAnnouncement(ann) && (
                        <div className="flex items-center justify-end gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAnnouncement(ann);
                              setNewAnnTitle(ann.title);
                              setNewAnnContent(ann.content);
                              setShowAddAnnModal(true);
                            }}
                            className="p-1 px-2 text-[10px] text-rose-500 hover:text-rose-800 bg-white/75 hover:bg-white border border-rose-200/50 rounded-lg cursor-pointer transition flex items-center gap-1 font-bold"
                            title="修改公告"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>修改</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnnouncementToDelete(ann);
                              setDeleteAnnError(null);
                              setShowDeleteAnnConfirm(true);
                            }}
                            className="p-1 px-2 text-[10px] text-rose-500 hover:text-rose-800 bg-rose-100 hover:bg-rose-205 rounded-lg cursor-pointer transition flex items-center gap-1 font-bold"
                            title="刪除"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>刪除</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </section>

          {/* Kids-Only Dashboards for Stars and Wills Goal Progress */}
          {currentUser.role === UserRole.KID && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
              
              {/* ⭐ 我的星星 Block */}
              <section
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E2D8",
                  borderRadius: "24px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                }}
                className="p-6 font-sans flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 pb-3.5 mb-4 border-b border-[#F7F3EB]">
                    <span className="text-base">⭐</span>
                    <h2 className="text-sm font-black text-[#3C332D]">我的星星與餘額</h2>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center py-4 bg-[#FFFDF8] rounded-2xl border border-amber-100/50 mb-4">
                    {/* Animated Emojis / Stars */}
                    <div className="flex gap-1.5 mb-2 select-none">
                      <span className="text-xl animate-pulse">⭐</span>
                      <span className="text-xl animate-pulse">⭐</span>
                      <span className="text-xl animate-pulse">⭐</span>
                    </div>
                    
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">目前星星</p>
                    <div className="text-5xl font-black text-amber-500 font-mono tracking-tight my-1.5">
                      {kidStats.currentStars}
                    </div>
                    
                    <span className="text-[10px] font-bold text-gray-400">
                      本月已獲得 {kidStats.monthEarned} 顆 • 今日獲得 {kidStats.todayEarned} 顆
                    </span>
                  </div>

                  {/* Motivational Distance Info */}
                  {(() => {
                    const availableGifts = (rewards || []).filter(r => r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.APPROVED);
                    const currentStars = kidStats.currentStars;
                    
                    const lockedGifts = availableGifts
                      .filter(r => r.starsCost > currentStars)
                      .map(r => ({
                        ...r,
                        diff: r.starsCost - currentStars
                      }))
                      .sort((a, b) => a.diff - b.diff);
                    
                    if (lockedGifts.length === 0) {
                      return (
                        <div className="text-[11px] font-black text-emerald-700 bg-emerald-50 rounded-xl p-3 border border-emerald-100/40 text-center">
                          🎉 超厲害！所有商城禮物都可換了！
                        </div>
                      );
                    }
                    
                    const closest = lockedGifts[0];
                    return (
                      <div className="space-y-3">
                        <div className="bg-amber-50/40 border border-amber-100/50 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[#3C332D]">距離最近禮物</span>
                          <span className="text-rose-600 font-black">
                            還差 <span className="font-mono text-sm">{closest.diff}</span> 顆星
                          </span>
                        </div>
                        
                        <div className="space-y-1.5 pl-0.5">
                          <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">目標里程碑：</p>
                          {lockedGifts.slice(0, 2).map((gift) => (
                            <div key={gift.id} className="flex justify-between items-center text-[11px] font-bold text-gray-600">
                              <span className="flex items-center gap-1 text-gray-700">
                                <span>🎁</span> {gift.title}
                              </span>
                              <span className="text-gray-400 text-[10px] font-extrabold">
                                還差 <span className="text-rose-500 font-mono font-bold">{gift.diff}</span> 顆星
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* 🎁 我的願望進度 Block */}
              <section
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E2D8",
                  borderRadius: "24px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                }}
                className="p-5 font-sans"
              >
                <div className="flex items-center gap-2 pb-3.5 mb-4 border-b border-[#F7F3EB]">
                  <span className="text-base">🎁</span>
                  <h2 className="text-sm font-black text-[#3C332D]">我的願望進度</h2>
                </div>

                {(() => {
                  const availableGifts = (rewards || []).filter(r => r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.APPROVED);
                  if (availableGifts.length === 0) {
                    return (
                      <div className="text-center py-8 bg-[#FAF8F5] rounded-xl border border-dashed border-[#EFEAE2]">
                        <p className="text-xs text-gray-450 font-black">目前商城內尚未上架精美禮物喔</p>
                        <p className="text-[10px] text-gray-400 mt-1">等爸爸媽媽上架好玩的方案就可以許願追蹤了！</p>
                      </div>
                    );
                  }

                  // Sort available gifts so closest progress are shown first
                  const mappedGifts = availableGifts.map(r => {
                    const starsNeed = r.starsCost;
                    const starsHave = kidStats.currentStars;
                    const diff = Math.max(0, starsNeed - starsHave);
                    const pct = Math.min(100, Math.round((starsHave / starsNeed) * 100));
                    return {
                      reward: r,
                      starsNeed,
                      starsHave,
                      diff,
                      pct,
                      canRedeem: diff <= 0,
                    };
                  }).sort((a,b) => {
                    // prior unredeemed closest progress
                    if (a.canRedeem && !b.canRedeem) return 1;
                    if (!a.canRedeem && b.canRedeem) return -1;
                    return b.pct - a.pct;
                  });

                  // Display top 2 closest gifts
                  return (
                    <div className="space-y-4">
                      {mappedGifts.slice(0, 2).map((item) => (
                        <div key={item.reward.id} className="p-3 bg-[#FAF8F5] border border-[#EFEAE2] rounded-xl space-y-2 text-xs">
                          <div className="flex justify-between items-baseline">
                            <span className="font-extrabold text-[#3C332D] text-sm flex items-center gap-1">
                              🎁 {item.reward.title}
                            </span>
                            <span className="text-[11px] font-black text-amber-800">
                              需要：{item.starsNeed} 顆星
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[10.5px] text-gray-500 font-bold font-sans">
                            <span>目前累積：{item.starsHave} 星 / 還差：<span className="font-black text-rose-500">{item.diff}</span> 星</span>
                            <span className="font-mono font-black">{item.pct}%</span>
                          </div>

                          {/* Progress bar container */}
                          <div className="w-full bg-[#EFEAE2] rounded-full h-3 relative overflow-hidden flex items-center font-bold">
                            <div
                              className="bg-[#EAA59E] h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.pct}%` }}
                            />
                          </div>

                          {item.canRedeem && (
                            <div className="pt-1 text-center font-black text-[11px] text-[#3F8C62] flex items-center justify-center gap-1 leading-tight">
                              <span>🎉 可以兌換囉！快去禮物中心發送兌領吧！</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>

            </div>
          )}
          
          {/* 1. 🏡 今日重點 */}
          <section
            style={{
              background: "#FFF6F4",
              border: "1px solid #F3CDC4",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(230, 110, 95, 0.03)",
              minHeight: "100px",
            }}
            className="p-4"
          >
            <div 
              onClick={() => setIsTodayPointsExpanded(!isTodayPointsExpanded)}
              className="flex items-center justify-between pb-2 border-b border-[#F5D8D0]/60 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-sans font-black">🏡</span>
                <h2 className="text-xs font-black text-[#3C332D]">今日重點</h2>
                {isTodayPointsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
              <span className="text-[10px] font-bold text-gray-500 font-mono bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                {todayDateStr}
              </span>
            </div>

            {isTodayPointsExpanded && (
              <div className="mt-3 space-y-3">
                {/* Dynamic Holiday / Festival Banner Alert */}
                {todayHoliday && (
                  <div className={`p-3 rounded-xl border flex items-center gap-3 select-none ${
                    todayHoliday.isNational
                      ? "bg-gradient-to-r from-rose-50 to-rose-100/40 border-rose-200/80 text-[#D32F2F] shadow-sm"
                      : "bg-gradient-to-r from-purple-50 to-purple-100/40 border-purple-200/80 text-[#7B1FA2] shadow-sm"
                  }`}>
                    <div className="text-2xl shrink-0">
                      {todayHoliday.emoji}
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-wide">
                        今天是 {todayHoliday.name}
                      </h3>
                      <p className="text-[10px] font-bold opacity-85 mt-0.5">
                        {todayHoliday.isNational
                          ? "🎉 國慶與放假節日，願你有一段美好快樂的時光！"
                          : "🎈 充滿歡樂的特別日子，和家人一同感受儀式感吧！"}
                      </p>
                    </div>
                  </div>
                )}

                {dataLoaded && !dataLoaded.events ? (
                  <ShimmerSkeleton count={2} />
                ) : todayEvents.length === 0 ? (
                  <div className="text-center py-5 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#EFEAE2] flex flex-col items-center justify-center font-sans">
                    <span className="text-[20px] mb-1">🎯</span>
                    <p className="text-sm font-black text-[#6B4B3E]">今天辛苦了</p>
                    <p className="text-xs text-gray-400 font-bold mt-0.5">看看還有沒有未完成事項吧！</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {todayEvents.map((evt) => {
                      const isBday = (evt as any).isBirthday;
                      const timeStatus = parseEventTime(evt.time);

                      if (isBday) {
                        return (
                          <div
                            key={evt.id}
                            style={{
                              background: "#FFF5F6",
                              borderColor: "#F2D1D4",
                            }}
                            className="p-3 rounded-xl border flex items-center gap-3"
                          >
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-lg shrink-0 border bg-rose-100 border-rose-300">
                              🎂
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-rose-800">
                                {((evt as any).birthdayMemberName || evt.title.replace("🎂", "").trim().replace("生日", "")).trim()} 生日快樂！
                              </h4>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={evt.id}
                          style={{
                            background: "#FAF8F5",
                            borderColor: "#EFEAE2",
                          }}
                          className="p-3 rounded-xl border flex items-center gap-3 hover:scale-[1.01] transition-transform"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-lg shrink-0 border bg-white border-[#E8E2D8]">
                            {getEventIcon(evt.title)}
                          </div>
                          <div className="min-w-0 flex-grow text-left">
                            <h4 className="text-xs truncate font-black text-[#3C332D]">
                              {isMultiDayEvent(evt)
                                ? `${getEventEmoji(evt.title)} ${evt.title} Day${getMultiDayLabel(evt.startDate!, evt.endDate!, todayDateStr).dayIndex}`
                                : evt.title
                              }
                            </h4>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              <p className="text-[10px] font-mono text-gray-500 font-bold">
                                {evt.time || "全天時間"}
                              </p>
                              {timeStatus.hasTime && timeStatus.isOngoing && (
                                <span className="text-emerald-755 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.2 text-[8px] font-black tracking-wider flex items-center gap-0.5 animate-pulse">
                                  🟢 進行中
                                </span>
                              )}
                            </div>
                            {isMultiDayEvent(evt) && evt.dailyNotes?.[todayDateStr] && (
                              <div className="text-[10px] text-[#004B8F] font-bold bg-[#E1F0FF]/60 px-1.5 py-0.5 rounded border border-sky-100 mt-1 inline-block truncate max-w-full">
                                📘 {evt.dailyNotes[todayDateStr]}
                              </div>
                            )}
                            {evt.isFixed && (
                              <span className="inline-block mt-1 text-[8px] font-bold text-rose-500 bg-rose-50 px-1 py-0.2 rounded border border-rose-100">
                                固定日常
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. 📅 接下來七天 */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D8",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            }}
            className="p-4 md:p-6"
          >
            <div 
              onClick={() => setIsSevenDaysExpanded(!isSevenDaysExpanded)}
              className="flex items-center justify-between mb-4 md:mb-6 pb-4 border-b border-[#F7F3EB] cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <h2 className="text-sm font-black text-[#3C332D]">接下來七天</h2>
                {isSevenDaysExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
              <span className="text-[10px] font-bold text-[#5B7283] bg-[#EAF0EB] px-2.5 py-1 rounded-full">
                行程手帳
              </span>
            </div>

            {isSevenDaysExpanded && (
              dataLoaded && !dataLoaded.events ? (
                <ShimmerSkeleton count={3} />
              ) : (
                <>
                  {/* 手機版：超高密度單層扁平行程列表 (無大卡片、無巨大留白、無大圓角容器) */}
                  <div className="md:hidden block space-y-0 text-[#3C332D]">
                    {nextSevenDays.map((day, dIdx) => (
                      <div key={day.dateStr} className="border-b border-[#F5F2EB] last:border-0 pb-3 mb-3">
                        {/* 日期列：🌱 06/10（三） */}
                        <div className="flex items-center justify-between h-auto py-1 select-none">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-[14px] font-black text-[#7C6354] tracking-tight shrink-0">
                              🌱 {day.displayDate.replace(/^\d+年/, "")}
                            </span>
                            {day.holiday && (
                              <span className={`text-[10.5px] font-black px-1.5 py-0.5 rounded-md shrink-0 scale-95 ${
                                day.holiday.isNational 
                                  ? "bg-rose-50 text-[#C71585] border border-rose-150" 
                                  : "bg-purple-50 text-[#8E24AA] border border-purple-150"
                              }`}>
                                {day.holiday.emoji} {day.holiday.isNational ? "國定節日" : "重要節日"}：{day.holiday.name}
                              </span>
                            )}
                            {day.isToday && (
                              <span className="bg-[#EAA59E] text-white text-[9px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 scale-95 font-sans">
                                今天
                              </span>
                            )}
                          </div>

                          {/* 快速新增 "+" 按鈕 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickAddDate(day.dateStr);
                            }}
                            className="h-8 w-8 rounded-full bg-[#FAF9F6] border border-[#EFEAE2] flex items-center justify-center text-[#7C6354] hover:bg-[#F5EBE6] active:scale-90 transition-all shrink-0 cursor-pointer"
                            title="快速新增行程"
                          >
                            <Plus className="h-4 w-4 stroke-[2.5]" />
                          </button>
                        </div>

                        {/* 行程列：扁平無外框、無大圓角卡片 */}
                        <div className="mt-0.5 pl-1 space-y-1">
                          {day.events.length === 0 ? (
                            <div className="text-[13px] text-gray-400 font-bold py-1 select-none">
                              無安排
                            </div>
                          ) : (
                            day.events.map((evt) => {
                              const isBday = (evt as any).isBirthday;
                              return (
                                <div
                                  key={evt.id}
                                  onClick={() => {
                                    if (onNavigateToEvent) {
                                      onNavigateToEvent(evt.id, evt.date || day.dateStr);
                                    }
                                  }}
                                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1.5 active:bg-gray-100/50 transition-all text-left min-h-[40px] border-b border-dotted border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-baseline gap-2 min-w-0 flex-grow">
                                    {/* 時間 */}
                                    <span className="text-xs font-extrabold text-[#948274] font-mono shrink-0">
                                      {isBday ? "全天" : (evt.time || "--:--")}
                                    </span>

                                    {/* 名稱與細節 */}
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span className={`text-[13px] font-black leading-snug truncate ${isBday ? "text-rose-850" : "text-[#2D2926]"}`}>
                                        {isBday 
                                          ? `🎂 ${((evt as any).birthdayMemberName || evt.title.replace("🎂", "").trim().replace("生日", "")).trim()}生日快樂！` 
                                          : evt.title
                                        }
                                      </span>
                                      {evt.isPublic === false && !isBday && (
                                        <span className="bg-amber-50 text-amber-700 text-[9px] px-1 rounded border border-amber-100 font-bold shrink-0">
                                          🔒 私人
                                        </span>
                                      )}
                                      {evt.isFixed && !isBday && (
                                        <span className="bg-rose-50 text-rose-500 text-[9px] px-1 rounded border border-rose-100 shrink-0 font-medium">
                                          日常
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <span className="text-gray-300 text-xs pl-2 select-none">›</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 桌機版：保留原本的大卡片排列模式 */}
                  <div className="hidden md:block space-y-4">
                    {nextSevenDays.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{
                          background: day.isToday ? "#FFF8F6" : "#FFFFFF",
                          border: day.isToday ? "2px solid #F0C4B8" : "1px solid #E8E2D8",
                        }}
                        className="p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
                      >
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-2xl">
                            {day.isToday ? "🗓️" : "🌱"}
                          </span>
                          <div>
                            <span
                              className={`text-sm font-black flex items-center gap-1.5 flex-wrap ${
                                day.isToday ? "text-[#C76A5A]" : "text-[#7C6354]"
                              }`}
                            >
                              <span>{day.displayDate}</span>
                              {day.holiday && (
                                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border shrink-0 ${
                                  day.holiday.isNational 
                                    ? "bg-rose-50 text-[#C71585] border-rose-200" 
                                    : "bg-purple-50 text-[#8E24AA] border-purple-200"
                                }`}>
                                  <span>{day.holiday.emoji}</span>
                                  <span>{day.holiday.isNational ? "國定節日" : "重要節日"}：{day.holiday.name}</span>
                                </span>
                              )}
                              {day.isToday && (
                                <span className="bg-[#EAA59E] text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse font-sans">
                                  今天
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex-grow min-w-0 md:pl-6 border-l-0 md:border-l border-[#F2ECE4]">
                          {day.events.length === 0 ? (
                            <span className="text-xs text-gray-400 font-bold flex items-center gap-1 py-1.5 pl-1">
                              無安排行程安排 🌷
                            </span>
                          ) : (
                            <div className="space-y-4">
                              {day.events.map((evt) => {
                                const isBday = (evt as any).isBirthday;
                                const involved = getInvolvedMembers(evt);
                                const hasNote = evt.note && evt.note.trim().length > 0;
                                
                                if (isBday) {
                                  return (
                                    <div
                                      key={evt.id}
                                      className="p-4 rounded-2xl border border-rose-200 bg-rose-50/70 text-left flex items-center gap-3.5"
                                    >
                                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-xl shrink-0 border bg-rose-100 border-rose-300">
                                        🎂
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-black text-rose-800">
                                          {((evt as any).birthdayMemberName || evt.title.replace("🎂", "").trim().replace("生日", "")).trim()} 生日快樂！
                                        </h4>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={evt.id}
                                    onClick={() => {
                                      if (onNavigateToEvent) {
                                        onNavigateToEvent(evt.id, evt.date || day.dateStr);
                                      }
                                    }}
                                    className="group p-4 rounded-2xl border border-[#EFEAE2] bg-[#FCFBF9] transition-all duration-300 cursor-pointer text-left flex flex-col gap-2.5 shadow-sm hover:shadow-md hover:scale-[1.01] hover:bg-[#FFFDFB] hover:border-amber-200"
                                  >
                                    {/* 📅 Date & 🔒 Privacy info row */}
                                    <div className="flex items-center justify-between flex-wrap gap-1 text-[10px] text-gray-400 font-bold">
                                      <span className="flex items-center gap-1 bg-[#F2EDE4]/60 px-2 py-0.5 rounded text-gray-600">
                                        <span>📅</span>
                                        <span>{evt.date || day.dateStr}</span>
                                      </span>
                                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                        evt.isPublic !== false
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-amber-50 text-amber-700 font-bold"
                                      }`}>
                                        {evt.isPublic !== false ? (
                                          <>
                                            <span>🔓</span>
                                            <span>家庭公開</span>
                                          </>
                                        ) : (
                                          <>
                                            <span>🔒</span>
                                            <span>私人</span>
                                          </>
                                        )}
                                      </span>
                                    </div>

                                    {/* 🏷 Event title & category icon */}
                                    <div className="flex items-start gap-2">
                                      <span className="text-lg shrink-0">
                                        {getEventIcon(evt.title)}
                                      </span>
                                      <div className="space-y-0.5 min-w-0">
                                        <h4 className="text-sm font-black leading-tight truncate text-[#3C332D]">
                                          {isMultiDayEvent(evt)
                                            ? `${getEventEmoji(evt.title)} ${evt.title} Day${getMultiDayLabel(evt.startDate!, evt.endDate!, day.dateStr).dayIndex}`
                                            : evt.title
                                          }
                                        </h4>
                                        {isMultiDayEvent(evt) && evt.dailyNotes?.[day.dateStr] && (
                                          <div className="text-[11px] text-[#004B8F] font-bold bg-[#E1F0FF]/60 px-2 py-0.5 rounded-lg border border-sky-200 mt-1 inline-block truncate max-w-full text-left">
                                            📘 {evt.dailyNotes[day.dateStr]}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 🕒 Time info */}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold font-sans">
                                      <span className="text-xs shrink-0 font-sans">🕒</span>
                                      <span>{evt.time || "無指定時間"}</span>
                                    </div>

                                    {/* 📝 Note container */}
                                    {hasNote && (
                                      <div className="p-2.5 rounded-xl text-xs space-y-1 bg-orange-50/50 text-gray-600 border border-orange-100/40">
                                        <div className="font-extrabold flex items-center gap-1 text-[10px] text-gray-500">
                                          <span>📝</span>
                                          <span>備註內容</span>
                                        </div>
                                        <p className="font-semibold whitespace-pre-wrap leading-relaxed">
                                          {evt.note}
                                        </p>
                                      </div>
                                    )}

                                    {/* 👤 Involved members (optional) */}
                                    {involved.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#F2ECE5]/30">
                                        <span className="text-xs text-gray-400 shrink-0">👤 指派成員:</span>
                                        {involved.map((name, idx) => (
                                          <span
                                            key={idx}
                                            className="text-[10px] font-black text-amber-900 bg-amber-50 border border-amber-200/55 px-2 py-0.5 rounded-full"
                                          >
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </section>

          {/* 📱 快速新增行程彈窗 (手機版專用) */}
          {quickAddDate && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#E8E2D8]">
                <div className="bg-[#FAF9F6] px-5 py-4 border-b border-[#EFEAE2] flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm text-[#3C332D]">⚡ 快速新增行程</h3>
                    <p className="text-[11px] text-[#7C6354] font-medium mt-0.5">
                      新增至：{quickAddDate}
                    </p>
                  </div>
                  <button
                    onClick={() => setQuickAddDate(null)}
                    className="p-1 px-2 text-xs rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleQuickAddSubmit} className="p-5 space-y-4">
                  {/* 行程名稱 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#7C6354]/80 block">行程名稱 (必填)</label>
                    <input
                      type="text"
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      placeholder="例如：榮總看牙醫、游泳課..."
                      className="w-full text-xs p-3 border border-[#EFEAE2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C6354]/40 bg-white"
                      required
                    />
                  </div>

                  {/* 行程時間 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#7C6354]/80 block">時間 (選填)</label>
                    <input
                      type="text"
                      value={quickAddTime}
                      onChange={(e) => setQuickAddTime(e.target.value)}
                      placeholder="例如：14:00、18:00~19:30"
                      className="w-full text-xs p-3 border border-[#EFEAE2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C6354]/40 bg-white"
                    />
                  </div>

                  {/* 備註 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#7C6354]/80 block">備註 (選填)</label>
                    <textarea
                      value={quickAddNote}
                      onChange={(e) => setQuickAddNote(e.target.value)}
                      placeholder="簡單紀事..."
                      rows={2}
                      className="w-full text-xs p-3 border border-[#EFEAE2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C6354]/40 bg-white resize-none"
                    />
                  </div>

                  {/* 公開設定 */}
                  <div className="flex items-center justify-between py-2 border-t border-[#F7F3EB]">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-[#3C332D]">家庭公開</span>
                      <span className="text-[9px] text-gray-400 mt-0.5">
                        {quickAddPublic ? "全體家庭成員皆能瀏覽" : "🔒 私人行程 (僅自己與家庭管理員可見)"}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={quickAddPublic}
                        onChange={(e) => setQuickAddPublic(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {!quickAddPublic && (
                    <p className="text-[10px] text-amber-600 bg-amber-50/50 rounded-lg p-2 border border-amber-100 font-medium leading-normal mb-1">
                      🔒 私人行程說明：不公開狀態下僅建立者本人與家庭管理員可查看。其他家庭成員將完全無法看到此行程。
                    </p>
                  )}

                  {/* 提交按鈕 */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuickAddDate(null)}
                      className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-150 rounded-xl transition-all cursor-pointer text-center"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 text-xs font-black text-white bg-[#7C6354] hover:bg-[#634F43] rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer text-center disabled:opacity-50"
                    >
                      {isSubmitting ? "建立中..." : "確認建立"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}



        </div>

        {/* Right Column (Sidebars / Widgets) */}
        <div className="lg:col-span-4 space-y-6">

          {/* 1. 🎂 生日倒數 (Render card directly, no category header/title or nesting) */}
          {(birthdayReminders.todayStars.length > 0 || birthdayReminders.countdownList.length > 0) && (
            <div className="space-y-3">
              {/* Today's birthdays */}
              {birthdayReminders.todayStars.map((star, idx) => (
                <div
                  key={`side-today-star-${idx}`}
                  style={{
                    background: "#FFF5F6",
                    border: "1px solid #FBCFE8",
                    borderRadius: "24px",
                    boxShadow: "0 4px 12px rgba(219, 39, 119, 0.05)",
                  }}
                  className="p-5 font-sans animate-fade-in text-left flex items-start gap-3 select-none"
                >
                  <span className="text-2xl shrink-0 mt-0.5">🎂</span>
                  <div>
                    <h4 className="font-extrabold text-rose-955 text-sm leading-tight">
                      {star.member.displayName} 今天生日！
                    </h4>
                    <p className="text-xs font-semibold text-rose-600 mt-1 leading-relaxed font-sans">
                      記得幫 {star.member.displayName} 慶生唷！
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Countdown list */}
              {birthdayReminders.countdownList.map((notify, idx) => (
                <div
                  key={`side-countdown-${idx}`}
                  style={{
                    background: "#FFF5F6",
                    border: "1px solid #FBCFE8",
                    borderRadius: "24px",
                    boxShadow: "0 4px 12px rgba(219, 39, 119, 0.05)",
                  }}
                  className="p-5 font-sans animate-fade-in text-left flex items-start gap-3 select-none"
                >
                  <span className="text-2xl shrink-0 mt-0.5">🎂</span>
                  <div>
                    <h4 className="font-extrabold text-rose-955 text-sm leading-tight">
                      {notify.member.displayName}生日還有 {notify.diffDays} 天
                    </h4>
                    <p className="text-xs font-semibold text-rose-600 mt-1 leading-relaxed font-sans">
                      記得幫 {notify.member.displayName} 慶生唷！
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. ⭐ 家庭星星中心 (Maintains equal focus without rank sorting) */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D8",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            }}
            className="p-5 font-sans"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F7F3EB] select-none">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h3 className="text-sm font-black text-[#3C332D]">家庭星星中心</h3>
              </div>
            </div>

            <div className="space-y-4">
              {kidsMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-400 font-bold text-xs">
                  尚無孩子成員紀錄
                </div>
              ) : (
                <div className="space-y-4">
                  {kidsMembers.map((kid) => {
                    const closestGift = getClosestGiftInfoForKid(kid.stars || 0);
                    return (
                      <div
                        key={kid.uid}
                        className="p-4 bg-[#FAF8F5] border border-[#EFEAE2] rounded-2xl space-y-3 shadow-xs hover:bg-[#FFFDF8] transition duration-200"
                      >
                        {/* Name of Kid and Stars */}
                        <div className="flex items-center justify-between gap-2 border-b border-gray-150/40 pb-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              style={{ backgroundColor: kid.color || "#B4C3B2" }}
                              className="h-8.5 w-8.5 rounded-full flex items-center justify-center text-xs text-[#2D2926] border border-[#E5E1DA] font-black shrink-0"
                            >
                              {(!kid.photoURL || kid.photoURL.startsWith("http")) 
                                ? (kid.displayName ? kid.displayName.charAt(0) : "✿") 
                                : kid.photoURL}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-[#3C332D]">{kid.displayName}</h4>
                              <span className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200/50 px-1.5 py-0.2 rounded font-black font-sans mt-0.5 inline-block">
                                孩子
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 px-3 py-1 bg-[#FFF9F6] border border-[#F2D6CD]/40 rounded-xl shrink-0">
                            <span className="text-sm font-black text-[#C76A5A] font-mono">{kid.stars || 0}</span>
                            <span className="text-[#C76A5A] font-bold text-xs">顆星</span>
                          </div>
                        </div>

                        {/* Proximity / Nearest Gift Detail */}
                        {closestGift ? (
                          <div className="text-xs space-y-1 text-gray-600 font-medium select-none">
                            <div className="flex justify-between text-[11px] font-black text-gray-400">
                              <span>🎯 距離最近禮物：</span>
                              <span className="text-amber-805 truncate ml-1">{closestGift.title}</span>
                            </div>
                            <div className="flex justify-between pt-0.5 font-bold">
                              <span>需要星星：</span>
                              <span>{closestGift.starsCost} 🌟</span>
                            </div>
                            <div className="flex justify-between text-gray-700 font-bold items-center text-[11px]">
                              <span>目前進度：</span>
                              {closestGift.isAchieved ? (
                                <span className="text-emerald-600 font-black">🎉 已達標可以兌換！</span>
                              ) : (
                                <span>還差 <span className="text-rose-500 font-black font-mono">{closestGift.gap}</span> 顆星</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-450 italic">目前尚未上架任何兌換禮物唷</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 5. 🌱 即將完成任務 (Calculates and displays progress to available reward items) */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D8",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            }}
            className="p-5"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F7F3EB] select-none">
              <div className="flex items-center gap-2">
                <span className="text-lg font-sans">🌱</span>
                <h3 className="text-sm font-black text-[#3C332D]">即將完成任務</h3>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-100 shrink-0">
                願望達成進度
              </span>
            </div>

            <div className="space-y-4">
              {kidRewardProgressList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-[#FAF8F5] rounded-xl text-xs font-bold border border-dashed border-gray-200">
                  目前沒有可兌換的禮物項目
                </div>
              ) : (
                <div className="space-y-4">
                  {kidRewardProgressList.map(({ kid, bestGoal }) => {
                    if (!bestGoal) {
                      return (
                        <div key={kid.uid} className="p-3 bg-[#FAF8F5] rounded-xl border border-dashed border-[#EFEAE2]">
                          <h4 className="font-bold text-xs text-gray-700">{kid.displayName}</h4>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">目前沒有上架的禮物可追蹤</p>
                        </div>
                      );
                    }

                    const { reward, diff, pct, canRedeem } = bestGoal;
                    return (
                      <div key={kid.uid} className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EFEAE2] space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-[#3C332D] flex items-center gap-1.5">
                            <Smile className="h-3.5 w-3.5 text-amber-500 fill-amber-100" />
                            {kid.displayName}
                          </span>
                          <span className="text-[10px] font-bold text-amber-900 font-mono">
                            目前 {kid.stars || 0}★
                          </span>
                        </div>

                        <div className="border border-white bg-white p-2.5 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-gray-800 truncate max-w-[70%]">
                              🎁 {reward.title}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 font-mono">
                              需要 {reward.starsCost}★
                            </span>
                          </div>

                          {canRedeem ? (
                            <p className="text-[11px] text-emerald-600 font-bold mt-1 bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg flex items-center gap-1">
                              🎉 已經可以兌換此禮物！快去兌換吧！
                            </p>
                          ) : (
                            <div className="space-y-1.5 mt-1">
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                                />
                              </div>
                              <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 flex-wrap">
                                <span>已達成 {pct}%</span>
                                <span className="text-rose-408 opacity-70">|</span>
                                <span>還差 {diff} 顆星星 ⭐</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 6. 🎂 家族生日小幫手 */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D8",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            }}
            className="p-5 animate-fade-in text-left font-sans"
          >
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#F7F3EB] select-none">
              <span className="text-lg">🎂</span>
              <h3 className="text-sm font-black text-[#3C332D]">家族生日小幫手</h3>
            </div>

            <div className="space-y-4">
              {/* Pre-birthday countdown alerts (e.g. 媽媽生日還有 3 天) */}
              {birthdayReminders.countdownList.length > 0 && (
                <div className="space-y-2 mb-4">
                  {birthdayReminders.countdownList.map((notify) => {
                    const showAge = notify.member.showAge !== false;
                    return (
                      <div
                        key={`alert-${notify.member.uid}`}
                        className="bg-rose-50 border border-rose-100 text-rose-900 text-xs font-black p-3 rounded-xl flex items-center justify-between"
                      >
                        <span>
                          🎂 {showAge ? `${notify.member.displayName}（${notify.age}歲）` : `${notify.member.displayName}生日`} 還有 {notify.diffDays} 天
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 📅 即將到來生日列覽 (Sourced automatically from live profiles, filtered to max 60 days) */}
              <div className="space-y-2.5">
                <p className="text-[10px] uppercase font-black text-gray-500 tracking-wider">
                  家庭成員生日排程 (近 60 天內)
                </p>
                {birthdayReminders.allUpcoming.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 bg-[#FAF8F5] rounded-xl text-[11px] font-bold border border-dashed border-gray-100 flex flex-col items-center justify-center gap-1">
                    <span className="text-lg">🎂</span>
                    <span>未來 60 天內無成員生日提醒</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {birthdayReminders.allUpcoming.map((star) => {
                      const showAge = star.member.showAge !== false;
                      return (
                        <div
                          key={`item-${star.member.uid}`}
                          className="flex justify-between items-center p-3 bg-white border border-[#EFEAE2] rounded-xl hover:bg-[#FAF8F5] transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm shrink-0">🎂</span>
                            <div>
                              <h4 className="font-extrabold text-[#3C332D] text-xs">
                                {star.member.displayName}
                              </h4>
                              <p className="text-[10px] text-gray-550 font-bold mt-0.5">
                                生日：{star.birthdayStr} {showAge && `(將滿 ${star.age} 歲)`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {star.diffDays === 0 ? (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full animate-pulse">
                                🎉 今天生日
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-[#5C4533] bg-[#FFFDF8] border border-[#EFEAE2] px-2.5 py-1 rounded-full">
                                倒數 {star.diffDays} 天
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>


          {/* 7. 🎉 最近完成任務 (Approved tasks within last 3 days) */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D8",
              borderRadius: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            }}
            className="p-5"
          >
            <div 
              onClick={() => setIsRecentlyCompletedExpanded(!isRecentlyCompletedExpanded)}
              className="flex items-center justify-between pb-4 mb-4 border-b border-[#F7F3EB] cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎉</span>
                <h3 className="text-sm font-black text-[#3C332D]">近三天達成成就</h3>
                {isRecentlyCompletedExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </div>

            {isRecentlyCompletedExpanded && (
              recentAchievements.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-[#FAF8F5] rounded-xl text-xs font-bold leading-relaxed border border-dashed border-[#EFEAE2]">
                  最近三天還沒有完成的新任務，加油喔！🌱
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAchievements.map((t) => {
                    const assignee = familyMembers.find((m) => m.uid === t.assignedTo);
                    
                    // Format approvedDate visually
                    let dateStr = "近期";
                    if (t.approvedAt?.seconds) {
                      const d = new Date(t.approvedAt.seconds * 1000);
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      dateStr = `${mm}/${dd}`;
                    } else if (t.approvedAt instanceof Date) {
                      const mm = String(t.approvedAt.getMonth() + 1).padStart(2, "0");
                      const dd = String(t.approvedAt.getDate()).padStart(2, "0");
                      dateStr = `${mm}/${dd}`;
                    }

                    return (
                      <div
                        key={t.id}
                        className="flex justify-between items-start p-3 bg-emerald-50/35 border border-emerald-100/50 rounded-2xl"
                      >
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-gray-800 break-all flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 fill-emerald-100 flex-shrink-0" />
                            <span>{t.title}</span>
                          </h4>
                          <p className="text-[10px] text-gray-500 mt-1 font-bold pl-4.5">
                            完成者: <strong className="text-gray-700">{assignee?.displayName || "小孩"}</strong> (於 {dateStr} 審核通過)
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-mono">
                          +{t.starsReward}★
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </section>

        </div>
      </div>
      </div> {/* Closes desktop layout container */}

      {/* Modals are moved to the root level below to prevent active-state responsive hiding */}

      {/* Mode Schedule Scheduler form Modal */}
      {showModeModal && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#E5E1DA] w-[92%] max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            {/* Header - Fixed */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#FFFDF8] shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#2D2926]">
                    {editingModeConfig ? "🔧 編輯特殊期間設定" : "✨ 新建特殊期間規劃"}
                  </h3>
                  <p className="text-[9px] text-gray-400 mt-0.5">預約特殊期間，與對應做作息提示</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form wrapping flexible content & sticky footer */}
            <form onSubmit={handleSaveModeSubmit} className="flex-1 flex flex-col overflow-hidden">
              {/* Content area - scrollable */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs font-sans">
              {/* Type select */}
              <div className="space-y-1">
                <label className="block font-black text-[#3C332D]">1. 選擇特殊期間類別：</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: SystemMode.TRAVEL, label: "✈ 旅遊期間", icon: "✈" },
                    { id: SystemMode.EXAM, label: "📚 考試衝刺", icon: "📚" },
                    { id: SystemMode.VACATION, label: "🏡 寒暑假期", icon: "🏡" },
                    { id: SystemMode.CUSTOM, label: "🎨 其它自訂", icon: "🎨" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => {
                        setModeFormType(opt.id);
                        setModeFormIcon(opt.icon);
                        if (opt.id === SystemMode.TRAVEL) {
                          setModeFormName("峇里島旅行");
                          setModeFormColor("orange");
                        } else if (opt.id === SystemMode.EXAM) {
                          setModeFormName("期中考衝刺");
                          setModeFormColor("purple");
                        } else if (opt.id === SystemMode.VACATION) {
                          setModeFormName("暑假自主學堂");
                          setModeFormColor("emerald");
                        } else {
                          setModeFormName("自訂特殊學期");
                          setModeFormColor("indigo");
                        }
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        modeFormType === opt.id
                          ? "ring-2 ring-indigo-500 bg-indigo-50/20 border-transparent font-extrabold"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-[9px] truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name input */}
              <div className="space-y-1">
                <label className="block font-black text-gray-750">2. 自訂特殊期間名稱：</label>
                <input
                  type="text"
                  required
                  placeholder="例如：日本東京旅行、期末考、暑假規劃..."
                  value={modeFormName}
                  onChange={(e) => setModeFormName(e.target.value)}
                  className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-450 focus:bg-white focus:outline-none text-xs"
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

              {/* Dyn forms content height-capped config */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-205 max-h-[220px] overflow-y-auto space-y-3">
                {/* 1. Travel configs */}
                {modeFormType === SystemMode.TRAVEL && (
                  <div className="space-y-3">
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
                            <label className="text-[10px] text-gray-400">航空公司：</label>
                            <input
                              type="text"
                              value={airLine}
                              onChange={(e) => setAirLine(e.target.value)}
                              placeholder="星宇航空、長榮"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">去程班號：</label>
                            <input
                              type="text"
                              value={flightNumber}
                              onChange={(e) => setFlightNumber(e.target.value)}
                              placeholder="JX721 or BR255"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400">出發起飛時間：</label>
                            <input
                              type="text"
                              value={departureTime}
                              placeholder="09:50"
                              onChange={(e) => setDepartureTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">回降落時間：</label>
                            <input
                              type="text"
                              value={returnTime}
                              placeholder="16:15"
                              onChange={(e) => setReturnTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400">起飛 Terminal：</label>
                            <input
                              type="text"
                              value={departureTerminal}
                              placeholder="T2"
                              onChange={(e) => setDepartureTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">降落 Terminal：</label>
                            <input
                              type="text"
                              value={returnTerminal}
                              placeholder="T1"
                              onChange={(e) => setReturnTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
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
                      <label className="text-[10px] text-gray-400">隨行備註、重要提示：</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="帶泳裝、水杯、防曬、感冒藥..."
                        className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Exam config */}
                {modeFormType === SystemMode.EXAM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-purple-700 border-b pb-1">📚 期考衝刺：各科目複習指標設定</h4>
                    <p className="text-[9px] text-gray-400 leading-normal">
                      為孩子預填考試科目，系統生效期間將自動加乘日常作業與自律表現的星星回饋！
                    </p>
                    <div className="space-y-2">
                      {examSubjects.map((subject, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-1.5 rounded-lg border border-gray-200">
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
                            className="bg-transparent flex-grow text-[11px] p-0.5 border-b border-gray-100 focus:border-purple-300 focus:outline-none font-medium"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <span className="font-extrabold text-[10px] block mb-1">🔍 擴充增設科目：</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSubjectInput}
                          placeholder="例如 社會、生物、體育"
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

                {/* 3. Vacation configs */}
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
                        <option value="阿嬤家寄宿">👵 寄宿特別生活約定</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-bold">2. 約定每日自我生活打卡小任務 ({vacationDailyTasks.length})：</label>
                      <div className="space-y-1 text-gray-650 font-medium">
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

                      <div className="flex gap-2 pt-1">
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

                {/* 4. Custom config */}
                {modeFormType === SystemMode.CUSTOM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-[#3F3D56] border-b pb-1">🎨 其它家庭特殊活動時光</h4>
                    <div className="space-y-2.5">
                      <div className="flex gap-2 items-center">
                        <label className="font-bold w-16 text-gray-500 shrink-0">主題圖示：</label>
                        <select
                          value={modeFormIcon}
                          onChange={(e) => setModeFormIcon(e.target.value)}
                          className="bg-white rounded-lg p-1.5 border border-gray-200 font-sans font-bold"
                        >
                          <option value="🍼">🍼 新生兒育嬰時光</option>
                          <option value="🏕">🏕 戶外野營挑戰</option>
                          <option value="📦">📦 搬家整理包裝</option>
                          <option value="🏃">🏃 體能核心拉練</option>
                          <option value="🧹">🧹 年終大掃除打掃</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-bold">自訂每日作息提示項目：</label>
                        <div className="space-y-1">
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

                        <div className="flex gap-2 pt-1">
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

              </div>

              {/* Fixed Footer */}
              <div className="p-4 border-t border-gray-100 bg-[#FFFDF8] flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModeModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-black bg-[#7C6354] hover:bg-[#5E4E42] text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1"
                >
                  {isUpdating ? "發布生效中..." : editingModeConfig ? "提報儲存修改 ✔" : "確認建立特殊期間 ✈"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mode Schedule Cancel / Delete Confirm popup Modal overlay */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] border border-[#E5E1DA] p-6 max-w-sm w-full shadow-2xl relative font-sans text-xs">
            <h3 className="text-sm font-black text-red-700 flex items-center gap-1.5 pb-2 border-b border-gray-100">
              ⚠️ 撤銷特殊期間規劃確認
            </h3>
            <div className="text-xs text-gray-600 leading-relaxed py-4 space-y-2">
              <p>您確定要提早撤銷 <b>{confirmDeleteName}</b> 此特殊期間規劃嗎？</p>
              <p className="block mt-2.5 text-[#855D46] bg-[#FFFBF7] p-2.5 rounded-xl border border-[#F2ECE4] font-black">
                📢 同步處理解除設定：您希望連同月曆中對應建立的活動行程，一起撤銷刪除嗎？
              </p>
            </div>
            {deleteErrorMessage && (
              <p className="text-red-500 font-bold bg-rose-50 p-2 rounded-lg text-[9px] mb-3">
                錯誤原因：{deleteErrorMessage}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmDeleteMode(true)}
                disabled={isDeleting}
                className="w-full py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition hover:scale-[1.01] cursor-pointer text-center"
              >
                {isDeleting ? "處理中..." : "💥 全部刪除 (連同月曆行程)"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteMode(false)}
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

      {/* 📱 MOBILE MOTHER PORTAL HOME VIEW (block md:hidden) */}
      <div className="block md:hidden space-y-4 pt-1 text-[#3C332D]">
        
        {/* Special Active Period banner (if any) */}
        {activeModeConfig && (() => {
          const remainingDays = Math.round((new Date(activeModeConfig.endDate).getTime() - new Date(todayDateStr).getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const emoji = activeModeConfig.type === SystemMode.TRAVEL ? "✈️"
            : activeModeConfig.type === SystemMode.EXAM ? "📚"
            : activeModeConfig.type === SystemMode.VACATION ? "🏕️" : "✨";
          return (
            <div 
              onClick={() => onChangePage?.("special-periods")}
              className="bg-[#FFF8F6] border border-[#F5D8D0] rounded-xl px-3 py-2 flex items-center justify-between text-xs font-black text-[#6B4B3E] cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span>{emoji}</span>
                <span className="truncate">特別設定：{activeModeConfig.name}</span>
              </span>
              <span className="text-rose-600 shrink-0 font-mono text-[10.5px] font-bold flex items-center gap-1">
                剩餘 {remainingDays} 天 <ChevronRight className="h-3 w-3 stroke-[2.5]" />
              </span>
            </div>
          );
        })()}
        <div className="bg-white border border-[#EFEAE2] rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black flex items-center gap-1">
              <span>📢</span> 家庭公布欄
            </h3>
            <div className="flex items-center gap-1.5">
              {canCreateAnnouncement && (
                <button
                  onClick={() => {
                    setEditingAnnouncement(null);
                    setNewAnnTitle("");
                    setNewAnnContent("");
                    setShowAddAnnModal(true);
                  }}
                  className="text-[10.5px] font-bold text-white bg-rose-500 hover:bg-rose-605 px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer transition-colors"
                >
                  + 新增公告
                </button>
              )}
              <button 
                onClick={() => setShowAllAnnouncements(true)}
                className="text-[10.5px] font-bold text-[#7C6354] bg-[#F5EBE6] px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
              >
                所有公告 <ChevronRight className="h-3 w-3 stroke-[2]" />
              </button>
            </div>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-4 bg-[#FCFBF9] border border-dashed border-[#EFEAE2] rounded-xl">
              <p className="text-[10.5px] text-gray-400 font-bold">目前無公佈事項</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {announcements.slice(0, 3).map((ann) => {
                const dateStr = ann.createdAt?.seconds
                  ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })
                  : "剛剛";
                return (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnnouncement(ann)}
                    className="p-2.5 bg-[#FCFBF9] hover:bg-[#F5EBE6]/30 border border-[#F2ECE0] rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-black bg-[#EAA59E]/10 border border-[#EAA59E]/30 text-rose-700 px-1 py-0.2 rounded-md">
                          {ann.creatorName}
                        </span>
                        <span className="text-[8.5px] font-mono text-gray-400 font-bold">{dateStr}</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#3C332D] truncate mt-1">
                        📢 {ann.title}
                      </h4>
                      <p className="text-[10px] text-gray-450 truncate whitespace-pre-wrap mt-0.5">
                        {ann.content}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ② 今日重點事項 */}
        <div className="bg-white border border-[#EFEAE2] rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black flex items-center gap-1">
              <span>📌</span> 今日重點
            </h3>
            <button 
              onClick={() => {
                if (onNavigateToEvent) {
                  onNavigateToEvent("", todayDateStr);
                } else {
                  onChangePage?.("calendar");
                }
              }}
              className="text-[10.5px] font-bold text-[#7C6354] bg-[#F5EBE6] px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
            >
              查看全部 <ChevronRight className="h-3 w-3 stroke-[2]" />
            </button>
          </div>

          {todayEvents.length === 0 ? (
            <div className="text-center py-4 bg-[#FCFBF9] border border-dashed border-[#EFEAE2] rounded-xl">
              <span className="text-lg">🌞</span>
              <p className="text-[10.5px] text-gray-400 font-bold mt-1">今天暫無行程安排，放鬆一下吧！</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayEvents.slice(0, 3).map((evt) => {
                const isBday = (evt as any).isBirthday;
                return (
                  <div
                    key={evt.id}
                    onClick={() => onNavigateToEvent?.(evt.id, todayDateStr)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isBday 
                        ? "bg-rose-50/50 border-rose-150 hover:bg-rose-50" 
                        : "bg-[#FCFBF9] border-[#F2ECE0] hover:bg-[#F5EBE6]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{isBday ? "🎂" : getEventEmoji(evt.title)}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isBday ? "text-rose-800" : "text-[#3C332D]"}`}>
                          {evt.title}
                        </p>
                        <p className="text-[9.5px] text-gray-400 font-mono mt-0.5 font-bold">
                          {isBday ? "全天生日慶祝" : (evt.time || "全天")}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isBday ? "text-rose-400" : "text-gray-400"}`} />
                  </div>
                );
              })}

              {todayEvents.length > 3 && (
                <div 
                  onClick={() => onChangePage?.("calendar")}
                  className="pt-1.5 text-center"
                >
                  <button className="text-[10.5px] text-sky-600 font-black cursor-pointer hover:underline">
                    還有 {todayEvents.length - 3} 項，點擊查看全部 ➔
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ③ 未來5天行程 */}
        <div className="bg-white border border-[#EFEAE2] rounded-2xl p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black flex items-center gap-1">
              <span>📅</span> 未來 5 天行程
            </h3>
            <span className="text-[9.5px] text-gray-400 font-black tracking-wider uppercase bg-[#F2EDE4] px-1.5 py-0.2 rounded font-sans scale-95">
              五日預覽
            </span>
          </div>

          {/* horizontal calendar weekday selection circles */}
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            {nextSevenDays.slice(0, 5).map((day, idx) => {
              const dStr = day.dateStr;
              const dateObj = new Date(dStr);
              const isSelected = (mobileSelectedDate || todayDateStr) === dStr;
              
              const dayLabel = idx === 0 ? "今天" : idx === 1 ? "明天" : idx === 2 ? "後天" : 
                ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
              const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
              const count = day.events.length;

              return (
                <button
                  key={dStr}
                  onClick={() => setMobileSelectedDate(dStr)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-between transition-all cursor-pointer relative min-h-[58px] ${
                    isSelected 
                      ? "bg-[#7C6354] text-white border border-[#7C6354] shadow-xs" 
                      : "bg-[#FAFAF7] text-gray-650 border border-[#EFEAE2] hover:bg-gray-50"
                  }`}
                >
                  <span className="text-[10px] font-black leading-none">{dayLabel}</span>
                  <span className="text-[9px] font-mono opacity-85 leading-none mt-1">{shortDate}</span>
                  
                  {/* event badge */}
                  {count > 0 ? (
                    <span className={`h-4 min-w-[16px] text-[8.5px] font-black rounded-full flex items-center justify-center font-mono mt-1 px-1 scale-95 ${
                      isSelected ? "bg-white text-[#7C6354]" : "bg-rose-500 text-white"
                    }`}>
                      {count}
                    </span>
                  ) : (
                    <span className="text-[8px] font-normal opacity-40 font-mono mt-1 select-none">0</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* detailed listings below for selected day */}
          <div className="border-t border-[#F5F2EB] pt-2.5">
            {(() => {
              const activeDStr = mobileSelectedDate || todayDateStr;
              const dayData = nextSevenDays.slice(0, 5).find(day => day.dateStr === activeDStr);
              const selectedDayEvents = dayData ? dayData.events : [];

              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold px-0.5">
                    <span>📋 當日安排行程 ({selectedDayEvents.length})</span>
                    <span className="font-mono text-[9px]">日期：{activeDStr}</span>
                  </div>

                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-4 bg-[#FCFBF9] border border-dashed border-[#EFEAE2] rounded-xl">
                      <p className="text-[10.5px] text-gray-400 font-medium">✨ 此日暫無安排行程</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedDayEvents.slice(0, 3).map(evt => (
                        <div
                          key={evt.id}
                          onClick={() => onNavigateToEvent?.(evt.id, activeDStr)}
                          className="p-2.5 bg-[#FAF9F6] hover:bg-[#F5EBE6]/30 border border-[#EFEAE2] rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{getEventEmoji(evt.title)}</span>
                            <span className="text-xs font-semibold text-[#3C332D] truncate">{evt.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-gray-400">
                            <span className="text-[9.5px] font-mono leading-none font-bold">{evt.time || "全天"}</span>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => onChangePage?.("calendar")}
            className="w-full py-2 bg-[#FAFAF7] hover:bg-[#F2ECE0] text-[#7C6354] border border-[#EFEAE2] rounded-xl text-[10.5px] font-black text-center transition cursor-pointer flex items-center justify-center gap-1"
          >
            觀看完整家庭行事曆 <ChevronRight className="h-3 w-3 stroke-[2]" />
          </button>
        </div>

        {/* ④ 小孩星星與禮物進度 */}
        <div className="bg-white border border-[#EFEAE2] rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between pb-1 boundary font-sans">
            <h3 className="text-xs font-black flex items-center gap-1">
              <span>⭐</span> 小孩星星與禮物進度
            </h3>
            <button
              onClick={() => onChangePage?.("rewards")}
              className="text-[10.5px] font-bold text-[#7C6354] bg-[#F5EBE6] px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
            >
              前往禮物中心 <ChevronRight className="h-3 w-3 stroke-[2]" />
            </button>
          </div>

          {/* Kids Accumulated Stars Area */}
          {(() => {
            const kidsList = familyMembers.filter(m => m.role === UserRole.KID);
            if (kidsList.length === 0 && currentUser?.role === UserRole.KID) {
              kidsList.push(currentUser);
            }
            if (kidsList.length === 0) {
              return (
                <div className="bg-[#FFFDF9] border border-[#F5EBE6] rounded-xl p-2.5 text-center text-[10px] text-gray-455 font-bold">
                  目前暫無設定小孩成員帳號喔
                </div>
              );
            }
            return (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x flex-nowrap w-full">
                {kidsList.map((kid) => {
                  const avatarTxt = kid.displayName ? kid.displayName.charAt(0) : "✿";
                  const bgCol = kid.color || "#F5EBE6";
                  
                  // Calculate dynamic parent pending deduction cost
                  const kidPendingCost = (redemptions || [])
                    .filter(r => r.childUid === kid.uid && r.status === "pending")
                    .reduce((sum, item) => sum + (item.starsRequired || 0), 0);
                  const availableStars = Math.max(0, (kid.stars || 0) - kidPendingCost);

                  return (
                    <div
                      key={kid.uid}
                      className="snap-start shrink-0 w-[145px] bg-[#FCFBF9] border border-[#EFEAE2] rounded-xl p-2 flex flex-col justify-between h-[96px] select-none shadow-3xs font-sans"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Avatar */}
                        <div
                          style={{ backgroundColor: bgCol }}
                          className="h-7 w-7 rounded-full border border-gray-100 flex items-center justify-center text-[10.5px] font-black text-gray-700 relative shrink-0"
                        >
                          {kid.gender === "female" ? "👧" : "👦"}
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                          <h4 className="font-black text-[10.5px] text-[#3C332D] truncate">
                            {kid.displayName}
                          </h4>
                          <span className="text-[7.5px] text-gray-400 font-bold font-sans">目前星星</span>
                        </div>
                      </div>

                      <div className="border-t border-[#F5F2EB] pt-1 mt-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[9px] text-[#7C6354] font-black leading-none">
                          <span>目前星星：</span>
                          <span className="font-mono text-amber-500 font-black">{kid.stars || 0} 顆</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold leading-none">
                          <span>可用餘額：</span>
                          <span className="font-mono text-[#5C6E58] font-bold">{availableStars} 顆</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Horizontal scroll rewards progress */}
          {(() => {
            const availableGifts = (rewards || []).filter(r => r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.APPROVED);
            const kidsOfFamily = familyMembers.filter(m => m.role === UserRole.KID);
            const primaryKid = kidsOfFamily[0] || currentUser;
            const currentKidStars = primaryKid?.stars || 0;

            if (availableGifts.length === 0) {
              return (
                <div className="text-center py-4 bg-[#FCFBF9] border border-dashed border-[#EFEAE2] rounded-xl">
                  <p className="text-[10.5px] text-gray-400 font-bold">目前暫無上架中的願望禮物喔</p>
                </div>
              );
            }

            return (
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none snap-x flex-nowrap">
                {availableGifts.map((gift) => {
                  const pct = Math.min(100, Math.round((currentKidStars / gift.starsCost) * 100));
                  const diff = Math.max(0, gift.starsCost - currentKidStars);

                  return (
                    <div
                      key={gift.id}
                      onClick={() => setSelectedReward(gift)}
                      className="snap-start shrink-0 w-[210px] bg-[#FCFBF9] hover:bg-[#F2ECE0]/20 border border-[#EFEAE2] rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition-transform relative select-none"
                    >
                      {/* Left: 55x55 compact image block */}
                      <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 flex items-center justify-center text-xl shrink-0">
                        {gift.imageUrl ? (
                          <img src={gift.imageUrl} alt={gift.title} className="h-full w-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                        ) : "🎁"}
                      </div>

                      {/* Right details */}
                      <div className="min-w-0 flex-1 flex flex-col justify-between h-[44px]">
                        <p className="text-[11px] font-black text-[#3C332D] truncate leading-tight pr-3">
                          {gift.title}
                        </p>
                        
                        {/* bottom progress indicator */}
                        <div className="space-y-0.5 font-sans">
                          <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="text-gray-400 font-mono scale-95 origin-left">
                              {currentKidStars} / {gift.starsCost} ⭐️
                            </span>
                            <span className={diff === 0 ? "text-emerald-600 font-black" : "text-rose-500 font-black"}>
                              {diff === 0 ? "可兌換" : `差${diff}`}
                            </span>
                          </div>
                          <div className="w-full bg-gray-150 rounded-full h-1 relative overflow-hidden">
                            <div className={`h-full rounded-full ${diff === 0 ? "bg-emerald-500" : "bg-rose-450"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="h-3 w-3 text-gray-400 absolute right-1.5 top-3.5" />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ⑤ 快速功能排定入口 */}
        <div className="bg-white border border-[#EFEAE2] rounded-2xl p-3.5 space-y-2 shadow-xs">
          <div className="border-b border-rose-50/20 pb-1 flex items-center justify-between">
            <h3 className="text-xs font-black flex items-center gap-1 text-gray-650">
              ⚡ 快速功能入口
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (onNavigateToEvent) {
                  onNavigateToEvent("", todayDateStr);
                } else {
                  onChangePage?.("calendar");
                }
              }}
              className="p-2.5 bg-[#FDFBF7] hover:bg-[#F7F3EB]/60 border border-[#EFEAE2] rounded-xl flex items-center gap-2 cursor-pointer transition text-left"
            >
              <div className="h-7 w-7 bg-[#FFF2F0] rounded-lg flex items-center justify-center text-sm">📅</div>
              <div>
                <p className="text-[11px] font-bold text-[#3C332D]">一鍵日曆</p>
                <p className="text-[8.5px] text-gray-400 font-bold">今日行程直達</p>
              </div>
            </button>

            <button
              onClick={() => onChangePage?.("special-periods")}
              className="p-2.5 bg-[#FDFBF7] hover:bg-[#F7F3EB]/60 border border-[#EFEAE2] rounded-xl flex items-center gap-2 cursor-pointer transition text-left"
            >
              <div className="h-7 w-7 bg-[#EDF8FF] rounded-lg flex items-center justify-center text-sm">🏔️</div>
              <div>
                <p className="text-[11px] font-bold text-[#3C332D]">特別計畫</p>
                <p className="text-[8.5px] text-gray-400 font-bold">寒暑假與大假</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 🔮 1. ANNOUNCEMENT DETAILS POPUP MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-5 w-full max-w-sm shadow-2xl relative space-y-4 font-sans text-xs">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute right-3.5 top-3.5 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-full select-none">
                📢 官方公告
              </span>
              <p className="text-[9.5px] text-gray-400 font-mono mt-1 font-bold">
                發布時間：
                {selectedAnnouncement.createdAt?.seconds
                  ? new Date(selectedAnnouncement.createdAt.seconds * 1000).toLocaleString("zh-TW")
                  : "剛剛"}
              </p>
            </div>

            <div className="space-y-2 border-b border-[#F7F3EB] pb-3">
              <h3 className="text-sm font-black text-[#3C332D] leading-tight">
                📌 {selectedAnnouncement.title}
              </h3>
              <p className="text-xs text-gray-650 leading-relaxed font-semibold whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </p>
            </div>

            <div className="flex justify-between items-center text-[10.5px] text-gray-400 font-bold">
              <span>發布人: {selectedAnnouncement.creatorName}</span>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-1.5 bg-[#7C6354] hover:bg-[#685245] text-white font-extrabold rounded-lg cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏡 1b. ANNOUNCEMENT DELETE CONFIRMED POPUP OVERLAY */}
      {showDeleteAnnConfirm && announcementToDelete && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 w-full max-w-sm shadow-2xl relative space-y-4 font-sans text-xs">
            {/* Modal Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F2EB]">
              <div className="p-2 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl text-lg shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-600">
                  確定要刪除公告嗎？
                </h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  刪除後，所有成員將無法看到此公告內容。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAnnConfirm(false);
                  setAnnouncementToDelete(null);
                  setDeleteAnnError(null);
                }}
                className="absolute right-4 top-4 p-1 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                disabled={isDeletingAnn}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Card Body */}
            <div className="p-3 bg-[#FAF8F5] border border-[#EFEAE2] rounded-xl text-left space-y-1">
              <span className="text-[9px] font-black bg-[#EAA59E] text-white px-1.5 py-0.5 rounded">
                {announcementToDelete.creatorName}
              </span>
              <h4 className="font-extrabold text-[#3C332D] text-xs pt-1 truncate justify-start flex items-center gap-1">
                📌 {announcementToDelete.title}
              </h4>
              <p className="text-[11px] text-gray-600 font-bold line-clamp-3">
                {announcementToDelete.content}
              </p>
            </div>

            {/* Error Message Box */}
            {deleteAnnError && (
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-700 font-extrabold whitespace-pre-wrap leading-relaxed select-text text-[11px]">
                {deleteAnnError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#F5F2EB] flex justify-end gap-2 text-xs font-black shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAnnConfirm(false);
                  setAnnouncementToDelete(null);
                  setDeleteAnnError(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl cursor-pointer transition"
                disabled={isDeletingAnn}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAnnouncement}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
                disabled={isDeletingAnn}
              >
                {isDeletingAnn ? (
                  <>
                    <div className="animate-spin text-white h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>處理中...</span>
                  </>
                ) : (
                  <span>確認刪除</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔮 2. ALL ANNOUNCEMENTS MANAGER POPUP MODAL */}
      {showAllAnnouncements && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-5 w-full max-w-sm shadow-2xl relative space-y-4 font-sans text-xs flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[#F5F2EB] pb-3 shrink-0">
              <h3 className="text-xs font-black text-[#3C332D] tracking-wide flex items-center gap-1.5">
                📢 所有公告記錄 ({announcements.length})
              </h3>
              <button
                onClick={() => setShowAllAnnouncements(false)}
                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 py-1">
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-bold">
                  目前尚無任何家庭公告記錄。
                </div>
              ) : (
                announcements.map((ann) => {
                  const dateStr = ann.createdAt?.seconds
                    ? new Date(ann.createdAt.seconds * 1000).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "剛剛";

                  return (
                    <div
                      key={ann.id}
                      className="p-3 bg-[#FCFBF9] border border-[#EFEAE2] rounded-xl relative space-y-1"
                    >
                      {canEditAnnouncement(ann) && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 z-10">
                          <button
                            onClick={() => {
                              setEditingAnnouncement(ann);
                              setNewAnnTitle(ann.title);
                              setNewAnnContent(ann.content);
                              setShowAllAnnouncements(false);
                              setShowAddAnnModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-[#7C6354] hover:bg-gray-100 rounded-lg cursor-pointer transition"
                            title="修改公告"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setAnnouncementToDelete(ann);
                              setDeleteAnnError(null);
                              setShowDeleteAnnConfirm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-500 hover:bg-[#FEF2F2] rounded-lg cursor-pointer transition"
                            title="刪除公告"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black bg-[#EAA59E] text-white px-1.5 py-0.2 rounded">
                          {ann.creatorName}
                        </span>
                        <span className="text-[8.5px] font-mono text-gray-400">{dateStr}</span>
                      </div>

                      <h4 className="font-extrabold text-[#3C332D] text-xs pt-1">
                        📌 {ann.title}
                      </h4>
                      <p className="text-[11px] text-gray-650 leading-relaxed font-medium whitespace-pre-wrap">
                        {ann.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#F5F2EB] flex justify-end shrink-0">
              <button
                onClick={() => setShowAllAnnouncements(false)}
                className="px-4 py-2 bg-[#7C6354] hover:bg-[#685245] text-white font-extrabold rounded-xl cursor-pointer"
              >
                關閉列表
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔮 2b. ADD / EDIT ANNOUNCEMENT POPUP FORM MODAL */}
      {showAddAnnModal && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-250">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 w-full max-w-sm shadow-2xl relative space-y-4 font-sans text-xs">
            {/* Modal Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F2EB]">
              <div className="p-2 bg-[#FAF8F5] border border-[#EFEAE2] rounded-xl text-lg">
                📢
              </div>
              <div>
                <h3 className="text-sm font-black text-[#3C332D]">
                  {editingAnnouncement ? "🔧 編輯公告設定" : "✨ 發佈全新家庭公告"}
                </h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  {editingAnnouncement ? "修改目前已發佈的公告內容" : "向所有家庭成員發布重要公告通知"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewAnnTitle("");
                  setNewAnnContent("");
                  setEditingAnnouncement(null);
                  setShowAddAnnModal(false);
                }}
                className="absolute right-4 top-4 p-1 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Input Form */}
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-gray-500 block">
                  公告標題： <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="例如：今日客廳大掃除、週末家族露營"
                  className="w-full bg-[#FAF8F5] border border-[#EFEAE2] placeholder-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-450 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-gray-500 block">
                  公告詳細內容：
                </label>
                <textarea
                  rows={4}
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  placeholder="請在此輸入公告的詳細內容與注意事項..."
                  className="w-full bg-[#FAF8F5] border border-[#EFEAE2] placeholder-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-450 focus:bg-white transition resize-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#F5F2EB] flex justify-end gap-2 text-xs font-black">
                <button
                  type="button"
                  onClick={() => {
                    setNewAnnTitle("");
                    setNewAnnContent("");
                    setEditingAnnouncement(null);
                    setShowAddAnnModal(false);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl cursor-pointer transition"
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C6354] hover:bg-[#685245] text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin text-white h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      <span>正在發布中...</span>
                    </>
                  ) : (
                    <span>{editingAnnouncement ? "確認修改" : "發佈公告"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔮 3. REWARD DETAIL POPUP MODAL */}
      {selectedReward && (() => {
        const kidsOfFamily = familyMembers.filter(m => m.role === UserRole.KID);
        const primaryKid = kidsOfFamily[0] || currentUser;
        const currentKidStars = primaryKid?.stars || 0;
        const pct = Math.min(100, Math.round((currentKidStars / selectedReward.starsCost) * 100));
        const diff = Math.max(0, selectedReward.starsCost - currentKidStars);

        return (
          <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-5 w-full max-w-sm shadow-2xl relative space-y-4 font-sans text-xs">
              <button
                onClick={() => setSelectedReward(null)}
                className="absolute right-3.5 top-3.5 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-[#F7F3EB] pb-3 mb-1">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 flex items-center justify-center text-3xl">
                  {selectedReward.imageUrl ? (
                    <img src={selectedReward.imageUrl} alt={selectedReward.title} className="h-full w-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                  ) : "🎁"}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#3C332D] leading-tight pr-5">
                    {selectedReward.title}
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">
                    建立者: {selectedReward.creatorName || "全家管理員"}
                  </p>
                </div>
              </div>

              {/* description */}
              {selectedReward.description && (
                <div className="space-y-1 bg-[#FAFAF8] border border-[#EFEAE2] p-2.5 rounded-xl">
                  <span className="text-[9px] font-black text-[#7C6354] uppercase tracking-wider block">大禮說明 ☕：</span>
                  <p className="text-[11px] text-gray-650 leading-relaxed font-semibold">
                    {selectedReward.description}
                  </p>
                </div>
              )}

              {/* parent custom note */}
              {selectedReward.note && (
                <div className="space-y-1 bg-amber-50/40 border-l-2 border-amber-400/80 p-2 text-[10px] rounded-r-lg font-bold">
                  <span className="text-amber-800 block text-[9px] uppercase font-black">爸媽備註 / 悄悄話：</span>
                  <p className="italic font-semibold text-gray-650">{selectedReward.note}</p>
                </div>
              )}

              {/* progress details */}
              <div className="space-y-2 pt-1 font-sans">
                <div className="flex justify-between items-center text-[10.5px] font-black text-[#3C332D]">
                  <span className="bg-[#FFF8E8] border border-[#F4E2A8] px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                    需要: {selectedReward.starsCost} 星
                  </span>
                  <span>
                    {diff === 0 ? (
                      <span className="text-emerald-600">🎉 小龜已達標可兌換！</span>
                    ) : (
                      <span className="text-gray-430">進度: {pct}% | 還差 <span className="text-rose-500">{diff}</span> 顆星</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-150 rounded-full h-1.5 relative overflow-hidden">
                  <div className={`h-full rounded-full ${diff === 0 ? "bg-emerald-500" : "bg-rose-450"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center gap-2">
                <span className="text-[8.5px] text-gray-400 font-bold">
                  點數詳情請前往「禮物願望中心」查看
                </span>
                
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedReward(null);
                      onChangePage?.("rewards");
                    }}
                    className="px-3.5 py-1.5 text-[10.5px] text-[#7C6354] bg-[#F5EBE6] hover:bg-[#E7DCD5] font-black rounded-xl transition"
                  >
                    前往禮物中心
                  </button>
                  <button
                    onClick={() => setSelectedReward(null)}
                    className="px-3.5 py-1.5 text-[10.5px] bg-[#7C6354] hover:bg-[#685245] text-white font-black rounded-xl transition"
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
