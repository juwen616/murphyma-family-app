import React, { useState, useMemo, useEffect } from "react";
import { UserProfile, UserRole, SystemMode, Task, Redemption, ConfiguredMode, getLocalToday } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, setDoc, doc, deleteDoc, updateDoc, getDoc, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";
import { 
  Users, BadgeInfo, Settings2, Trash2, Edit3, Plus, X, Calendar, Sparkles, 
  Copy, Check, ClipboardList, Plane, BookOpen, Sun, HelpCircle, ChevronDown, 
  ChevronUp, AlertCircle, Sparkle, Trophy, Palette, CheckCircle2, Car, Train 
} from "lucide-react";

interface MembersCenterProps {
  currentUser: UserProfile;
  familyMembers: UserProfile[];
  systemMode: SystemMode;
  familyId: string;
  familyName: string;
  tasks?: Task[];
  redemptions?: Redemption[];
  onUpdateSystemMode: (mode: SystemMode) => Promise<void>;
  onAddMember?: (memberData: {
    displayName: string;
    role: UserRole;
    birthday?: string;
    color?: string;
    photoURL?: string;
    showAgeInCalendar?: boolean;
  }) => Promise<string | void>;
  onEditMember?: (
    uid: string,
    updatedData: {
      displayName: string;
      role: UserRole;
      birthday?: string;
      color?: string;
      photoURL?: string;
      showAgeInCalendar?: boolean;
    }
  ) => Promise<void>;
  onDeleteMember?: (uid: string) => Promise<void>;
  configuredModes?: ConfiguredMode[];
  onSaveConfiguredMode?: (modeConfig: ConfiguredMode) => Promise<void>;
  onDeleteConfiguredMode?: (modeId: string, deleteRelatedEvents?: boolean) => Promise<void>;
  simulatedTodayDate?: string;
  onSetSimulatedTodayDate?: (date: string) => void;
  pendingRequests?: any[];
  onApproveJoinRequest?: (req: any) => Promise<void>;
  onRejectJoinRequest?: (req: any) => Promise<void>;
  onBindGoogle?: (memberUid: string) => Promise<void>;
}

const MORANDI_COLORS = [
  { value: "#D2C4B8", name: "奶茶色" },
  { value: "#A7BBC7", name: "霧藍色" },
  { value: "#B4C3B2", name: "鼠尾草綠" },
  { value: "#E1B8B8", name: "淡粉色" },
  { value: "#D1C3D6", name: "淡紫色" },
  { value: "#EED7C5", name: "米杏色" },
];

const JAPANESE_SYMBOLS = [
  { value: "♡", name: "愛心" },
  { value: "✿", name: "小花" },
  { value: "⭐", name: "星星" },
  { value: "☀", name: "太陽" },
  { value: "☁", name: "雲朵" },
  { value: "🌙", name: "月亮" },
  { value: "🍀", name: "幸運草" },
  { value: "🐶", name: "萌犬" },
  { value: "🐱", name: "小貓" },
  { value: "🐰", name: "兔子" },
  { value: "🧸", name: "泰迪熊" },
  { value: "🏠", name: "溫馨家" },
  { value: "☕", name: "咖啡" },
  { value: "🎈", name: "氣球" },
];

