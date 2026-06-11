import React, { useState, useMemo, useEffect } from "react";
import { UserProfile, UserRole, SystemMode, Task, Redemption, ConfiguredMode, getLocalToday } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, setDoc, doc, deleteDoc } from "firebase/firestore";
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
  }) => Promise<void>;
  onEditMember?: (
    uid: string,
    updatedData: {
      displayName: string;
      role: UserRole;
      birthday?: string;
      color?: string;
      photoURL?: string;
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
}: MembersCenterProps) {
  const [activeMode, setActiveMode] = useState<SystemMode>(systemMode);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

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
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [targetInviteRole, setTargetInviteRole] = useState<"Owner" | "Parent" | "Child" | "Viewer">("Parent");
  const [inviteEmailConstraint, setInviteEmailConstraint] = useState("");
  const [submittingInvite, setSubmittingInvite] = useState(false);

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
      await setDoc(doc(db, "invites", inviteId), {
        id: inviteId,
        familyId,
        familyName,
        inviterUid: currentUser.uid,
        status: "pending",
        targetRole: targetInviteRole,
        inviteCode,
        email: inviteEmailConstraint.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.displayName || currentUser.email || "Owner"
      });
      
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
      toast.error("❌ 生成邀請失敗：" + err.message);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string, code: string) => {
    showConfirm(
      "使邀請碼失效",
      `確認要刪除/使此邀請碼「${code}」失效嗎？刪除後新進者將無法再憑此代碼加入！`,
      async () => {
        try {
          await deleteDoc(doc(db, "invites", inviteId));
          toast.success("✓ 已撤銷該邀請碼");
        } catch (err: any) {
          toast.error("❌ 撤銷失敗：" + err.message);
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
    setDisplayName("");
    setRole(UserRole.KID);
    setBirthday("2015-04-18");
    setColor("#B4C3B2");
    setPhotoURL("✿");
    setShowFormModal(true);
  };

  const handleOpenEdit = (member: UserProfile) => {
    setEditingMember(member);
    setDisplayName(member.displayName);
    setRole(member.role);
    setBirthday(member.birthday || "2015-04-18");
    setColor(member.color || "#B4C3B2");
    setPhotoURL(member.photoURL || "✿");
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSubmittingForm(true);
    try {
      if (editingMember) {
        if (onEditMember) {
          await onEditMember(editingMember.uid, {
            displayName: displayName.trim(),
            role,
            birthday,
            color,
            photoURL,
          });
        }
      } else {
        if (onAddMember) {
          await onAddMember({
            displayName: displayName.trim(),
            role,
            birthday,
            color,
            photoURL,
          });
        }
      }
      setShowFormModal(false);
    } catch (err) {
      console.error(err);
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
      {/* List of Family Members - Full-width single Column */}
      <div className="bg-white rounded-2xl border-0 md:border border-[#E5E1DA] p-3.5 md:p-6 shadow-xs space-y-4 md:space-y-6 font-sans">
        <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 md:h-10 md:w-10 bg-[#F9F8F6] text-[#4A6076] border border-[#E5E1DA] rounded-xl flex items-center justify-center shrink-0">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-black text-[#2D2926] font-sans">家庭成員中心</h2>
              <p className="hidden md:block text-xs text-gray-500 mt-0.5 font-medium">檢視與自訂所有的家庭成員名冊</p>
            </div>
          </div>

          {isParent && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1 text-xs font-black text-white bg-[#4A6076] hover:bg-[#3b4c5e] px-3 py-2 rounded-xl transition cursor-pointer shadow-xs max-h-[38px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新增</span>
            </button>
          )}
        </div>

        {isParent && (
          <div className="flex border-b border-[#FAF9F6] gap-2 mb-2">
            <button
              onClick={() => setMemberSubTab("list")}
              className={`pb-2.5 text-xs font-black border-b-2 transition whitespace-nowrap cursor-pointer px-4 ${
                memberSubTab === "list"
                  ? "border-[#4A6076] text-[#4A6076] font-extrabold"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              👥 家族成員名冊
            </button>
            <button
              onClick={() => setMemberSubTab("invites")}
              className={`pb-2.5 text-xs font-black border-b-2 transition whitespace-nowrap cursor-pointer px-4 relative ${
                memberSubTab === "invites"
                  ? "border-[#4A6076] text-[#4A6076] font-extrabold"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              ✉️ 專屬邀請與審核中心
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-2 h-4 w-4 bg-[#E28F83] text-white font-extrabold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        )}

        {memberSubTab === "list" ? (
          <div className="space-y-4">
            <div className="bg-[#FAF8F4]/80 border border-[#E5E1DA] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs leading-relaxed text-gray-700 font-sans">
            <div>
              <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px] mb-0.5">我的家庭單位</p>
              🏠 <b>家庭名稱：</b> <span className="font-extrabold text-[#4A6076] text-sm">{familyName}</span>
              <div className="mt-1 flex items-center gap-1.5 text-gray-500 font-semibold select-all">
                🔑 行事曆邀請碼：<span className="font-mono text-gray-800 bg-white border border-[#E5E1DA] px-2 py-0.5 rounded text-xs tracking-tight">{familyId}</span>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-xs font-black text-[#4A6076] bg-white border border-[#E5E1DA] hover:bg-[#FAF8F4] px-3.5 py-2 rounded-xl transition cursor-pointer shadow-[1.5px_1.5px_0px_#E5E1DA]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>已複製</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>複製邀請碼</span>
                </>
              )}
            </button>
          </div>

          {/* Pending Join Requests Roster */}
          {pendingRequests && pendingRequests.length > 0 && (currentUser.role as string === "Owner" || currentUser.role as string === "Parent") && (
            <div className="bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-[24px] p-5 mb-6 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⏳</span>
                  <div>
                    <h3 className="text-sm font-black text-amber-900">待核准成員加入申請 ({pendingRequests.length})</h3>
                    <p className="text-[10px] text-amber-700 font-medium">新成員輸入了您家的邀請碼，正在等待您核准加入！</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-amber-100/50">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="py-3 flex flex-row items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                          {req.userName}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold font-mono">({req.userEmail})</span>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        申請關係角色：<span className="font-extrabold">{req.role === UserRole.PARENT ? "家長" : (req.role === UserRole.CHILD || req.role === UserRole.KID ? "小孩" : "一般成員")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (onApproveJoinRequest) await onApproveJoinRequest(req);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition shadow-xs"
                      >
                        ✓ 同意加入
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            "拒絕加入申請",
                            `您確定要拒絕「${req.userName}」的家庭加入申請嗎？`,
                            async () => {
                              if (onRejectJoinRequest) await onRejectJoinRequest(req);
                            }
                          );
                        }}
                        className="bg-[#FFFDFB] hover:bg-gray-50 text-gray-500 border border-gray-200 font-semibold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition"
                      >
                        拒絕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {familyMembers.map((member) => {
              const themeColor = member.color || "#B4C3B2";
              const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT || member.uid === currentUser.uid;
              const avatarTxt = member.displayName ? member.displayName.charAt(0) : "✿";
              
              return (
                <div
                  key={member.uid}
                  onClick={() => handleOpenRecords(member)}
                  style={{ border: "1px solid #E9E2DB" }}
                  className="bg-white rounded-xl px-4 py-2 hover:bg-[#FAF8F4]/30 cursor-pointer flex items-center justify-between gap-3 h-[64px] transition duration-150 select-none"
                >
                  {/* Left: Avatar & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{ backgroundColor: themeColor }}
                      className="h-10 w-10 rounded-full flex items-center justify-center text-md text-[#2D2926] border border-[#E5E1DA] font-black shrink-0 relative animate-none"
                    >
                      {(!member.photoURL || member.photoURL.startsWith("http")) 
                        ? avatarTxt 
                        : member.photoURL}
                      {member.role === UserRole.KID && (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-white rounded-full h-3.5 w-3.5 flex items-center justify-center text-[7.5px] font-bold border border-white">
                          ⭐
                        </span>
                      )}
                    </div>
                    
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-[#2D2926] text-xs truncate">
                          {member.displayName}
                        </h4>
                        {member.uid === currentUser.uid && (
                          <span className="text-[8px] font-bold bg-[#4A6076] text-white px-1.5 py-0.2 rounded select-none scale-90">
                            我
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        身份：{getRoleName(member.role)} {member.role === UserRole.KID ? `• ⭐ ${member.stars || 0} 顆` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Right: edit icon or Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // vital
                          handleOpenEdit(member);
                        }}
                        className="text-gray-400 hover:text-[#4A6076] p-1.5 hover:bg-slate-50 border border-transparent hover:border-[#E5E1DA] rounded-lg transition cursor-pointer"
                        title="編輯成員資料"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200 font-sans text-gray-800">
            {/* 1. Generate Invite Code Block */}
            <div className="bg-[#FCFBF9] border border-[#E5E1DA] rounded-2xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>產製專屬進駐邀請碼 (指定角色 & 帳號限制)</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">產出專用 6 碼的大寫合規邀請碼，受邀者憑此碼註冊將「自動加入並直接開通您所指派的角色權限」</p>
              </div>

              <form onSubmit={handleCreateInviteCode} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white p-4 rounded-xl border border-[#FAF8F4]">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-[#4A6076]">預先賦予角色權限</label>
                  <select
                    value={targetInviteRole}
                    onChange={(e) => setTargetInviteRole(e.target.value as any)}
                    className="w-full text-xs border border-[#E5E1DA] bg-[#F9F8F6] rounded-xl px-3 py-2 cursor-pointer font-bold focus:outline-none"
                  >
                    <option value="Owner">管理員 (Owner)</option>
                    <option value="Parent">家長 (Parent)</option>
                    <option value="Child">孩子 (Child)</option>
                    <option value="Viewer">一般唯讀成員 (Viewer)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-[#4A6076]">限制指定登入 Email (選填)</label>
                  <input
                    type="email"
                    placeholder="不填代表開放任何人凭此代碼加入"
                    value={inviteEmailConstraint}
                    onChange={(e) => setInviteEmailConstraint(e.target.value)}
                    className="w-full text-xs border border-[#E5E1DA] bg-[#F9F8F6] rounded-xl px-3.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#405060]"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="w-full text-xs font-black text-white bg-[#4A6076] hover:bg-[#344658] px-4 py-2.5 rounded-xl transition cursor-pointer select-none"
                  >
                    {submittingInvite ? "產製中..." : "✨ 產製並存檔新進邀請碼"}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Invitation List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                🎫 目前已產製的邀請代碼 ({invites.length})
              </h4>
              
              {loadingInvites ? (
                <div className="text-center py-6 text-xs text-gray-400">正在讀取最新邀請碼...</div>
              ) : invites.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#E5E1DA] rounded-2xl text-xs text-gray-400 font-medium">
                  目前尚無任何有效的進駐邀請碼，請在上方欄位新增加密代碼。
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl bg-white max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FCFBF9] border-b border-[#E5E1DA] text-gray-500 font-bold select-none sticky top-0">
                        <th className="p-3">大寫邀請碼</th>
                        <th className="p-3">目標開通角色</th>
                        <th className="p-3">綁定限定 Email</th>
                        <th className="p-3">產製者</th>
                        <th className="p-3">代碼狀態</th>
                        <th className="p-3 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono font-black text-[#4A6076] flex items-center gap-2">
                            <span>{inv.inviteCode}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(inv.inviteCode);
                                toast.success("✓ 邀請碼已複製至剪貼簿！");
                              }}
                              className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              title="複製"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.targetRole === "Owner" ? "bg-red-50 text-red-600 border border-red-150/40" :
                              inv.targetRole === "Parent" ? "bg-indigo-50 text-indigo-700 border border-indigo-150/40" :
                              inv.targetRole === "Child" ? "bg-amber-50 text-amber-700 border border-amber-150/40" :
                              "bg-slate-50 text-slate-600 border border-slate-150/40"
                            }`}>
                              {inv.targetRole}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-500">{inv.email || "⚠️ 任何人憑此代碼進駐"}</td>
                          <td className="p-3 text-gray-400">{inv.createdBy || "Owner"}</td>
                          <td className="p-3">
                            <span className={`font-semibold ${inv.status === "pending" ? "text-amber-600" : "text-emerald-600"}`}>
                              {inv.status === "pending" ? "⏱️ 待進駐使用" : "✅ 已成功被進駐"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteInvite(inv.id, inv.inviteCode)}
                              className="text-rose-500 hover:text-rose-700 font-bold hover:underline py-1 px-2 text-[10px] cursor-pointer"
                            >
                              撤銷失效
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Pending Register Approvals */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                ⏱️ 待審批進駐的家庭申請 ({pendingRequests.length})
              </h4>
              
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#E5E1DA] rounded-2xl text-xs text-gray-400 font-medium bg-gray-50/40">
                  目前沒有任何待核准的家庭進駐申請（若有人使用通用家庭 ID 申請，將會在此處列出）。
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="flex justify-between items-center text-xs border border-[#E5E1DA] bg-[#FCFBF9] p-4 rounded-xl hover:bg-white transition duration-150">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-[#4A6076] text-sm">{req.userName}</p>
                          <span className="bg-slate-100 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px] transform scale-95">預設：{req.role}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-semibold mt-1 font-mono">Email: {req.userEmail || "未登錄"}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">申請時間：{new Date(req.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onRejectJoinRequest?.(req)}
                          className="px-3 py-1.5 text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition overflow-hidden cursor-pointer"
                        >
                          拒絕
                        </button>
                        <button
                          onClick={() => onApproveJoinRequest?.(req)}
                          className="px-3 py-1.5 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition overflow-hidden cursor-pointer"
                        >
                          同意進駐
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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

                                const dayData = mode.itinerary?.[activeDate] || {
                                  breakfast: "無安排", morning: "無安排", lunch: "無安排",
                                  afternoon: "無安排", dinner: "無安排", night: "無安排",
                                  lodging: "無安排", transport: "無安排", customNotes: ""
                                };

                                return (
                                  <div className="space-y-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-[11px]">
                                    {/* Today Theme & Today Remarks Block */}
                                    <div className="bg-[#FFFDF4] border border-[#F0E6D2] rounded-lg p-2 space-y-2 mb-2">
                                      <div className="text-[10px] text-[#A27B5C] font-black border-b border-[#F0E6D2]/50 pb-1">
                                        📌 今日主題 & 備註提醒
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black flex items-center gap-0.5">
                                          <span>🌴</span> 今日主題：
                                        </label>
                                        <input
                                          type="text"
                                          value={dayData.todayTheme || ""}
                                          disabled={!isParent}
                                          placeholder="例如：放空海灘日、文化探索日..."
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "todayTheme", e.target.value)}
                                          className="w-full bg-white rounded p-1 text-gray-700 border border-[#EAC4A8] focus:border-[#A27B5C] focus:outline-none text-[11px] font-bold"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black flex items-center gap-0.5">
                                          <span>📝</span> 今日備註：
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={dayData.todayRemarks || ""}
                                          disabled={!isParent}
                                          placeholder="例如：14:00 SPA預約、記得帶防蚊液..."
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "todayRemarks", e.target.value)}
                                          className="w-full bg-white rounded p-1 text-gray-700 border border-[#EAC4A8] focus:border-[#A27B5C] focus:outline-none text-[11px] font-semibold resize-none"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-extrabold border-b border-gray-100 pb-1 mb-2">
                                      <span>📅 日期：{activeDate} 當日安排</span>
                                      {activeDate === simulatedTodayDate && (
                                        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded animate-pulse">
                                          ● 模擬今天
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🍳 早餐：</label>
                                        <input
                                          type="text"
                                          value={dayData.breakfast || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "breakfast", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🌅 上午：</label>
                                        <input
                                          type="text"
                                          value={dayData.morning || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "morning", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🍱 午餐：</label>
                                        <input
                                          type="text"
                                          value={dayData.lunch || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "lunch", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🏄 下午：</label>
                                        <input
                                          type="text"
                                          value={dayData.afternoon || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "afternoon", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🍛 晚餐：</label>
                                        <input
                                          type="text"
                                          value={dayData.dinner || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "dinner", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🌃 晚上：</label>
                                        <input
                                          type="text"
                                          value={dayData.night || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "night", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🏠 住宿地區：</label>
                                        <input
                                          type="text"
                                          value={dayData.lodging || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "lodging", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-[#7C6354] font-black">🚲 當日交通公具：</label>
                                        <input
                                          type="text"
                                          value={dayData.transport || ""}
                                          disabled={!isParent}
                                          placeholder="無安排"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "transport", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                        />
                                      </div>
                                      <div className="col-span-2">
                                        <label className="text-[9px] text-[#7C6354] font-black">✍ 備註說明：</label>
                                        <input
                                          type="text"
                                          value={dayData.customNotes || ""}
                                          disabled={!isParent}
                                          placeholder="無備註"
                                          onChange={(e) => handleUpdateExpandedItinerary(mode, activeDate, "customNotes", e.target.value)}
                                          className="w-full bg-gray-50/50 rounded p-1 text-gray-700 border border-gray-200 focus:border-indigo-300 focus:bg-white focus:outline-none font-extrabold"
                                        />
                                      </div>
                                    </div>
                                    {isParent && (
                                      <p className="text-[8px] text-gray-450 text-right font-semibold">
                                        * 行程欄位輸入完成即時自動存檔喔
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
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-sm w-full shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition cursor-pointer animate-none"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-md font-black text-[#2D2926] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500 fill-amber-200" />
              <span>{editingMember ? `編輯家庭成員「${editingMember.displayName}」` : "新增家庭成員名冊"}</span>
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A6076] mb-1">成員姓名</label>
                <input
                  type="text"
                  required
                  placeholder="例如：小華、爸爸、外公"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] focus:outline-none focus:ring-2 focus:ring-[#4A6076]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A6076] mb-1">家庭身份 / 角色</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-2 bg-[#F9F8F6] focus:outline-none focus:ring-2 focus:ring-[#4A6076] cursor-pointer font-sans font-bold text-gray-800"
                >
                  <option value={UserRole.ADMIN}>管理員 (媽媽)</option>
                  <option value={UserRole.PARENT}>家長 (爸爸/媽媽)</option>
                  <option value={UserRole.KID}>小孩</option>
                  <option value={UserRole.MEMBER}>家庭成員</option>
                  <option value={UserRole.PET}>寵物</option>
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
                  className="w-full text-sm border border-[#E5E1DA] rounded-lg px-3 py-1.5 bg-[#F9F8F6] focus:outline-none font-mono text-gray-800 font-bold"
                />
              </div>

              {/* Theme color selectors of beautiful Morandi values */}
              <div>
                <label className="block text-xs font-bold text-[#4A6076] mb-1">專屬代表主題色</label>
                <div className="flex items-center gap-2.5 mt-1">
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
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Symbolic Icon/Avatar selectors */}
              <div>
                <label className="block text-xs font-bold text-[#4A6076] mb-1.5">選擇代表圖示 (手帳簡約風格)</label>
                <div className="grid grid-cols-7 gap-2 mt-1 bg-[#FAF8F4] p-3 rounded-xl border border-[#E5E1DA]">
                  {JAPANESE_SYMBOLS.map((sym) => {
                    const isSelected = photoURL === sym.value;
                    return (
                      <button
                        title={sym.name}
                        type="button"
                        key={sym.value}
                        onClick={() => setPhotoURL(sym.value)}
                        className={`h-9 w-9 text-base flex items-center justify-center rounded-lg border transition-all cursor-pointer select-none ${
                          isSelected ? "bg-white border-[#4A6076] ring-2 ring-[#4A6076]/15 font-bold scale-110 shadow-sm text-gray-800" : "border-[#E5E1DA] hover:bg-gray-50 text-gray-500"
                        }`}
                      >
                        {sym.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-2">
                <div>
                  {editingMember && onDeleteMember && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT) && editingMember.uid !== currentUser.uid ? (
                    <button
                      type="button"
                      onClick={() => {
                        showConfirm(
                          "⚠ 移除家庭成員",
                          `⚠ 確定要將「${editingMember.displayName}」從家庭中完全移除嗎？此對應所有雲端資料與紀錄都將連帶刪除，且無法原復！`,
                          async () => {
                            try {
                              await onDeleteMember(editingMember.uid);
                              setShowFormModal(false);
                            } catch (err: any) {
                              toast.error("刪除失敗：" + err.message);
                            }
                          }
                        );
                      }}
                      className="text-xs font-black text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      移除成員
                    </button>
                  ) : <div />}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#666] hover:bg-[#F1F3F5] border border-[#E5E1DA] rounded-lg transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-4 py-2 text-xs font-black text-white bg-[#4A6076] hover:bg-[#3b4c5e] rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingForm ? "儲存中..." : editingMember ? "儲存修改" : "確認新增"}
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
          <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl relative flex flex-col font-sans">
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
          <div className="bg-white rounded-[24px] border border-gray-100 p-6 max-w-sm w-full shadow-2xl space-y-5 text-center font-sans">
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
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#F2ECE5] p-5 max-w-sm w-full shadow-lg relative flex flex-col font-sans">
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
    </div>
  );
}