export default function MembersCenter({
  currentUser,
  familyMembers,
  systemMode,
  familyId,
  familyName,
  tasks = [],
  redemptions = [],
  onUpdateSystemMode,
  onAddMember,
  onEditMember,
  onDeleteMember,
  configuredModes = [],
  onSaveConfiguredMode,
  onDeleteConfiguredMode,
  simulatedTodayDate = getLocalToday(),
  onSetSimulatedTodayDate,
  pendingRequests = [],
  onApproveJoinRequest,
  onRejectJoinRequest,
  onBindGoogle,
}: MembersCenterProps) {
  const [activeMode, setActiveMode] = useState<SystemMode>(systemMode);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvancedInfo, setShowAdvancedInfo] = useState(false);

  const isOwnerRole = (mRole: string) => {
    const norm = (mRole || "").toLowerCase();
    return norm === "owner" || norm === "admin" || norm === "superadmin" || mRole === UserRole.ADMIN || mRole === UserRole.OWNER;
  };

  const getRoleChineseName = (r: any) => {
    if (r === "Owner" || r === "Admin" || r === UserRole.ADMIN) return "管理員";
    if (r === "Parent" || r === UserRole.PARENT) return "家長";
    if (r === "Child" || r === "Kid" || r === "KID" || r === UserRole.KID) return "小孩";
    return "一般唯讀成員";
  };

  const formatTime = (ts: any) => {
    if (!ts) return "—";
    if (typeof ts === "string") return ts.split("T")[0];
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString("zh-TW");
    if (ts.toDate) return ts.toDate().toLocaleDateString("zh-TW");
    return "—";
  };

  // Custom Confirmation Dialog States
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Sub-tabs for Owner views
  const [memberSubTab, setMemberSubTab] = useState<"list" | "invites">("list");
  const [autoCreateInvite, setAutoCreateInvite] = useState(true);
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [targetInviteRole, setTargetInviteRole] = useState<"Owner" | "Parent" | "Child" | "Viewer">("Parent");
  const [inviteEmailConstraint, setInviteEmailConstraint] = useState("");
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [editingInvite, setEditingInvite] = useState<any | null>(null);
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    isOpen: boolean;
    memberName: string;
    role: string;
    inviteCode: string;
    email: string;
  } | null>(null);

  // Listen to family invitation codes from firestore
  useEffect(() => {
    if (!familyId) return;
    setLoadingInvites(true);
    const q = query(collection(db, "invites"), where("familyId", "==", familyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInvites(list);
      setLoadingInvites(false);
    }, (error) => {
      console.error("Error loading invites:", error);
      setLoadingInvites(false);
    });
    return () => unsubscribe();
  }, [familyId]);

  const generateInviteCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId) return;
    setSubmittingInvite(true);
    try {
      const inviteCode = generateInviteCode();
      const inviteId = `invite_${Math.random().toString(36).substr(2, 9)}`;
      const inviteData = {
        id: inviteId,
        familyId,
        familyName,
        inviterUid: currentUser.uid,
        status: "pending",
        targetRole: targetInviteRole,
        role: targetInviteRole,
        inviteCode,
        email: inviteEmailConstraint.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.displayName || currentUser.email || "Owner",
        memberName: "一般受邀者"
      };
      
      const docRef = doc(db, "families", familyId, "invites", inviteCode);
      console.log("Create Invite Data", inviteData);
      
      await setDoc(docRef, inviteData);
      await setDoc(doc(db, "invites", inviteId), inviteData);

      console.log(
        "Invite Created Path",
        docRef.path
      );
      console.log(
        "Invite Created Data",
        inviteData
      );

      // Verify the write immediately
      const verifyDoc = await getDoc(docRef);
      console.log(
        "Invite Verify Exists",
        verifyDoc.exists()
      );
      console.log(
        "Invite Verify Data",
        verifyDoc.data()
      );
      console.log(
        "Invite Verify Path",
        docRef.path
      );

      if (!verifyDoc.exists()) {
        throw new Error("Firebase contains no record at Path: " + docRef.path);
      }

      // Read back all invites of this family
      const snapshot = await getDocs(
        collection(
          db,
          "families",
          familyId,
          "invites"
        )
      );

      console.log(
        "Invites After Create",
        snapshot.docs.length
      );
      console.log(
        snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
      
      // Auto-log audit record
      const auditId = `aud_${Date.now()}_invite`;
      await setDoc(doc(db, "audit_logs", auditId), {
        id: auditId,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || "Owner",
        familyId,
        action: `生成 ${targetInviteRole} 的專屬邀請碼`,
        targetId: inviteId,
        targetName: `邀請碼 ${inviteCode}`,
        createdAt: new Date().toISOString()
      });

      toast.success(`🎉 成功生成 ${targetInviteRole} 專屬邀請碼：${inviteCode}`);
      setInviteEmailConstraint("");
    } catch (err: any) {
      console.error("Invite creation failed:", err);
      toast.error("❌ 生成邀請失敗：" + err.message);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string, code: string) => {
    showConfirm(
      "確定刪除此邀請？",
      `確定刪除此邀請碼「${code}」？刪除後邀請碼將永久失效。`,
      async () => {
        try {
          await deleteDoc(doc(db, "invites", inviteId));
          toast.success("✓ 已刪除該邀請代碼");
        } catch (err: any) {
          toast.error("❌ 刪除失敗：" + err.message);
        }
      }
    );
  };

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

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [viewingRecordMember, setViewingRecordMember] = useState<UserProfile | null>(null);

  // Form inputs
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.KID);
  const [birthday, setBirthday] = useState("2020-10-10");
  const [color, setColor] = useState("#B4C3B2");
  const [photoURL, setPhotoURL] = useState("✿");
  const [showAgeInCalendar, setShowAgeInCalendar] = useState(true);
  const [gender, setGender] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Deletion Confirm Modal states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;

  // Prepopulate standard options for Mom 3 seconds additions
  const handleOpenAddMode = () => {
    setEditingModeConfig(null);
    setModeFormType(SystemMode.TRAVEL);
    setModeFormName("峇里島旅行");
    setModeFormStartDate("2026-07-18");
    setModeFormEndDate("2026-07-25");
    setModeFormIcon("✈");
    setModeFormColor("orange");

    // Travel
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

    // Exam
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

    // Vacation
    setVacationType("暑假");
    setVacationDailyTasks([
      { id: "1", text: "閱讀30分鐘" },
      { id: "2", text: "練鋼琴" },
      { id: "3", text: "寫作業" },
      { id: "4", text: "游泳課" },
      { id: "5", text: "畫畫課" },
    ]);

    // Custom
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
        // Pre-populate standard beautiful Bali travel templates
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
              todayTheme: "親子樂園日",
              todayRemarks: "14:00 SPA預約\n17:30 看夕陽\n晚上可能下雨，記得帶防蚊液與雨具",
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

  const handleModeChange = async (mode: SystemMode) => {
    if (isUpdating || !isParent) return;
    setIsUpdating(true);
    setActiveMode(mode);
    try {
      await onUpdateSystemMode(mode);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleName = (userRole: UserRole) => {
    switch (userRole) {
      case UserRole.ADMIN:
        return "管理員";
      case UserRole.PARENT:
        return "家長";
      case UserRole.KID:
        return "小孩";
      case UserRole.MEMBER:
        return "家庭成員";
      case UserRole.PET:
        return "寵物";
      default:
        return "家庭成員";
    }
  };

  const modeDescriptions = {
    [SystemMode.DAILY]: "日常模式：一般的家庭日常生活。進行常規任務與家庭行事曆紀錄。",
    [SystemMode.TRAVEL]: "旅遊模式：全家出遊任務、旅遊驚喜星星、兌換特殊旅遊獎勵！",
    [SystemMode.EXAM]: "考前模式：學習/考試大作戰！所有任務星星獲得直接【加倍 2x】！規劃專屬考前衝刺目標！",
    [SystemMode.VACATION]: "寒暑假模式：長假自主管理！假期特別任務與豐富的寒暑假精選大獎上架！",
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(familyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAdd = () => {
    setEditingMember(null);
    setEditingInvite(null);
    setDisplayName("");
    setRole(UserRole.KID);
    setBirthday("");
    setColor("#B4C3B2");
    setPhotoURL("✿");
    setAutoCreateInvite(true);
    setInviteEmailConstraint("");
    setShowAgeInCalendar(true);
    setGender("");
    setShowFormModal(true);
  };

  const handleOpenEdit = (member: UserProfile) => {
    setEditingMember(member);
    setDisplayName(member.displayName);
    setRole(member.role);
    setBirthday(member.birthday || "");
    setColor(member.color || "#B4C3B2");
    setPhotoURL(member.photoURL || "✿");
    setShowAgeInCalendar(member.showAgeInCalendar !== false);
    setGender(member.gender || "");
    setShowFormModal(true);
  };

  const handleOpenRecords = (member: UserProfile) => {
    setViewingRecordMember(member);
  };

  // Filter approved tasks for the member
  const memberApprovedTasks = useMemo(() => {
    if (!viewingRecordMember) return [];
    return tasks.filter(
      (t) =>
        t.status === "approved" &&
        (t.assignedTo === viewingRecordMember.uid || (t as any).submitterUid === viewingRecordMember.uid)
    );
  }, [tasks, viewingRecordMember]);

  // Filter redemptions for the member
  const memberApprovedRedemptions = useMemo(() => {
    if (!viewingRecordMember) return [];
    return redemptions.filter(
      (r) =>
        r.childUid === viewingRecordMember.uid &&
        (r.status === "approved" || r.status === "pending")
    );
  }, [redemptions, viewingRecordMember]);

  const generateInvitationMsg = (member: {
    memberName: string;
    targetRole: string;
    inviteCode: string;
    email?: string;
  }) => {
    const roleLabel = getRoleChineseName(member.targetRole);
    const emailStr = (member.email && member.email.trim()) ? member.email.trim() : "";
    
    return `歡迎加入「${familyName}」🏠

您的家庭身份：
${member.memberName}（${roleLabel}）

家庭代碼：
${familyId}

邀請代碼：
${member.inviteCode}

系統網址：
https://murphyma-family-app.vercel.app/

登入方式：

如果有綁定 Gmail：

請使用下列 Gmail 登入：

${emailStr || "（無綁定 Gmail）"}

登入後系統會自動驗證邀請資格。

如果沒有綁定 Gmail：

請於登入頁輸入：

家庭代碼
邀請代碼

即可登入。

此邀請碼同時也是未來登入代碼。

請妥善保存。

❤️ 歡迎加入家庭`;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSubmittingForm(true);
    try {
      if (editingInvite) {
        // Update both top-level and families subcollection
        const updatedInviteData = {
          memberName: displayName.trim(),
          name: displayName.trim(),
          targetRole: role,
          role: role,
          email: inviteEmailConstraint.trim().toLowerCase(),
          birthday: birthday || null,
          showAge: showAgeInCalendar ?? true,
          avatar: photoURL || "",
          gender: gender || ""
        };

        await updateDoc(doc(db, "invites", editingInvite.id), updatedInviteData);

        const nestInviteRef = doc(db, "families", familyId, "invites", editingInvite.inviteCode);
        await updateDoc(nestInviteRef, updatedInviteData);

        // Audit trace
        const auditId = `aud_${Date.now()}_invite_update`;
        await setDoc(doc(db, "audit_logs", auditId), {
          id: auditId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || "Owner",
          familyId,
          action: `修改受邀成員「${displayName.trim()}」的邀請條件與設定`,
          targetId: editingInvite.id,
          targetName: `邀請碼 ${editingInvite.inviteCode}`,
          createdAt: new Date().toISOString()
        });

        toast.success(`✓ 邀請設定已成功同步更新！`);
        setShowFormModal(false);
        setEditingInvite(null);
        setInviteEmailConstraint("");
        setDisplayName("");
        setGender("");
      } else if (editingMember) {
        if (onEditMember) {
          await onEditMember(editingMember.uid, {
            displayName: displayName.trim(),
            role,
            birthday,
            color,
            photoURL,
            showAgeInCalendar,
            gender,
          } as any);
        }
        setShowFormModal(false);
      } else {
        // Create only an invitation code in database, do NOT call onAddMember
        const inviteCode = generateInviteCode();
        const inviteId = `invite_${Math.random().toString(36).substr(2, 9)}`;

        const newInvite = {
          id: inviteId,
          familyId,
          familyName,
          inviterUid: currentUser.uid,
          status: "pending",
          targetRole: role,
          role,
          inviteCode,
          email: inviteEmailConstraint.trim().toLowerCase(),
          createdAt: new Date().toISOString(),
          createdBy: currentUser.displayName || currentUser.email || "Owner",
          memberName: displayName.trim(),
          name: displayName.trim(),
          birthday: birthday || null,
          showAge: showAgeInCalendar ?? true,
          avatar: photoURL || "",
          gender: gender || ""
        };

        const docRef = doc(db, "families", familyId, "invites", inviteCode);
        console.log("Create Invite Data", newInvite);

        await setDoc(doc(db, "invites", inviteId), newInvite);
        await setDoc(docRef, newInvite);

        console.log(
          "Invite Created Path",
          docRef.path
        );
        console.log(
          "Invite Created Data",
          newInvite
        );

        // Verify the write immediately
        const verifyDoc = await getDoc(docRef);
        console.log(
          "Invite Verify Exists",
          verifyDoc.exists()
        );
        console.log(
          "Invite Verify Data",
          verifyDoc.data()
        );
        console.log(
          "Invite Verify Path",
          docRef.path
        );

        if (!verifyDoc.exists()) {
          throw new Error("邀請資料未能成功寫入 Firebase，驗證失敗！ 路徑：" + docRef.path);
        }

        // Read and list all invites under families/{familyId}/invites
        const snapshot = await getDocs(
          collection(
            db,
            "families",
            familyId,
            "invites"
          )
        );

        console.log(
          "Invites After Create",
          snapshot.docs.length
        );
        console.log(
          snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        // Create audit trace
        const auditId = `aud_${Date.now()}_invite_manual`;
        await setDoc(doc(db, "audit_logs", auditId), {
          id: auditId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || "Owner",
          familyId,
          action: `新增成員「${displayName.trim()}」並產生專屬邀請碼`,
          targetId: inviteId,
          targetName: `邀請碼 ${inviteCode}`,
          createdAt: new Date().toISOString()
        });

        // Trigger Success Dialog
        setInviteSuccessData({
          isOpen: true,
          memberName: displayName.trim(),
          role: role,
          inviteCode: inviteCode,
          email: inviteEmailConstraint.trim().toLowerCase(),
        });

        toast.success(`🎉 邀請建立成功！`);
        setShowFormModal(false);
        setInviteEmailConstraint("");
        setDisplayName("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("❌ 建立邀請失敗：" + err.message);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDeleteMember = async (memberUid: string, name: string) => {
    if (!onDeleteMember) return;
    showConfirm(
      "從家庭中移除成員",
      `確認要從家庭中移除「${name}」嗎？這將會同步清除其關聯資料。`,
      async () => {
        try {
          await onDeleteMember(memberUid);
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  return (
    <div id="members-settings-module" className="max-w-4xl mx-auto font-sans">
      {!isParent && (
        <div className="mb-4 bg-[#FFF9F1] border border-amber-200/50 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <span className="text-xl shrink-0">👀</span>
          <div>
            <h4 className="text-sm font-black text-amber-900">目前為唯讀模式</h4>
            <p className="text-xs text-amber-800/80 font-medium mt-1 leading-relaxed">
              您可以查看家庭成員資料，但無法修改家庭設定。
            </p>
          </div>
          <span className="ml-auto text-[10px] font-black tracking-wider text-amber-600 bg-amber-50 border border-amber-200/30 px-2 py-0.5 rounded-full select-none">
            👀 唯讀
          </span>
        </div>
      )}
      {/* List of Family Members - Full-width single Column */}
      <div className="bg-white rounded-2xl border-0 md:border border-[#E5E1DA] p-3.5 md:p-6 shadow-xs space-y-4 md:space-y-6 font-sans">
        <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 md:h-10 md:w-10 bg-[#F9F8F6] text-[#4A6076] border border-[#E5E1DA] rounded-xl flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#2D2926] font-sans">家庭成員名單</h2>
              <p className="text-[10px] text-[#7C6354] font-semibold mt-0.5">管理您的家人、角色、以及登入方式</p>
            </div>
          </div>
          {isParent && (
            <button
              onClick={() => setShowFormModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-[#4A6076] hover:bg-[#344453] px-3.5 py-2 rounded-xl border-y border-[#4A6076] cursor-pointer shadow-xs transition select-none leading-none active:scale-95 hover:shadow-md duration-200 shrink-0"
            >
              <span>➕ 新增家庭成員</span>
            </button>
          )}
        </div>

        {/* 1. 待加入申請 (Pending Join Requests) */}
        {isParent && pendingRequests && pendingRequests.length > 0 && (
          <div className="space-y-3 bg-[#FCFBF9] border border-[#E5E1DA] rounded-2xl p-4 animate-in fade-in duration-300">
            <h3 className="text-xs font-black text-amber-800 flex items-center gap-1.5 font-sans">
              <span>🔔 待加入申請</span>
              <span className="text-[10px] py-0.5 px-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
                {pendingRequests.length}
              </span>
            </h3>
            <div className="divide-y divide-[#E5E1DA]/50">
              {pendingRequests.map((req) => (
                <div key={req.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-sans">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#2D2926]">{req.userName}</span>
                      <span className="text-[10px] text-gray-500 font-bold font-mono">({req.userEmail})</span>
                    </div>
                    <p className="text-[10px] text-amber-800 mt-1">
                      申請角色：<span className="font-extrabold">{getRoleChineseName(req.role)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (onApproveJoinRequest) await onApproveJoinRequest(req);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition shadow-xs animate-none"
                    >
                      ✓ 同意加入
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          "拒絕加入申請",
                          `確定拒絕「${req.userName}」的家庭加入申請嗎？`,
                          async () => {
                            if (onRejectJoinRequest) await onRejectJoinRequest(req);
                          }
                        );
                      }}
                      className="bg-[#FFFDFB] hover:bg-gray-50 text-gray-500 border border-gray-200 font-semibold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition"
                    >
                      拒絕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[#2D2926] flex items-center gap-1.5 font-sans">
              <span>👥 已加入成員</span>
              <span className="text-[10px] py-0.5 px-2 bg-[#F9F8F6] text-[#4A6076] border border-[#E5E1DA] rounded-full font-bold">
                {familyMembers.length}
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl bg-white select-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FCFBF9] border-b border-[#E5E1DA] text-gray-500 font-bold select-none font-sans">
                  <th className="p-3">姓名</th>
                  <th className="p-3">角色</th>
                  <th className="p-3">登入方式</th>
                  <th className="p-3">Email</th>
                  <th className="p-3 text-center">帳號升級</th>
                  <th className="p-3 text-center">生日顯示年齡</th>
                  <th className="p-3">加入時間</th>
                  {isParent && <th className="p-3 text-center">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FAF9F6] font-sans">
                {familyMembers.map((member) => {
                  const themeColor = member.color || "#B4C3B2";
                  const userRoleLower = (currentUser.role || "").toLowerCase();
                  const isViewer = userRoleLower === "viewer" || userRoleLower === "member" || userRoleLower === "pet";
                  const isOwnerCurrentUser = userRoleLower === "owner" || userRoleLower === "admin" || userRoleLower === "superadmin" || (currentUser.role as any) === "Owner" || currentUser.role === UserRole.OWNER;
                  const canEdit = !isViewer && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT || member.uid === currentUser.uid) && !(currentUser.role === UserRole.PARENT && isOwnerRole(member.role));
                  const canDelete = !isViewer && isParent && member.uid !== currentUser.uid && !(currentUser.role === UserRole.PARENT && isOwnerRole(member.role));
                  const avatarTxt = member.displayName ? member.displayName.charAt(0) : "✿";
                  
                  const matchedInvite = invites.find(
                    (inv) =>
                      inv.joinedUserId === member.uid ||
                      inv.acceptedBy === member.uid ||
                      (inv.inviteCode && inv.inviteCode === member.inviteCode)
                  );
                  
                  const isGoogleUser = !!(member.email || (member as any).googleUid);
                  const codeVal = member.inviteCode || matchedInvite?.inviteCode || "";
                  const displayLoginMethodText = isGoogleUser 
                    ? "Google 登入" 
                    : (codeVal ? `代碼登入（${codeVal}）` : "代碼登入");
                  
                  return (
                    <tr 
                      key={member.uid} 
                      onClick={() => handleOpenRecords(member)}
                      className="hover:bg-[#FAF8F4]/30 cursor-pointer transition"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            style={{ backgroundColor: themeColor }}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs text-[#2D2926] border border-[#E5E1DA] font-black shrink-0 relative"
                          >
                            {(!member.photoURL || member.photoURL.startsWith("http")) ? avatarTxt : member.photoURL}
                            {member.role === UserRole.KID && (
                              <span className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-white rounded-full h-3.5 w-3.5 flex items-center justify-center text-[7.5px] font-bold border border-white">
                                ⭐
                              </span>
                            )}
                          </div>
                          <div className="font-extrabold text-[#2D2926]">
                            <div className="flex items-center gap-1">
                              <span>{member.displayName}</span>
                              {member.uid === currentUser.uid && (
                                <span className="text-[8px] font-bold bg-[#4A6076] text-white px-1.5 rounded transform scale-90">我</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-gray-700">
                        {getRoleChineseName(member.role)}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (isGoogleUser) {
                              const emailText = member.email || "（無電子郵件）";
                              const copyText = `登入方式：
Google 登入

帳號：
${emailText}

系統網址：
https://murphyma-family-app.vercel.app/`;
                              try {
                                await navigator.clipboard.writeText(copyText);
                                toast.success("✅ 已複製登入資訊", { duration: 2000 });
                              } catch (err) {
                                console.error("Copy failed: ", err);
                              }
                            } else {
                              const copyText = `家庭代碼：
${familyId}

登入方式：
代碼登入（${codeVal}）

系統網址：
https://murphyma-family-app.vercel.app/`;
                              try {
                                await navigator.clipboard.writeText(copyText);
                                toast.success("✅ 已複製登入資訊", { duration: 2000 });
                              } catch (err) {
                                console.error("Copy failed: ", err);
                              }
                            }
                          }}
                          className={`font-sans font-black border px-2.5 py-1 rounded-lg text-[11px] tracking-wider select-none shrink-0 transition-all flex items-center justify-center gap-1.5 min-w-[110px] cursor-pointer whitespace-nowrap active:scale-95 ${
                            isGoogleUser
                              ? "text-[#4A6076] bg-slate-50 border-slate-200 hover:bg-slate-100"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          <span>{displayLoginMethodText}</span>
                          <span className="text-[10px]/none">📋</span>
                        </button>
                      </td>
                      <td className="p-3 font-mono text-gray-500 text-[11px] truncate max-w-[150px]">
                        {member.email || (
                          (member.role === UserRole.KID || String(member.role).toLowerCase() === "child" || String(member.role).toLowerCase() === "kid")
                            ? "一般由大人管理"
                            : "尚未綁定 Email"
                        )}
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {!isGoogleUser ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (onBindGoogle) {
                                await onBindGoogle(member.uid);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg border-0 transition cursor-pointer shadow-xs whitespace-nowrap active:scale-95 duration-100"
                          >
                            🔑 綁定 Google
                          </button>
                        ) : (
                          <span className="text-[10.5px] text-gray-400 font-bold whitespace-nowrap">
                            ✓ 已完成綁定
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={member.showAgeInCalendar !== false}
                            disabled={!canEdit}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              try {
                                if (onEditMember) {
                                  await onEditMember(member.uid, {
                                    displayName: member.displayName,
                                    role: member.role,
                                    showAgeInCalendar: checked,
                                  } as any);
                                  toast.success(`✓ 已${checked ? "設定在行事曆顯示" : "設定不顯示"} ${member.displayName} 的生日年齡`);
                                }
                              } catch (err: any) {
                                border: "1px solid red";
                              }
                            }}
                            className="rounded border-[#E5E1DA] text-[#4A6076] focus:ring-[#4A6076] h-4 w-4 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 font-bold hidden sm:inline-block">顯示年齡</span>
                        </label>
                      </td>
                      <td className="p-3 text-gray-400 font-mono text-[11px]">
                        {formatTime(member.createdAt)}
                      </td>
                      {isParent && (
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEdit(member)}
                                className="text-[11px] font-black text-gray-500 hover:text-gray-800 p-1.5 hover:bg-slate-50 border border-transparent hover:border-[#E5E1DA] rounded transition cursor-pointer"
                                title="編輯資料"
                              >
                                編輯
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={async () => {
                                  showConfirm(
                                    "從家庭中移除成員",
                                    `確認要將「${member.displayName}」從家庭中移除（解除綁定）嗎？此操作將解除其家庭關係、保留其帳號與資料。`,
                                    async () => {
                                      try {
                                        if (onDeleteMember) {
                                          await onDeleteMember(member.uid);
                                          toast.success("✓ 已解除該成員的家庭綁定");
                                        }
                                      } catch (err: any) {
                                        toast.error("移除失敗：" + err.message);
                                      }
                                    }
                                  );
                                }}
                                className="text-[11px] font-black text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition cursor-pointer"
                                title="移除成員"
                              >
                                移除成員
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {familyMembers.length === 0 && (
                  <tr>
                    <td colSpan={isParent ? 8 : 7} className="p-8 text-center text-gray-400">目前家庭中尚無其他成員</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 邀請中成員 (Members Being Invited) */}
        {isParent && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black text-[#2D2926] flex items-center gap-1.5 font-sans">
              <span>✉️ 邀請中成員</span>
              <span className="text-[10px] py-0.5 px-2 bg-[#F9F8F6] text-[#4A6076] border border-[#E5E1DA] rounded-full font-bold">
                {invites.filter(inv => inv.status === 'pending' || inv.status === 'expired' || inv.status === 'cancelled').length}
              </span>
            </h3>

            <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl bg-white select-none">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FCFBF9] border-b border-[#E5E1DA] text-gray-500 font-bold select-none font-sans">
                    <th className="p-3">受邀姓名</th>
                    <th className="p-3">角色</th>
                    <th className="p-3">邀請碼</th>
                    <th className="p-3">限定 Email</th>
                    <th className="p-3 text-center">分享</th>
                    <th className="p-3">狀態</th>
                    <th className="p-3">產製日期</th>
                    <th className="p-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FAF9F6] font-sans">
                  {invites
                    .filter(inv => inv.status === "pending" || inv.status === "expired" || inv.status === "cancelled")
                    .map((inv) => {
                      const targetName = inv.memberName || "尚未設定姓名";
                      const statusLabel = 
                        inv.status === "pending" ? "⏱️ 待加入" : 
                        inv.status === "expired" ? "⏳ 已失效" : "🚫 已取消";
                      const statusColor = 
                        inv.status === "pending" ? "text-amber-600 bg-amber-50 border-amber-100" : 
                        inv.status === "expired" ? "text-gray-500 bg-gray-50 border-gray-100" : 
                        "text-rose-500 bg-rose-50 border-rose-100";

                      return (
                        <tr key={inv.id} className="hover:bg-[#FAF8F4]/30 transition">
                          <td className="p-3 font-semibold text-[#2D2926]">{targetName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.targetRole === "Owner" || inv.targetRole === "ADMIN" ? "bg-red-50 text-red-600 border border-red-150/40" :
                              inv.targetRole === "Parent" ? "bg-indigo-50 text-indigo-700 border border-indigo-150/40" :
                              inv.targetRole === "Child" || inv.targetRole === "KID" ? "bg-amber-50 text-amber-700 border border-amber-150/40" :
                              "bg-slate-50 text-slate-600 border border-slate-150/40"
                            }`}>
                              {inv.targetRole === "Owner" || inv.targetRole === "ADMIN" ? "管理員" :
                               inv.targetRole === "Parent" ? "家長" :
                               inv.targetRole === "Child" || inv.targetRole === "KID" ? "小孩" : "唯讀成員"}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-black text-[#4A6076]">
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] leading-tight select-all">{inv.inviteCode}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.inviteCode);
                                  toast.success("✓ 邀請碼已複製至剪貼簿！");
                                }}
                                className="text-gray-400 hover:text-gray-650 cursor-pointer p-0.5"
                                title="複製邀請碼"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 font-sans text-gray-500 truncate max-w-[150px]">
                            {inv.email || "無"}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                const msg = generateInvitationMsg({
                                  memberName: inv.memberName || "新成員",
                                  targetRole: inv.targetRole,
                                  inviteCode: inv.inviteCode,
                                  email: inv.email
                                });
                                navigator.clipboard.writeText(msg);
                                toast.success("✓ 完整邀請訊息已複製！");
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition cursor-pointer select-none"
                              title="複製完整邀請訊息"
                            >
                              <Copy className="h-3 w-3" />
                              <span>📋 複製訊息</span>
                            </button>
                          </td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400 font-mono text-[11px]">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "-"}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {inv.status === "pending" && (
                                <button
                                  onClick={() => {
                                    setEditingInvite(inv);
                                    setEditingMember(null);
                                    setDisplayName(inv.memberName || "");
                                    setRole(inv.targetRole);
                                    setInviteEmailConstraint(inv.email || "");
                                    setShowFormModal(true);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-850 font-bold hover:bg-indigo-50 px-2 py-1 rounded text-[10px] border border-transparent hover:border-indigo-100 transition cursor-pointer"
                                >
                                  編輯
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteInvite(inv.id, inv.inviteCode)}
                                className="text-rose-500 hover:text-[#E28F83] font-bold hover:bg-rose-50 px-2 py-1 rounded text-[10px] border border-transparent hover:border-rose-100 transition cursor-pointer"
                              >
                                刪除邀請
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {invites.filter(inv => inv.status === "pending" || inv.status === "expired" || inv.status === "cancelled").length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">目前尚無任何受邀請中的名單。隨時點擊右上角新增成員！</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 進階資訊 - 預設收合 */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-6">
          <button 
            type="button"
            onClick={() => setShowAdvancedInfo(!showAdvancedInfo)}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-550 hover:text-gray-800 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BadgeInfo className="h-4 w-4 text-gray-400" />
              <span>⚙️ 進階資訊</span>
            </span>
            {showAdvancedInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showAdvancedInfo && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-3.5 animate-in fade-in duration-150 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 font-bold block text-[10px] uppercase tracking-wide">家庭名稱</span>
                  <span className="font-extrabold text-[#2D2926] text-sm">{familyName}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold block text-[10px] uppercase tracking-wide font-sans">家庭代碼 (舊系統)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-gray-800 bg-white border border-[#E5E1DA] px-2 py-0.5 rounded text-xs select-all">{familyId}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="text-[10px] font-bold text-[#4A6076] bg-white border border-[#E5E1DA] hover:bg-gray-50 px-2 py-1 rounded transition cursor-pointer"
                    >
                      {copied ? "已複製" : "複製"}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 font-bold block text-[10px] uppercase tracking-wide font-sans">Owner / 建立者</span>
                  <span className="font-bold text-gray-800">
                    {(() => {
                      const owner = familyMembers.find(m => m.role === UserRole.ADMIN || m.role === UserRole.PARENT);
                      return owner ? owner.displayName : "管理員";
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold block text-[10px] uppercase tracking-wide font-sans">家庭啟用日期</span>
                  <span className="font-mono text-gray-700">
                    {(() => {
                      const owner = familyMembers.find(m => m.role === UserRole.ADMIN || m.role === UserRole.PARENT);
                      return formatTime(owner?.createdAt);
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings / Mode switcher Box - 1 Column */}
      <div id="settings-mode-card" className="hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[#E5E1DA] pb-3.5">
          <div className="p-2 bg-[#F9F8F6] text-[#4A6076] border border-[#E5E1DA] rounded-lg">
            <Settings2 className="h-5 w-5 animate-spin" style={{ animationDuration: "16s" }} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#2D2926] font-sans">期間型模式排程管理</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">自動由日期判定模式落點，不需手動來回切換</p>
          </div>
        </div>

        {/* Simulated Today Setting */}
        <div className="bg-[#FAF8F4] p-4 rounded-xl border border-[#E5E1DA] space-y-2">
          <label className="block text-xs font-black text-[#7C6354] font-sans">
            📅 模擬今日日期 (測試時間落點)：
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={simulatedTodayDate}
              onChange={(e) => onSetSimulatedTodayDate?.(e.target.value)}
              className="flex-grow bg-white border border-[#E5E1DA] rounded-xl px-3 py-1.5 text-xs text-gray-700 font-extrabold focus:ring-1 focus:ring-[#7C6354] focus:outline-none"
            />
            <button
              onClick={() => onSetSimulatedTodayDate?.(getLocalToday())}
              className="px-2.5 py-1.5 text-[9px] font-bold bg-[#7C6354] text-white rounded-lg hover:bg-[#5E4E42] cursor-pointer"
              title="重設為今天"
            >
              重設
            </button>
          </div>
          <div className="text-[10px] text-gray-400 leading-normal">
            系統將依據您輸入的日期與排程自動計算目前應啟用的模式。
          </div>
        </div>

        {/* Daily Mode Backstop Banner */}
        <div className="border border-dashed border-[#E5E1DA] rounded-xl p-3 bg-gray-50/50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-gray-700">🌱 常規日常模式</span>
            <span className="text-[8px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">常駐生效</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            系統永遠備留此模式。當沒有其他特定的模式進入排期日期時，系統將自動 fallback 歸位回日常模式。
          </p>
        </div>

        {/* Scheduled modes lists */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-750">📋 已排程模式區間 ({configuredModes.length})</h3>
            {isParent && (
              <button
                onClick={handleOpenAddMode}
                className="text-[10px] font-black text-[#7C6354] hover:text-[#5E4E42] flex items-center gap-1 bg-[#FAF8F4] border border-[#E5E1DA] px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>新建排程</span>
              </button>
            )}
          </div>

          {configuredModes.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#E5E1DA] rounded-xl text-xs text-gray-400">
              目前尚無任何註冊排程，日常模式將常伴全家！
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {configuredModes.map((mode) => {
                // Status check
                let statusText = "未開始";
                let statusColor = "bg-gray-100 text-gray-500 border-gray-250";
                if (simulatedTodayDate >= mode.startDate && simulatedTodayDate <= mode.endDate) {
                  statusText = "🟢 進行中";
                  statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200 ring-2 ring-emerald-400/35";
                } else if (simulatedTodayDate > mode.endDate) {
                  statusText = "已結束";
                  statusColor = "bg-gray-100 text-gray-400 border-gray-150 line-through decoration-gray-400";
                }

                const isExpanded = expandedModeId === mode.id;

                return (
                  <div
                    key={mode.id}
                    className={`border rounded-xl transition-all p-3.5 space-y-3 bg-white ${
                      statusText.includes("進行中") ? "border-[#7C6354] shadow-sm bg-[#FAF8F4]/30" : "border-[#E5E1DA]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">{mode.icon || "✈"}</span>
                        <div>
                          <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5 font-sans leading-tight">
                            {mode.name}
                          </h4>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">
                            {mode.startDate} ～ {mode.endDate}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[8px] font-sans font-black px-2 py-0.5 rounded border ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons (Edit/Delete) */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px]">
                      <button
                        onClick={() => setExpandedModeId(isExpanded ? null : mode.id)}
                        className="text-gray-500 hover:text-[#7C6354] flex items-center gap-0.5 cursor-pointer font-bold select-none"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{isExpanded ? "收合行程細節" : "查看詳細規劃"}</span>
                      </button>

                      {isParent && (
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handleOpenEditMode(mode)}
                            className="text-[#4A6076] hover:text-[#2A3A4A] cursor-pointer"
                            title="編輯此模式"
                          >
                            ✏ 編輯
                          </button>
                          <button
                            onClick={() => handleDeleteMode(mode.id, mode.name)}
                            className="text-red-400 hover:text-red-700 cursor-pointer font-bold"
                            title="刪除此模式"
                          >
                            🗑 刪除
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-[#E5E1DA] pt-3.5 space-y-3 text-xs bg-gray-50/40 p-2.5 rounded-lg animate-in slide-in-from-top-1 duration-150">
                        {/* Handle TRAVEL */}
                        {mode.type === SystemMode.TRAVEL && (
                          <div className="space-y-3 font-sans text-gray-600">
                            <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded-lg border border-[#E5E1DA]/60">
                              <div><span className="text-gray-400">旅行：</span><span className="font-bold text-gray-700">{mode.name}</span></div>
                              <div><span className="text-gray-400">類型：</span><span className="font-bold text-gray-700">{mode.travelType === "international" ? "🌎 國外旅遊" : "🚗 國內旅遊"}</span></div>
                              {mode.travelType === "international" ? (
                                <>
                                  <div className="col-span-2"><span className="text-gray-400">航空公司：</span><span className="font-bold text-gray-700">{mode.airline || "--"} ({mode.flightNumber || "--"})</span></div>
                                  <div><span className="text-gray-400">出/回航班：</span><span className="font-bold text-gray-700">{mode.departureTime || "--"} / {mode.returnTime || "--"}</span></div>
                                  <div><span className="text-gray-450">航廈：</span><span className="font-bold text-gray-750">出發 {mode.departureTerminal || "--"} / 回程 {mode.returnTerminal || "--"}</span></div>
                                  <div className="col-span-2 flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${mode.passportReminder ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-300 border border-gray-100"}`}>
                                      {mode.passportReminder ? "✓ 已帶護照" : "✗ 無護照提示"}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${mode.visaReminder ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-300 border border-gray-100"}`}>
                                      {mode.visaReminder ? "✓ 已帶簽證" : "✗ 無簽證提示"}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-2">
                                  <span className="text-gray-450">國內主要交通：</span>
                                  <span className="font-bold text-gray-750">
                                    {mode.transportation === "drive" && "🚗 自行開車"}
                                    {mode.transportation === "hightrain" && "🚄 台灣高鐵"}
                                    {mode.transportation === "train" && "🚆 台灣鐵路"}
                                    {mode.transportation === "bus" && "🚌 長途客運"}
                                    {mode.transportation === "rent" && "🔑 租車自駕"}
                                    {!["drive", "hightrain", "train", "bus", "rent"].includes(mode.transportation || "") && `🚚 ${mode.transportation}`}
                                  </span>
                                </div>
                              )}
                              {mode.notes && (
                                <div className="col-span-2 border-t border-gray-100 pt-1 text-xs text-gray-500 italic">
                                  💡 攜帶提醒：{mode.notes}
                                </div>
                              )}
                            </div>

                            {/* Daily Itinerary interactive block */}
                            <div className="space-y-2">
                              <span className="font-black text-gray-700 flex items-center gap-1 text-[11px]">
                                <Plane className="h-3.5 w-3.5 text-orange-500" />
                                <span>每日行程一覽 (點選切換天數編輯)</span>
                              </span>

                              {/* Date selection tabs based on config date ranges */}
                              <div className="flex gap-1 overflow-x-auto pb-1.5 pt-0.5 whitespace-nowrap scrollbar-none border-b border-gray-200">
                                {(() => {
                                  const start = new Date(mode.startDate);
                                  const end = new Date(mode.endDate);
                                  const dates = [];
                                  const curr = new Date(start);
                                  while (curr <= end) {
                                    dates.push(curr.toISOString().split("T")[0]);
                                    curr.setDate(curr.getDate() + 1);
                                  }

                                  const activeDate = activeItineraryDate || dates[0] || "";

                                  return dates.map((d, index) => {
                                    const isTodayInItinerary = (d === simulatedTodayDate);
                                    return (
                                      <button
                                        type="button"
                                        key={d}
                                        onClick={() => setActiveItineraryDate(d)}
                                        className={`px-2 py-1 text-[9px] rounded-md font-sans border transition-all shrink-0 cursor-pointer ${
                                          activeDate === d
                                            ? "bg-[#7C6354] text-white border-transparent font-extrabold"
                                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                                        }`}
                                      >
                                        D{index + 1} {isTodayInItinerary && "🌟"}
                                        <span className="block text-[7px] opacity-70 font-mono mt-0.5">
                                          {d.substring(5)}
                                        </span>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>

                              {/* Itinerary editor fields */}
                              {(() => {
                                const dates = [];
                                const start = new Date(mode.startDate);
                                const end = new Date(mode.endDate);
                                const curr = new Date(start);
                                while (curr <= end) {
                                  dates.push(curr.toISOString().split("T")[0]);
                                  curr.setDate(curr.getDate() + 1);
                                }
                                const activeDate = activeItineraryDate || dates[0] || "";
                                if (!activeDate) return null;

                                const dayData = mode.itinerary?.[activeDate] || {};

                                return (
                                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-orange-100 shadow-sm text-[11px] font-sans">
                                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-extrabold border-b border-orange-50 pb-1.5 mb-2.5">
                                      <span>📅 日期：{activeDate} 行程規劃表</span>
                                      {activeDate === simulatedTodayDate && (
                                        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded animate-pulse">
                                          ● 模擬今天
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-2.5 pl-0.5">
                                      {/* Row 1: 早上行程 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-bold shrink-0 w-[56px] text-right">
                                          早上行程：
                                        </span>
                                        <input
                                          type="text"
                                          value={dayData.morning || ""}
                                          disabled={!isParent}
                                          placeholder={isParent ? "輸入行程，例：搭飛機..." : "（未設定）"}
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "morning", e.target.value)}
                                          className="flex-grow bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 font-semibold text-gray-800 transition-all focus:outline-none text-[11px]"
                                        />
                                      </div>

                                      {/* Row 2: 下午行程 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-bold shrink-0 w-[56px] text-right">
                                          下午行程：
                                        </span>
                                        <input
                                          type="text"
                                          value={dayData.afternoon || ""}
                                          disabled={!isParent}
                                          placeholder={isParent ? "輸入行程，例：漫步散步..." : "（未設定）"}
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "afternoon", e.target.value)}
                                          className="flex-grow bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 font-semibold text-gray-800 transition-all focus:outline-none text-[11px]"
                                        />
                                      </div>

                                      {/* Row 3: 午餐安排 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-bold shrink-0 w-[56px] text-right">
                                          午餐安排：
                                        </span>
                                        <input
                                          type="text"
                                          value={dayData.lunch || ""}
                                          disabled={!isParent}
                                          placeholder={isParent ? "輸入午餐，例：拉麵屋..." : "（未設定）"}
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "lunch", e.target.value)}
                                          className="flex-grow bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 font-semibold text-gray-800 transition-all focus:outline-none text-[11px]"
                                        />
                                      </div>

                                      {/* Row 4: 晚餐安排 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-bold shrink-0 w-[56px] text-right">
                                          晚餐安排：
                                        </span>
                                        <input
                                          type="text"
                                          value={dayData.dinner || ""}
                                          disabled={!isParent}
                                          placeholder={isParent ? "輸入晚餐，例：燒肉享用..." : "（未設定）"}
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "dinner", e.target.value)}
                                          className="flex-grow bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 font-semibold text-gray-800 transition-all focus:outline-none text-[11px]"
                                        />
                                      </div>

                                      {/* Row 5: 住宿 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-bold shrink-0 w-[56px] text-right">
                                          住宿：
                                        </span>
                                        <input
                                          type="text"
                                          value={dayData.lodging || ""}
                                          disabled={!isParent}
                                          placeholder={isParent ? "輸入住宿，例：王子飯店..." : "（未設定）"}
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "lodging", e.target.value)}
                                          className="flex-grow bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:bg-orange-50/15 rounded px-2 py-1 font-semibold text-gray-800 transition-all focus:outline-none text-[11px]"
                                        />
                                      </div>
                                    </div>

                                    {isParent && (
                                      <p className="text-[8px] text-gray-400 text-right font-medium">
                                        * 輸入完成即時自動存檔喔
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Handle EXAM */}
                        {mode.type === SystemMode.EXAM && (
                          <div className="space-y-3 font-sans text-gray-600 text-[11px]">
                            <div>
                              <div className="font-extrabold text-[10px] text-purple-750 flex items-center gap-1 mb-1.5">
                                <BookOpen className="h-3 w-3" />
                                <span>學科目標追蹤</span>
                              </div>
                              <div className="space-y-1.5">
                                {(mode.subjects || []).map((subj, sIdx) => (
                                  <div key={sIdx} className="bg-white p-2 border border-gray-150 rounded-lg flex justify-between items-start">
                                    <span className="font-black text-gray-750 shrink-0">{subj.name}：</span>
                                    <span className="text-gray-500 text-right font-semibold">{subj.target || "無特定目標"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {mode.dailyPlan && mode.dailyPlan.length > 0 && (
                              <div>
                                <div className="font-extrabold text-[10px] text-purple-750 flex items-center gap-1 mb-1.5">
                                  <ClipboardList className="h-3 w-3" />
                                  <span>⏰ 每日讀書作息表 (加倍星星衝刺)</span>
                                </div>
                                <div className="space-y-1 bg-white p-2 rounded-lg border border-gray-150">
                                  {mode.dailyPlan.map((plan) => (
                                    <div key={plan.id} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-b-0">
                                      <span className="font-mono text-gray-400 text-[10px]">{plan.startTime} ~ {plan.endTime}</span>
                                      <span className="font-extrabold text-purple-700">{plan.subjectName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Handle VACATION */}
                        {mode.type === SystemMode.VACATION && (
                          <div className="space-y-2 font-sans text-gray-650 text-[11px]">
                            <div className="font-extrabold text-[10px] text-emerald-800 flex items-center gap-1">
                              <Sun className="h-3.5 w-3.5" />
                              <span>自主生活每日定存任務 ({mode.vacationType || "長假"})</span>
                            </div>
                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto bg-white p-2 rounded-lg border border-gray-155">
                              {(!mode.dailyTasks || mode.dailyTasks.length === 0) ? (
                                <p className="text-[10px] text-gray-400 py-1 text-center font-bold">無設定定存任務</p>
                              ) : (
                                mode.dailyTasks.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-gray-50 last:border-b-0">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                    <span className="text-gray-700 font-extrabold">{t.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Handle CUSTOM */}
                        {mode.type === SystemMode.CUSTOM && (
                          <div className="space-y-2 font-sans text-gray-650 text-[11px]">
                            <div className="font-extrabold text-[10px] text-indigo-800 flex items-center gap-1">
                              <Trophy className="h-3.5 w-3.5" />
                              <span>自訂模式每日約定任務說明</span>
                            </div>
                            <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-gray-150">
                              {(!mode.customTasks || mode.customTasks.length === 0) ? (
                                <p className="text-[10px] text-gray-400 py-1 text-center font-bold">無約定任務</p>
                              ) : (
                                mode.customTasks.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-gray-50 last:border-b-0">
                                    <Sparkle className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                    <span className="text-gray-700 font-extrabold">{t.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
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
      </div>

      {/* Member Creation/Editing form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-xl relative animate-in fade-in zoom-in-95 duration-150 pb-[max(24px,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                setShowFormModal(false);
                setEditingInvite(null);
                setEditingMember(null);
                setInviteEmailConstraint("");
                setDisplayName("");
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition cursor-pointer animate-none"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-md font-black text-[#2D2926] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500 fill-amber-200" />
              <span>{editingInvite ? `編輯家庭邀請設定` : editingMember ? `編輯家庭成員「${editingMember.displayName}」` : "新增家庭成員名冊"}</span>
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {editingMember ? (
                <>
                  {/* Editing Mode Fields */}
                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">成員姓名</label>
                    <input
                      type="text"
                      required
                      placeholder="例如：小華、媽媽"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">家庭身份 / 角色</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] font-bold text-gray-800"
                    >
                      {currentUser && ((currentUser.role as any) === "Owner" || (currentUser.role as any) === "Admin") && (
                        <option value="Owner">管理員 (Owner)</option>
                      )}
                      <option value="Parent">家長 (Parent)</option>
                      <option value="Child">孩子 (Child)</option>
                      <option value="Viewer">唯讀成員 (Viewer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      成員生日 (非必填)
                    </label>
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-1.5 bg-[#F9F8F6] font-mono font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">成員性別</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] text-gray-800"
                    >
                      <option value="">未指定</option>
                      <option value="male">👦 男生 (Male)</option>
                      <option value="female">👧 女生 (Female)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1 bg-[#FAF8F4]/50 p-2.5 rounded-xl border border-[#E5E1DA]/40">
                    <input
                      type="checkbox"
                      id="show-age-edit"
                      checked={showAgeInCalendar}
                      onChange={(e) => setShowAgeInCalendar(e.target.checked)}
                      className="rounded border-[#E5E1DA] text-[#4A6076] focus:ring-[#4A6076] h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="show-age-edit" className="text-xs font-bold text-[#4A6076] cursor-pointer select-none">
                      🎂 行事曆中顯示年齡 (勾選顯示 / 取消不顯示)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">專屬代表主題色</label>
                    <div className="flex items-center gap-2 mt-1">
                      {MORANDI_COLORS.map((col) => {
                        const isSelected = color === col.value;
                        return (
                          <button
                            type="button"
                            key={col.value}
                            onClick={() => setColor(col.value)}
                            style={{ backgroundColor: col.value }}
                            className={`h-7 w-7 rounded-full border transition cursor-pointer relative ${
                              isSelected ? "ring-2 ring-offset-2 ring-[#4A6076] scale-110" : "border-gray-200"
                            }`}
                            title={col.name}
                          >
                            {isSelected && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1.5">選擇代表圖示 (手帳簡約風格)</label>
                    <div className="grid grid-cols-7 gap-1.5 mt-1 bg-[#FAF8F4] p-3 rounded-xl border border-[#E5E1DA]">
                      {JAPANESE_SYMBOLS.map((sym) => {
                        const isSelected = photoURL === sym.value;
                        return (
                          <button
                            title={sym.name}
                            type="button"
                            key={sym.value}
                            onClick={() => setPhotoURL(sym.value)}
                            className={`h-8 w-8 text-sm flex items-center justify-center rounded bg-white border cursor-pointer select-none ${
                              isSelected ? "border-[#4A6076] ring-2 ring-[#4A6076]/15 font-bold scale-110" : "border-[#E5E1DA] text-gray-500"
                            }`}
                          >
                            {sym.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Simplified Add Invitation Mode Fields */}
                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">受邀者姓名</label>
                    <input
                      type="text"
                      required
                      placeholder="例如：爸爸、媽媽、阿嬤、小華、金龜子"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] focus:outline-none focus:ring-1 focus:ring-[#4C6278]"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">此名稱為加入後正式顯示名稱。加入者不可修改。</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">預計家庭角色關係</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] font-bold text-gray-800"
                    >
                      <option value="Parent">家長 (Parent)</option>
                      <option value="Child">孩子 (Child)</option>
                      <option value="Viewer">唯讀成員 (Viewer)</option>
                      {currentUser && ((currentUser.role as any) === "Owner" || (currentUser.role as any) === "Admin") && (
                        <option value="Owner">管理員 (Owner)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">限定指定 Google 帳號加入 (選填)</label>
                    <input
                      type="email"
                      placeholder="例如：abc@gmail.com。欲綁定指定帳號請填寫"
                      value={inviteEmailConstraint}
                      onChange={(e) => setInviteEmailConstraint(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] focus:outline-none font-sans"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">留白表示：免帳號模式（適合長輩與小孩，只需輸入邀請碼即可直接加入）</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      受邀者生日 (非必填)
                    </label>
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-1.5 bg-[#F9F8F6] font-mono font-bold text-gray-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 bg-[#FAF8F4]/50 p-2.5 rounded-xl border border-[#E5E1DA]/40">
                    <input
                      type="checkbox"
                      id="show-age-invite"
                      checked={showAgeInCalendar}
                      onChange={(e) => setShowAgeInCalendar(e.target.checked)}
                      className="rounded border-[#E5E1DA] text-[#4A6076] focus:ring-[#4A6076] h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="show-age-invite" className="text-xs font-bold text-[#4A6076] cursor-pointer select-none">
                      🎂 行事曆中顯示年齡 (勾選顯示 / 取消不顯示)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">受邀者性別</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] text-gray-800"
                    >
                      <option value="">未指定</option>
                      <option value="male">👦 男生 (Male)</option>
                      <option value="female">👧 女生 (Female)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1">專屬代表主題色</label>
                    <div className="flex items-center gap-2 mt-1">
                      {MORANDI_COLORS.map((col) => {
                        const isSelected = color === col.value;
                        return (
                          <button
                            type="button"
                            key={col.value}
                            onClick={() => setColor(col.value)}
                            style={{ backgroundColor: col.value }}
                            className={`h-7 w-7 rounded-full border transition cursor-pointer relative ${
                              isSelected ? "ring-2 ring-offset-2 ring-[#4A6076] scale-110" : "border-gray-200"
                            }`}
                            title={col.name}
                          >
                            {isSelected && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6076] mb-1.5">選擇代表圖示 (手帳簡約風格)</label>
                    <div className="grid grid-cols-7 gap-1.5 mt-1 bg-[#FAF8F4] p-3 rounded-xl border border-[#E5E1DA]">
                      {JAPANESE_SYMBOLS.map((sym) => {
                        const isSelected = photoURL === sym.value;
                        return (
                          <button
                            title={sym.name}
                            type="button"
                            key={sym.value}
                            onClick={() => setPhotoURL(sym.value)}
                            className={`h-8 w-8 text-sm flex items-center justify-center rounded bg-white border cursor-pointer select-none ${
                              isSelected ? "border-[#4A6076] ring-2 ring-[#4A6076]/15 font-bold scale-110" : "border-[#E5E1DA] text-gray-500"
                            }`}
                          >
                            {sym.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-2">
                <div>
                  {editingMember && onDeleteMember && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT) && editingMember.uid !== currentUser.uid && !(currentUser.role === UserRole.PARENT && isOwnerRole(editingMember.role)) ? (
                    <button
                      type="button"
                      onClick={() => {
                        showConfirm(
                          "從家庭中移除成員",
                          `確認要將「${editingMember.displayName}」從家庭中移除（解除綁定）嗎？此操作將保留其帳號，但不刪除其任何資料。`,
                          async () => {
                            try {
                              await onDeleteMember(editingMember.uid);
                              setShowFormModal(false);
                              toast.success("✓ 已解除家庭綁定");
                            } catch (err: any) {
                              toast.error("移除失敗：" + err.message);
                            }
                          }
                        );
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      移除成員
                    </button>
                  ) : <div />}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormModal(false);
                      setEditingInvite(null);
                      setEditingMember(null);
                      setInviteEmailConstraint("");
                      setDisplayName("");
                    }}
                    className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-150 border border-gray-250 rounded-lg transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#4A6076] hover:bg-[#3b4c5e] rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingForm ? "執行中..." : editingInvite ? "儲存修改" : editingMember ? "儲存修改" : "建立邀請"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Records logs Modal */}
      {viewingRecordMember && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl relative flex flex-col font-sans pb-[max(24px,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setViewingRecordMember(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition cursor-pointer animate-none"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-[#E5E1DA] pb-4 mb-4">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">生活履程與兌獎紀錄</span>
              <h3 className="text-md font-black text-[#2D2926] flex items-center gap-1.5 mt-0.5">
                <ClipboardList className="h-5 w-5 text-[#4A6076]" />
                <span>「{viewingRecordMember.displayName}」學習記錄本</span>
              </h3>
            </div>

            <div className="space-y-6 flex-1 min-h-0">
              {/* Task Section */}
              <div>
                <h4 className="text-xs font-black text-[#2D2926] border-l-4 border-indigo-400 pl-2 mb-2">
                  🌟 已核准通關的任務 ({memberApprovedTasks.length})
                </h4>
                {memberApprovedTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-3">尚無核准通關的任務紀錄</p>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {memberApprovedTasks.map((t) => (
                      <div key={t.id} className="bg-[#FAF8F4]/60 p-2.5 rounded-xl border border-[#E5E1DA]/50 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-gray-700">{t.title}</span>
                          <span className="font-bold text-amber-600">+{t.starsReward} ★</span>
                        </div>
                        {t.approvedAt && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            查收日期：{t.approvedAt.seconds ? new Date(t.approvedAt.seconds * 1000).toLocaleDateString() : "常規"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Redemptions Section */}
              <div>
                <h4 className="text-xs font-black text-[#2D2926] border-l-4 border-rose-400 pl-2 mb-2">
                  🎁 許願與兌獎歷程 ({memberApprovedRedemptions.length})
                </h4>
                {memberApprovedRedemptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-3">目前尚無已送審或核准的兌獎紀錄</p>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {memberApprovedRedemptions.map((r) => (
                      <div key={r.id} className="bg-[#FAF8F4]/60 p-2.5 rounded-xl border border-[#E5E1DA]/50 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-gray-700">{r.rewardTitle}</span>
                          <span className="font-bold text-rose-500">-{r.starsRequired} ★</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                          <span>
                            申請狀態：
                            <span className={`font-bold ${r.status === "approved" ? "text-emerald-600" : "text-amber-500"}`}>
                              {r.status === "approved" ? "已核准兌換" : "審核中"}
                            </span>
                          </span>
                          {r.createdAt && (
                            <span>
                              {r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E1DA] mt-6 flex justify-end">
              <button
                onClick={() => setViewingRecordMember(null)}
                className="px-5 py-2 text-xs font-bold text-gray-650 hover:bg-[#F9F8F6] border border-[#E5E1DA] rounded-xl transition cursor-pointer"
              >
                關閉窗口
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom React-level deletion modal for period modes */}
      {confirmDeleteId && (
        <div id="delete-mode-modal" className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-gray-100 p-6 max-w-sm w-full shadow-2xl space-y-5 text-center font-sans max-h-[85vh] overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="mx-auto h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 stroke-red-500" />
            </div>
            
            <div className="space-y-1.5 text-center font-sans">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500 block">
                危險操作警告
              </span>
              <h3 className="text-base font-black text-gray-950">
                確認刪除特別期間：
              </h3>
              <p className="text-xs font-extrabold text-[#7C6354] bg-[#FAF8F4] px-4 py-1.5 rounded-xl border border-[#E5E1DA] inline-block mt-1 shadow-sm font-semibold">
                {confirmDeleteName}
              </p>
              <div className="text-xs text-gray-500 leading-relaxed pt-1.5">
                <p className="p-2.5 text-amber-700 bg-[#FFFBF7] rounded-xl border border-[#F2ECE4] font-black">
                  📢 同步處理解除設定：您希望連同月曆中對應建立的活動行程，一起撤銷刪除嗎？
                </p>
              </div>
            </div>

            {deleteErrorMessage && (
              <div className="p-3 bg-red-50 text-red-800 rounded-xl text-left border border-red-100 text-[11px] leading-relaxed font-bold font-sans">
                🚨 刪除失敗：{deleteErrorMessage}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 font-sans">
              <button
                type="button"
                onClick={() => handleConfirmDeleteMode(true)}
                disabled={isDeleting}
                className="w-full py-2.5 bg-red-600 hover:bg-red-750 text-white font-black rounded-xl border border-red-750 shadow-md hover:shadow-lg transition text-xs select-none disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? "處理中..." : "💥 全部刪除 (連同月曆行程)"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteMode(false)}
                disabled={isDeleting}
                className="w-full py-2.5 bg-[#FAF9F6] hover:bg-gray-100 text-[#5B493E] font-bold rounded-xl border border-gray-200 transition text-xs select-none disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
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

      {/* Mode Schedule Scheduler form Modal */}
      {showModeModal && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-lg w-full shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]">
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
                <h3 className="text-sm font-black text-[#2D2926] font-sans">
                  {editingModeConfig ? "🔧 編輯模式排程" : "✨ 新建模式排程"}
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">預先規劃日期區間，系統將在對應天數自動切換</p>
              </div>
            </div>

            <form onSubmit={handleSaveModeSubmit} className="space-y-4 font-sans text-xs">
              {/* Type select */}
              <div className="space-y-1">
                <label className="block font-black text-gray-750">1. 選擇模式類型：</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: SystemMode.TRAVEL, label: "✈ 旅遊", icon: "✈" },
                    { id: SystemMode.EXAM, label: "📝 考試", icon: "📝" },
                    { id: SystemMode.VACATION, label: "🏡 假期", icon: "🏡" },
                    { id: SystemMode.CUSTOM, label: "🎨 自訂", icon: "🎨" },
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
                          setModeFormName("自主學習模式");
                          setModeFormColor("indigo");
                        }
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        modeFormType === opt.id
                          ? "ring-2 ring-indigo-500 bg-indigo-50/20 border-transparent font-extrabold"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name input */}
              <div className="space-y-1">
                <label className="block font-black text-gray-750">2. 名稱標籤：</label>
                <input
                  type="text"
                  required
                  placeholder="例如：峇里島旅行、英檢衝刺、暑寒假規劃..."
                  value={modeFormName}
                  onChange={(e) => setModeFormName(e.target.value)}
                  className="w-full bg-gray-50/50 rounded-xl px-3 py-2 border border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none"
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

              {/* Dyn forms */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 max-h-[220px] overflow-y-auto space-y-3">
                {/* 1. Travel configs */}
                {modeFormType === SystemMode.TRAVEL && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-[#7C6354] border-b pb-1">✈ 旅遊模式高級旅行裝片</h4>
                    
                    <div className="space-y-1">
                      <label className="block font-bold">旅行空間定位：</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="trType"
                            checked={travelType === "international"}
                            onChange={() => setTravelType("international")}
                          />
                          <span>🌎 國外旅遊</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="trType"
                            checked={travelType === "domestic"}
                            onChange={() => setTravelType("domestic")}
                          />
                          <span>🚗 國內旅遊</span>
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
                              placeholder="例如 星宇航空、長榮"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">去程航班號：</label>
                            <input
                              type="text"
                              value={flightNumber}
                              onChange={(e) => setFlightNumber(e.target.value)}
                              placeholder="例如 BR255、JX721"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400">起飛時間 (出發)：</label>
                            <input
                              type="text"
                              value={departureTime}
                              placeholder="例如 09:50"
                              onChange={(e) => setDepartureTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">回程降落時間：</label>
                            <input
                              type="text"
                              value={returnTime}
                              placeholder="例如 16:15"
                              onChange={(e) => setReturnTime(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400">出發航廈 Terminal：</label>
                            <input
                              type="text"
                              value={departureTerminal}
                              placeholder="例如 T2"
                              onChange={(e) => setDepartureTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">回程航廈 Terminal：</label>
                            <input
                              type="text"
                              value={returnTerminal}
                              placeholder="例如 T1"
                              onChange={(e) => setReturnTerminal(e.target.value)}
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={passportReminder}
                              onChange={(e) => setPassportReminder(e.target.checked)}
                            />
                            <span className="font-bold text-gray-700">🔍 護照檢查提示</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
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
                          <label className="text-[10px] text-gray-400">主要交通方式：</label>
                          <select
                            value={transportation}
                            onChange={(e) => setTransportation(e.target.value)}
                            className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                          >
                            <option value="drive">🚗 自行開車</option>
                            <option value="hightrain">🚄 台灣高鐵</option>
                            <option value="train">🚆 台灣鐵路</option>
                            <option value="bus">🚌 長途客運</option>
                            <option value="rent">🔑 租車自駕</option>
                            <option value="custom">🛠 其他交通</option>
                          </select>
                        </div>
                        {transportation === "custom" && (
                          <div>
                            <label className="text-[10px] text-gray-400">填寫自訂交通：</label>
                            <input
                              type="text"
                              value={customTransportation}
                              onChange={(e) => setCustomTransportation(e.target.value)}
                              placeholder="例如：包車遊覽、自行車、大眾接駁"
                              className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-gray-400">備註、攜帶行李提示：</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="泳裝、防蚊液、水杯、遮陽帽..."
                        className="w-full bg-white rounded-lg p-1.5 border border-gray-200 focus:outline-none text-[11px]"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Exam config */}
                {modeFormType === SystemMode.EXAM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-purple-700 border-b pb-1">📝 考試衝刺：科目學習目標</h4>
                    <p className="text-[9px] text-gray-400 leading-normal">
                      為孩子預先擬定考試科目與複習目標，激勵雙倍星星產能！
                    </p>
                    <div className="space-y-2">
                      {examSubjects.map((subject, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-1.5 rounded-lg border border-gray-200">
                          <span className="font-bold text-gray-700 w-12 shrink-0">{subject.name}</span>
                          <input
                            type="text"
                            value={subject.target}
                            onChange={(e) => {
                              const newList = [...examSubjects];
                              newList[idx].target = e.target.value;
                              setExamSubjects(newList);
                            }}
                            placeholder="輸入複習進度目標"
                            className="bg-transparent flex-grow text-[11px] p-0.5 border-b border-gray-100 focus:border-purple-300 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <span className="font-extrabold text-[10px] block mb-1">🔍 科目列表擴增：</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSubjectInput}
                          placeholder="例如 社會、自然、鋼琴"
                          onChange={(e) => setNewSubjectInput(e.target.value)}
                          className="flex-grow bg-white p-1 border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubjectInput.trim()) return;
                            setExamSubjects([...examSubjects, { name: newSubjectInput.trim(), target: "" }]);
                            setNewSubjectInput("");
                          }}
                          className="px-2.5 py-1 bg-purple-600 text-white rounded font-bold"
                        >
                          加
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Vacation configs */}
                {modeFormType === SystemMode.VACATION && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-emerald-800 border-b pb-1 font-sans">🏡 寒暑假假期定存家務項目</h4>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-gray-455">1. 假期類別：</label>
                      <select
                        value={vacationType}
                        onChange={(e) => setVacationType(e.target.value)}
                        className="w-full bg-white rounded-lg p-1.5 border border-gray-200 font-bold"
                      >
                        <option value="暑假">🍉 暑假自主規劃</option>
                        <option value="寒假">🧣 寒假生活計畫</option>
                        <option value="夏令營">🏕 夏令營自我挑戰</option>
                        <option value="冬令營">⛷ 冬令營主題紀律</option>
                        <option value="回外婆家">👵 阿嬤家寄宿生活</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-bold">2. 常駐生活打卡指標 ({vacationDailyTasks.length})：</label>
                      <div className="space-y-1 text-gray-600">
                        {vacationDailyTasks.map((t, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white p-1 rounded border border-gray-100">
                            <span>{t.text}</span>
                            <button
                              type="button"
                              onClick={() => setVacationDailyTasks(vacationDailyTasks.filter(item => item.id !== t.id))}
                              className="text-red-500 hover:text-red-700 px-1 font-bold text-[10px]"
                            >
                              變更
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <input
                          type="text"
                          value={newVacationTask}
                          placeholder="例如：整理房間、慢跑15分..."
                          onChange={(e) => setNewVacationTask(e.target.value)}
                          className="flex-grow bg-white rounded p-1 border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newVacationTask.trim()) return;
                            setVacationDailyTasks([...vacationDailyTasks, { id: `${Date.now()}`, text: newVacationTask.trim() }]);
                            setNewVacationTask("");
                          }}
                          className="bg-emerald-600 text-white rounded font-bold px-3"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Custom config */}
                {modeFormType === SystemMode.CUSTOM && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-indigo-750 border-b pb-1">🎨 專屬自訂家庭時光設定</h4>
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <label className="font-bold w-16 text-gray-500 shrink-0">自訂圖示：</label>
                        <select
                          value={modeFormIcon}
                          onChange={(e) => setModeFormIcon(e.target.value)}
                          className="bg-white rounded-lg p-1 border border-gray-205 font-sans"
                        >
                          <option value="🍼">🍼 新生兒育嬰</option>
                          <option value="🏕">🏕 露營模式</option>
                          <option value="📦">📦 搬家整理</option>
                          <option value="🏃">🏃 體能訓練</option>
                          <option value="💻">💻 遠距辦公</option>
                          <option value="🧹">🧹 大掃除</option>
                          <option value="🛌">🛌 坐月子安胎</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold">自訂小貼士每日清單：</label>
                        <div className="space-y-1">
                          {customTasks.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-1 rounded border border-gray-100">
                              <span>{t.text}</span>
                              <button
                                type="button"
                                onClick={() => setCustomTasks(customTasks.filter(item => item.id !== t.id))}
                                className="text-[#E28F83] hover:text-red-700 hover:underline px-1 text-[10px]"
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
                            placeholder="例如：整理打包2箱..."
                            onChange={(e) => setNewCustomTaskInput(e.target.value)}
                            className="flex-grow bg-white rounded p-1 border border-gray-200 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newCustomTaskInput.trim()) return;
                              setCustomTasks([...customTasks, { id: `${Date.now()}`, text: newCustomTaskInput.trim() }]);
                              setNewCustomTaskInput("");
                            }}
                            className="bg-indigo-600 text-white rounded font-bold px-3 text-[10px]"
                          >
                            加入
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-3.5 border-t border-gray-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModeModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-55/75 border border-gray-200 rounded-xl transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-bold bg-[#7C6354] hover:bg-[#5E4E42] text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1"
                >
                  {isUpdating ? "儲存更新中..." : "確定建立排程 (3秒就緒)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ Custom Cozy Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-100">
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#F2ECE5] p-5 max-w-sm w-full shadow-lg relative flex flex-col font-sans max-h-[85vh] overflow-y-auto pb-[max(20px,env(safe-area-inset-bottom))]">
            <h3 className="text-sm font-black text-[#5C4537] mb-2 border-b border-[#FAF6F0] pb-2 flex items-center gap-1.5">
              <span>⚠️</span> {confirmDialog.title}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-5">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100/60 border border-[#E5E1DA] rounded-xl transition cursor-pointer font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#D98E85] rounded-xl shadow-xs transition active:scale-97 cursor-pointer"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 成員邀請建立成功 Modal */}
      {inviteSuccessData?.isOpen && (
        <div className="fixed inset-0 bg-[#2D2926]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-md w-full shadow-2xl relative flex flex-col font-sans select-none max-h-[85vh] overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]">
            
            <div className="text-center pb-4 border-b border-gray-100">
              <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ✓
              </div>
              <h3 className="text-md font-black text-gray-800">成員邀請建立成功</h3>
              
              <div className="mt-3 bg-[#FCFBF9] border border-dashed border-[#E5E1DA] rounded-xl p-3 inline-block min-w-[200px]">
                <p className="text-sm font-black text-gray-700">{inviteSuccessData.memberName}</p>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  {getRoleChineseName(inviteSuccessData.role)}（{inviteSuccessData.role}）
                </p>
                {inviteSuccessData.email && (
                  <p className="text-[10px] text-[#4A6076] font-mono mt-1 bg-white px-2 py-0.5 rounded border border-gray-150 inline-block font-bold">
                    📧 {inviteSuccessData.email}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex-grow">
              <span className="block text-[11px] font-black text-[#4A6076] mb-1.5 flex items-center gap-1">
                📋 邀請訊息
              </span>
              <textarea
                readOnly
                value={generateInvitationMsg({
                  memberName: inviteSuccessData.memberName,
                  targetRole: inviteSuccessData.role,
                  inviteCode: inviteSuccessData.inviteCode,
                  email: inviteSuccessData.email
                })}
                rows={9}
                className="w-full text-xs font-mono font-medium p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl text-gray-600 focus:outline-none focus:ring-0 select-all leading-relaxed"
              />
            </div>

            <div className="mt-5 flex gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  const msg = generateInvitationMsg({
                    memberName: inviteSuccessData.memberName,
                    targetRole: inviteSuccessData.role,
                    inviteCode: inviteSuccessData.inviteCode,
                    email: inviteSuccessData.email
                  });
                  navigator.clipboard.writeText(msg);
                  toast.success("📋 邀請訊息已成功複製！");
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-97 cursor-pointer flex items-center justify-center gap-2"
              >
                <Copy className="h-4 w-4" />
                <span>複製邀請訊息</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setInviteSuccessData(null);
                }}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
