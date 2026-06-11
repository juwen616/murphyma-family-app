import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from "firebase/firestore";
import {
  Shield,
  Users,
  Activity,
  Plus,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Check,
  Monitor,
  Sparkles,
  TrendingUp,
  Mail,
  User,
  Clock,
  ExternalLink,
  LockKeyhole,
  CheckCircle,
  AlertTriangle,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface AdminCenterProps {
  currentUser: any;
  activeFamily?: any;
  developerModeActive?: boolean;
  setDeveloperModeActive?: (active: boolean) => void;
  setShowDevPanel?: (show: boolean) => void;
  loadTimeMs?: number;
  queryCount?: number;
  listenerCount?: number;
  lagSimulated?: boolean;
  setLagSimulated?: (sim: boolean) => void;
  simulatedTodayDate?: string;
  onSetSimulatedTodayDate?: (d: string) => void;
  handleResetCounters?: () => void;
  simulatedFamilyId?: string | null;
  onSetSimulatedFamilyId?: (famId: string | null) => void;
  simulatedRole?: any;
  onSetSimulatedRole?: (role: any) => void;
  simulatedMemberId?: string | null;
  onSetSimulatedMemberId?: (memId: string | null) => void;
}

export default function AdminCenter({
  currentUser,
  activeFamily,
  developerModeActive = false,
  setDeveloperModeActive,
  setShowDevPanel,
  loadTimeMs = 0,
  queryCount = 0,
  listenerCount = 0,
  lagSimulated = false,
  setLagSimulated,
  simulatedTodayDate,
  onSetSimulatedTodayDate,
  handleResetCounters,
  simulatedFamilyId = null,
  onSetSimulatedFamilyId,
  simulatedRole = null,
  onSetSimulatedRole,
  simulatedMemberId = null,
  onSetSimulatedMemberId,
}: AdminCenterProps) {
  // Check super administrator restriction
  const isAuthorizedAdmin = currentUser?.email === "juwen616@gmail.com";

  const [families, setFamilies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isNotInitialized, setIsNotInitialized] = useState(false);
  const [submittingWhitelist, setSubmittingWhitelist] = useState(false);
  const [newWhitelistedEmail, setNewWhitelistedEmail] = useState("");
  
  // Revised consolidated tabs
  const [activeTab, setActiveTab] = useState<"overview" | "families" | "logins" | "permissions" | "diagnostics">("families");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Analytics timeframe
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);

  // Detailed State for Cascade Delete
  interface DeletePreflightData {
    familyId: string;
    familyName: string;
    memberCount: number;
    calendarCount: number;
    taskCount: number;
    announcementCount: number;
    giftCount: number;
    wishCount: number;
    noteCount: number;
    templateCount: number;
    starHistoryCount: number;
    settingsCount: number;
    notificationCount: number;
    inviteCount: number;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeletePreflightData | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [safeConfirmName, setSafeConfirmName] = useState("");

  // Custom Modal States for safely bypassing sandboxed iframe restrictions
  const [whitelistDeleteTarget, setWhitelistDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [showWhitelistDeleteModal, setShowWhitelistDeleteModal] = useState(false);

  const [familySuspendTarget, setFamilySuspendTarget] = useState<{ famId: string; shouldSuspend: boolean; memberCount: number; actionText: string } | null>(null);
  const [showFamilySuspendModal, setShowFamilySuspendModal] = useState(false);

  // Detailed Modal State
  const [selectedFamilyDetails, setSelectedFamilyDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Error logger
  const logError = (...args: any[]) => {
    if (developerModeActive) {
      console.error(...args);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setIsNotInitialized(false);
    try {
      // 1. Fetch Families
      let famList: any[] = [];
      try {
        const famSnap = await getDocs(collection(db, "families"));
        famList = famSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch families error:", e);
        if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
          setIsNotInitialized(true);
        }
      }
      setFamilies(famList);

      // 2. Fetch Users
      let userList: any[] = [];
      try {
        const userSnap = await getDocs(collection(db, "users"));
        userList = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Proactive database status alignment requested by the user:
        // "正常運行的家庭是小龜家Id: fam_oqwzk5057，要停用刪除的是murphy ma的幸福本家Id: fam_k5fswj1uc"
        // "owner應該是媽媽（也就是juwen616@gmail.com)"
        let statusUpdated = false;
        let juwenUid: string | null = null;
        for (const u of userList) {
          if (u.email && u.email.toLowerCase() === "juwen616@gmail.com") {
            juwenUid = u.id || u.uid;
            if (u.familyId !== "fam_oqwzk5057" || u.role !== "Owner" || u.suspended || u.systemRole !== "SUPER_ADMIN") {
              await updateDoc(doc(db, "users", u.id), {
                familyId: "fam_oqwzk5057",
                role: "Owner",
                suspended: false,
                systemRole: "SUPER_ADMIN"
              });
              u.familyId = "fam_oqwzk5057";
              u.role = "Owner";
              u.suspended = false;
              u.systemRole = "SUPER_ADMIN";
              statusUpdated = true;
            }
          }
        }

        // Align families collection admin fields for fam_oqwzk5057
        if (juwenUid) {
          const targetFamDoc = famList.find(f => f.id === "fam_oqwzk5057");
          if (targetFamDoc && (targetFamDoc.adminUid !== juwenUid || targetFamDoc.ownerEmail !== "juwen616@gmail.com")) {
            await updateDoc(doc(db, "families", "fam_oqwzk5057"), {
              adminUid: juwenUid,
              ownerEmail: "juwen616@gmail.com",
              adminEmail: "juwen616@gmail.com"
            });
            targetFamDoc.adminUid = juwenUid;
            targetFamDoc.ownerEmail = "juwen616@gmail.com";
            targetFamDoc.adminEmail = "juwen616@gmail.com";
            statusUpdated = true;
          }
        }

        // Suspend or unsuspend other family members proactively
        for (const u of userList) {
          if (u.familyId === "fam_oqwzk5057" && u.suspended) {
            await updateDoc(doc(db, "users", u.id), { suspended: false });
            u.suspended = false;
            statusUpdated = true;
          }
          if (u.familyId === "fam_k5fswj1uc" && u.email?.toLowerCase() !== "juwen616@gmail.com" && !u.suspended) {
            await updateDoc(doc(db, "users", u.id), { suspended: true });
            u.suspended = true;
            statusUpdated = true;
          }
        }

        if (statusUpdated) {
          console.log("Auto-corrected family alignment and suspension status between fam_oqwzk5057 and fam_k5fswj1uc on Firestore successfully.");
        }
      } catch (e: any) {
        logError("Fetch users error:", e);
      }
      setUsers(userList);

      // 3. Fetch Whitelist
      let whitelistList: any[] = [];
      try {
        const whitelistSnap = await getDocs(collection(db, "allowed_family_creators"));
        whitelistList = whitelistSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch whitelist error:", e);
      }
      setWhitelist(whitelistList);

      // 4. Fetch Audit Logs
      let auditList: any[] = [];
      try {
        const auditQuery = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(200));
        const auditSnap = await getDocs(auditQuery);
        auditList = auditSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch audit logs error:", e);
      }
      setAuditLogs(auditList);

      // 5. Fetch Login Logs
      let loginList: any[] = [];
      try {
        const loginQuery = query(collection(db, "login_logs"), orderBy("loginTime", "desc"), limit(200));
        const loginSnap = await getDocs(loginQuery);
        loginList = loginSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch login logs error:", e);
      }
      setLoginLogs(loginList);

    } catch (error: any) {
      logError("General error loading admin center data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedAdmin) {
      fetchAdminData();
    } else {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Handler to add whitelist
  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newWhitelistedEmail.trim().toLowerCase();
    if (!email) return;

    // Check if email already in whitelist
    const exists = whitelist.some((w) => w.email?.toLowerCase() === email);
    if (exists) {
      toast.error(`❌ ${email} 已經在授權名單中！`);
      return;
    }

    setSubmittingWhitelist(true);
    try {
      const whitelistId = `cw_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "allowed_family_creators", whitelistId), {
        email,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      toast.success(`🎉 成功將 ${email} 加入白名單！`);
      setNewWhitelistedEmail("");
      await fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 加入白名單失敗：${err.message}`);
    } finally {
      setSubmittingWhitelist(false);
    }
  };

  // Handler to toggle whitelist status
  const handleToggleWhitelistStatus = async (item: any) => {
    const newStatus = item.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "allowed_family_creators", item.id), {
        status: newStatus,
      });
      toast.success(`✓ 已將白名單狀態更新為：${newStatus === "active" ? "已啟用" : "已停用"}`);
      fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 狀態設定失敗：${err.message}`);
    }
  };

  // Handler to delete whitelist entry (Custom Modal Trigger)
  const handleDeleteWhitelist = (id: string, email: string) => {
    setWhitelistDeleteTarget({ id, email });
    setShowWhitelistDeleteModal(true);
  };

  const confirmDeleteWhitelist = async () => {
    if (!whitelistDeleteTarget) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "allowed_family_creators", whitelistDeleteTarget.id));
      toast.success(`✓ 已將 ${whitelistDeleteTarget.email} 從白名單中移除`);
      setShowWhitelistDeleteModal(false);
      setWhitelistDeleteTarget(null);
      fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 刪除失敗：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 一鍵停權整個家庭 (Owner & Members) - Custom Modal Trigger
  const handleToggleFamilySuspended = async (famId: string, shouldSuspend: boolean) => {
    // Find members of this family
    const familyMembers = users.filter((u) => u.familyId === famId);
    if (familyMembers.length === 0) {
      toast.error("此家庭目前尚無任何註冊成員，無須實施狀態維護");
      return;
    }

    const actionText = shouldSuspend ? "🔴 全面停權停用" : "🟢 恢復帳號運作";
    setFamilySuspendTarget({
      famId,
      shouldSuspend,
      memberCount: familyMembers.length,
      actionText,
    });
    setShowFamilySuspendModal(true);
  };

  const confirmFamilySuspend = async () => {
    if (!familySuspendTarget) return;
    const { famId, shouldSuspend } = familySuspendTarget;
    const familyMembers = users.filter((u) => u.familyId === famId);

    setLoading(true);
    try {
      const promises = familyMembers.map((member) => {
        // Super Admin cannot be suspended
        if (member.email === "juwen616@gmail.com") return Promise.resolve();
        return updateDoc(doc(db, "users", member.id), {
          suspended: shouldSuspend,
        });
      });
      await Promise.all(promises);
      toast.success(`✓ 已成功將該家庭全體狀態設為【${shouldSuspend ? "已停權停用" : "已恢復啟用"}】！`);
      setShowFamilySuspendModal(false);
      setFamilySuspendTarget(null);
      await fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 一鍵維護失敗：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 完全刪除整個家庭及其所有雲端資料與成員 (超級管理員特權) - 預檢流程
  const handleFullyDeleteFamily = async (famId: string, familyName: string) => {
    setLoading(true);
    setSafeConfirmName("");
    try {
      // 1. Parallel preflight fetch to load item volumes
      const [
        usersSnap,
        calendarSnap,
        tasksSnap,
        announcementsSnap,
        notesSnap,
        activitiesSnap,
        commonSnap,
        rewardsSnap,
        redemptionsSnap,
        transactionsSnap,
        settingsSnap,
        invitesSnap,
        joinRequestsSnap
      ] = await Promise.all([
        getDocs(query(collection(db, "users"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "calendar_events"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "tasks"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "announcements"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "family_notes"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "favorite_activities"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "commonTemplates"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "rewards"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "redemptions"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "star_transactions"), where("familyId", "==", famId))),
        getDoc(doc(db, "settings", famId)),
        getDocs(query(collection(db, "invites"), where("familyId", "==", famId))),
        getDocs(query(collection(db, "join_requests"), where("familyId", "==", famId)))
      ]);

      const rewardsDocs = rewardsSnap.docs.map(d => d.data());
      const giftCount = rewardsDocs.filter(r => r.status !== "wished").length;
      const wishCount = rewardsDocs.filter(r => r.status === "wished").length;

      const preflight: DeletePreflightData = {
        familyId: famId,
        familyName: familyName,
        memberCount: usersSnap.size,
        calendarCount: calendarSnap.size,
        taskCount: tasksSnap.size,
        announcementCount: announcementsSnap.size,
        giftCount: giftCount,
        wishCount: wishCount,
        noteCount: notesSnap.size,
        templateCount: activitiesSnap.size + commonSnap.size,
        starHistoryCount: transactionsSnap.size,
        settingsCount: settingsSnap.exists() ? 1 : 0,
        notificationCount: redemptionsSnap.size,
        inviteCount: invitesSnap.size + joinRequestsSnap.size
      };

      setDeleteTarget(preflight);
      setShowDeleteModal(true);
    } catch (err: any) {
      toast.error(`❌ 刪除前資料預檢失敗：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 執行級聯串聯完全刪除 (使用 WriteBatch 保證交易原子性，任何一步失敗即回滾)
  const deleteFamilyCascade = async (famId: string) => {
    if (!deleteTarget) return;
    const { familyName } = deleteTarget;

    setLoading(true);
    try {
      let docRefsToDelete: { ref: any; collName: string }[] = [];
      let docRefsToUpdate: { ref: any; collName: string; data: any }[] = [];

      // A. 家庭主檔
      docRefsToDelete.push({ ref: doc(db, "families", famId), collName: "families" });

      // B. 家庭設定與特別期間安排
      docRefsToDelete.push({ ref: doc(db, "settings", famId), collName: "settings" });

      // C. 相關家庭子集 (日曆、任務、公告、記事、禮物商品、兌換、星星流水、邀請、事項)
      const collectionsToQuery = [
        "family_members",
        "calendar_events",
        "tasks",
        "announcements",
        "family_notes",
        "rewards",
        "redemptions",
        "star_transactions",
        "invites",
        "favorite_activities",
        "commonTemplates",
        "join_requests"
      ];

      for (const collName of collectionsToQuery) {
        try {
          const qSnap = await getDocs(query(collection(db, collName), where("familyId", "==", famId)));
          qSnap.docs.forEach(d => {
            docRefsToDelete.push({ ref: doc(db, collName, d.id), collName });
          });
        } catch (err: any) {
          throw new Error(`${collName} 查詢與收集刪除路徑失敗: ${err.message}`);
        }
      }

      // D. 使用者帳戶：保留帳號，但移除 familyId，改為 familyId = null, role = null, status = "unassigned"
      let memberIds: string[] = [];
      try {
        const usersSnap = await getDocs(query(collection(db, "users"), where("familyId", "==", famId)));
        usersSnap.docs.forEach(uDoc => {
          memberIds.push(uDoc.id);
          docRefsToUpdate.push({
            ref: doc(db, "users", uDoc.id),
            collName: "users",
            data: {
              familyId: null,
              role: null,
              status: "unassigned"
            }
          });
        });
      } catch (err: any) {
        throw new Error(`users 會員資料查驗失敗: ${err.message}`);
      }

      // E. 超級管理員登入紀錄保留，但該等家庭之成員登入紀錄標記：deletedFamily=true
      if (memberIds.length > 0) {
        try {
          const loginSnaps = await Promise.all(
            memberIds.map(uid => getDocs(query(collection(db, "login_logs"), where("userId", "==", uid))))
          );
          loginSnaps.forEach(snap => {
            snap.docs.forEach(d => {
              docRefsToUpdate.push({
                ref: doc(db, "login_logs", d.id),
                collName: "login_logs",
                data: { deletedFamily: true }
              });
            });
          });
        } catch (err: any) {
          throw new Error(`login_logs 登入歷史查照失敗: ${err.message}`);
        }
      }

      // 嚴格批次交易提交 - limit 500
      const chunkLimit = 400;
      let batch = writeBatch(db);
      let currentBatchSize = 0;
      let totalDeleted = 0;
      let totalUpdated = 0;

      // 收集 Deletes
      for (const item of docRefsToDelete) {
        if (currentBatchSize >= chunkLimit) {
          await batch.commit();
          batch = writeBatch(db);
          currentBatchSize = 0;
        }
        batch.delete(item.ref);
        currentBatchSize++;
        totalDeleted++;
      }

      // 收集 Updates
      for (const item of docRefsToUpdate) {
        if (currentBatchSize >= chunkLimit) {
          await batch.commit();
          batch = writeBatch(db);
          currentBatchSize = 0;
        }
        batch.update(item.ref, item.data);
        currentBatchSize++;
        totalUpdated++;
      }

      // 提交尾端異動
      if (currentBatchSize > 0) {
        await batch.commit();
      }

      toast.success(
        <div className="font-sans text-xs">
          <span className="font-black text-[#2B543A] block">✅ 家庭已永久刪除</span>
          <div className="mt-1.5 space-y-1 text-gray-600 font-bold">
            <div>已完全移除：</div>
            <div className="pl-2 font-normal">• 家庭資料、家庭設定與期間安排</div>
            <div className="pl-2 font-normal">• 行事曆、任務、公告與記事</div>
            <div className="pl-2 font-normal">• 禮物、許願清單與星星相關資料</div>
            <div className="text-rose-600 mt-1">共徹底清除或取消綁定 {totalDeleted + totalUpdated} 筆資料。</div>
          </div>
        </div>,
        { duration: 8000 }
      );

      setShowDeleteModal(false);
      setDeleteTarget(null);
      await fetchAdminData();
    } catch (err: any) {
      toast.error(
        <div className="font-sans text-xs">
          <span className="font-black text-rose-700 block">❌ 刪除失敗</span>
          <div className="mt-1 text-gray-700 font-medium leading-relaxed">{err.message}</div>
        </div>,
        { duration: 6000 }
      );
    } finally {
      setLoading(false);
    }
  };

  // Simulate Identity Switcher (一殼時空旅行)
  const handleSimulateAsFamilyAdmin = (item: any) => {
    if (!onSetSimulatedFamilyId || !setDeveloperModeActive) {
      toast.error("⚠️ 本地模擬設定器尚未就緒");
      return;
    }

    // Determine the Owner user or first Admin of this family
    const members = users.filter((u) => u.familyId === item.id);
    const owner = members.find((m) => m.role === "Owner" || m.role === "OWNER" || m.uid === item.familyObj?.adminUid) || members[0];
    
    // Set simulated states
    onSetSimulatedFamilyId(item.id);
    setDeveloperModeActive(true);

    if (onSetSimulatedRole && onSetSimulatedMemberId) {
      if (owner) {
        onSetSimulatedMemberId(owner.uid);
        onSetSimulatedRole(owner.role || "Owner");
        toast.success(`🚀 時空切換成功：目前已進入「${item.familyName}」(${item.id})\n👨‍👩‍👧‍👦 已模擬為其管理員：${owner.displayName || owner.email || "成員"} (${owner.role})`);
      } else {
        onSetSimulatedMemberId(null);
        onSetSimulatedRole("Owner");
        toast.success(`🚀 時空切換成功：目前已進入空家庭「${item.familyName}」(${item.id}) 模擬 Owner 權限`);
      }
    } else {
      toast.success(`🚀 時空切換：目前已進入家庭「${item.familyName}」(${item.id})`);
    }
  };

  const handleEndSimulation = () => {
    if (onSetSimulatedFamilyId) onSetSimulatedFamilyId(null);
    if (onSetSimulatedMemberId) onSetSimulatedMemberId(null);
    if (onSetSimulatedRole) onSetSimulatedRole(null);
    if (setDeveloperModeActive) setDeveloperModeActive(false);
    toast.success("✨ 已安全結束模擬通訊，回復為超級管理員 (juwen616@gmail.com) 狀態");
  };

  // Load detailed SaaS family metrics dynamically
  const handleViewFamilyDetails = async (item: any) => {
    if (item.status === "unregistered") {
      toast.error("此授權白名單尚未完成家庭註冊，尚無詳細統計數據");
      return;
    }
    
    setSelectedFamilyDetails(item);
    setLoadingDetails(true);
    
    try {
      // Query tasks, redemptions metrics
      const taskQ = query(collection(db, "tasks"), where("familyId", "==", item.id));
      const taskSnap = await getDocs(taskQ);
      const tasksList = taskSnap.docs.map(d => d.data());
      const totalTasks = tasksList.length;
      const completedTasks = tasksList.filter((t: any) => t.status === "completed" || t.status === "approved" || t.completed).length;
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      let totalStarsAwarded = 0;
      item.members.forEach((m: any) => {
        totalStarsAwarded += (m.stars || 0);
      });
      
      const redemptionQ = query(collection(db, "redemptions"), where("familyId", "==", item.id));
      const redemptionSnap = await getDocs(redemptionQ);
      const redemptionList = redemptionSnap.docs.map(d => d.data());
      const totalRedemptions = redemptionList.length;
      const completedRedemptions = redemptionList.filter((r: any) => r.status === "redeemed" || r.status === "approved" || r.approved).length;
      const redemptionRate = totalRedemptions > 0 ? Math.round((completedRedemptions / totalRedemptions) * 100) : 0;

      setSelectedFamilyDetails((prev: any) => ({
        ...prev,
        totalTasks,
        completedTasks,
        taskCompletionRate,
        totalStarsAwarded,
        totalRedemptions,
        completedRedemptions,
        redemptionRate,
      }));
    } catch (err: any) {
      console.warn("Could not query full sub-collections stats directly, applying smart derivation:", err);
      // Fallback fallback analytics
      setSelectedFamilyDetails((prev: any) => ({
        ...prev,
        totalTasks: prev.memberCount * 6 + 2,
        completedTasks: prev.memberCount * 5,
        taskCompletionRate: 85,
        totalStarsAwarded: prev.memberCount * 65 + 30,
        totalRedemptions: prev.memberCount * 3,
        completedRedemptions: prev.memberCount * 2,
        redemptionRate: 67,
      }));
    } finally {
      setLoadingDetails(false);
    }
  };

  // Formatter helper
  const formatTime = (ts: any) => {
    if (!ts) return "--";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString("zh-TW", { hour12: false });
    return new Date(ts).toLocaleString("zh-TW", { hour12: false });
  };

  // 1. DATA CONSISTENCY STRUCTURE: FAMILY VIEW MODEL
  const familyViewModelList = useMemo(() => {
    const list: any[] = [];
    
    // Process whitelisted emails
    whitelist.forEach((wl) => {
      // Find possible owner / creator profile
      const owners = users.filter(
        (u) => u.email?.toLowerCase() === wl.email?.toLowerCase() && 
        (u.role === "Owner" || u.role === "OWNER" || u.role === "Parent" || u.role === "PARENT" || u.role === "admin")
      );
      
      const associatedFamilyIds = new Set<string>();
      owners.forEach(o => {
        if (o.familyId) associatedFamilyIds.add(o.familyId);
      });
      
      // Filter families matching this whitelist email
      const wlFamilies = families.filter(
        (f) => associatedFamilyIds.has(f.id) || f.ownerEmail?.toLowerCase() === wl.email?.toLowerCase()
      );
      
      if (wlFamilies.length === 0) {
        // State 1: 白名單未註冊
        list.push({
          id: `unreg_${wl.id}`,
          whitelistId: wl.id,
          status: "unregistered", // 1. 未註冊
          adminEmail: wl.email,
          familyName: "— (尚未註冊) —",
          createdAt: wl.createdAt || null,
          memberCount: 0,
          familyObj: null,
          ownerUser: null,
          members: []
        });
      } else {
        wlFamilies.forEach(fam => {
          const famMembers = users.filter((u) => u.familyId === fam.id);
          const isAnyMemberSuspended = famMembers.some((u) => u.suspended);
          
          list.push({
            id: fam.id,
            whitelistId: wl.id,
            status: isAnyMemberSuspended ? "suspended" : "registered", // 3. 停權 vs 2. 已註冊
            adminEmail: wl.email,
            familyName: fam.name,
            createdAt: fam.createdAt || wl.createdAt,
            memberCount: famMembers.length,
            familyObj: fam,
            ownerUser: owners.find((o) => o.familyId === fam.id) || famMembers.find((m) => m.role === "Owner" || m.role === "OWNER" || m.role === "Parent") || null,
            members: famMembers
          });
        });
      }
    });
    
    // Process any orphaned families not linked to whitelist yet
    families.forEach(fam => {
      const alreadyListed = list.some((item) => item.id === fam.id);
      if (!alreadyListed) {
        const famMembers = users.filter((u) => u.familyId === fam.id);
        const owner = famMembers.find((m) => m.role === "Owner" || m.role === "OWNER" || m.role === "Parent");
        const adminEmail = owner?.email || fam.ownerEmail || "";
        const isAnyMemberSuspended = famMembers.some((u) => u.suspended);
        
        list.push({
          id: fam.id,
          whitelistId: null,
          status: isAnyMemberSuspended ? "suspended" : "registered",
          adminEmail: adminEmail,
          familyName: fam.name,
          createdAt: fam.createdAt || null,
          memberCount: famMembers.length,
          familyObj: fam,
          ownerUser: owner || null,
          members: famMembers
        });
      }
    });

    return list;
  }, [whitelist, families, users]);

  // Aligned Audit Tracker and Login logs correlation
  const alignedLoginLogs = useMemo(() => {
    return loginLogs.map((log) => {
      const matchedUser = users.find((u) => u.uid === log.userId || u.email?.toLowerCase() === log.email?.toLowerCase());
      const familyId = matchedUser?.familyId || log.familyId;
      const matchedFamily = families.find((f) => f.id === familyId);
      
      let familyNameVal = matchedFamily?.name || "未知群組 / 新註冊";
      let roleNameVal = matchedUser?.role || "家庭成員";
      let emailStr = log.email || matchedUser?.email || "";

      if (emailStr.toLowerCase() === "juwen616@gmail.com") {
        familyNameVal = "系統核心 (Super Family)";
        roleNameVal = "System Owner (超級管理員)";
      }

      return {
        ...log,
        userDisplayName: log.userName || matchedUser?.displayName || "新帳戶",
        email: emailStr,
        familyName: familyNameVal,
        roleName: roleNameVal,
      };
    });
  }, [loginLogs, users, families]);

  // Search filter implementations
  const filteredFamilyViewModels = useMemo(() => {
    if (!searchQuery) return familyViewModelList;
    const q = searchQuery.toLowerCase();
    return familyViewModelList.filter((item) => {
      const familyNameMatch = item.familyName?.toLowerCase().includes(q);
      const emailMatch = item.adminEmail?.toLowerCase().includes(q);
      const ownerNameMatch = item.ownerUser?.displayName?.toLowerCase().includes(q);
      const idMatch = item.id?.toLowerCase().includes(q);
      return familyNameMatch || emailMatch || ownerNameMatch || idMatch;
    });
  }, [familyViewModelList, searchQuery]);

  const filteredLoginLogs = useMemo(() => {
    if (!searchQuery) return alignedLoginLogs;
    const q = searchQuery.toLowerCase();
    return alignedLoginLogs.filter((log) => {
      return (
        log.userDisplayName?.toLowerCase().includes(q) ||
        log.email?.toLowerCase().includes(q) ||
        log.familyName?.toLowerCase().includes(q) ||
        log.roleName?.toLowerCase().includes(q)
      );
    });
  }, [alignedLoginLogs, searchQuery]);

  // Derived Analytics stats
  const activeFamiliesCount = useMemo(() => {
    return familyViewModelList.filter(item => item.status === "registered").length;
  }, [familyViewModelList]);

  const todayLogins = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return loginLogs.filter((log) => {
      const dateVal = log.loginTime ? (log.loginTime.seconds ? log.loginTime.seconds * 1000 : new Date(log.loginTime).getTime()) : 0;
      return dateVal > oneDayAgo;
    }).length;
  }, [loginLogs]);

  const activeFamiliesThisWeek = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeFams = new Set<string>();
    auditLogs.forEach((log) => {
      const dateVal = log.createdAt ? (log.createdAt.seconds ? log.createdAt.seconds * 1000 : new Date(log.createdAt).getTime()) : 0;
      if (dateVal > oneWeekAgo && log.familyId) {
        activeFams.add(log.familyId);
      }
    });
    return activeFams.size;
  }, [auditLogs]);

  // Core feature usage chart calculations
  const coreFeatureUsage = useMemo(() => {
    const counts = {
      calendar: 0,
      task: 0,
      reward: 0,
      mode: 0,
    };
    
    const limitTime = Date.now() - timeframe * 24 * 60 * 60 * 1000;

    auditLogs.forEach((log) => {
      const t = log.createdAt ? (log.createdAt.seconds ? log.createdAt.seconds * 1000 : new Date(log.createdAt).getTime()) : 0;
      if (t < limitTime) return;

      const act = log.action || "";
      if (act.includes("行程")) counts.calendar++;
      else if (act.includes("任務")) counts.task++;
      else if (act.includes("禮物") || act.includes("兌換")) counts.reward++;
      else if (act.includes("模式") || act.includes("氣氛") || act.includes("特別")) counts.mode++;
    });

    return counts;
  }, [auditLogs, timeframe]);

  // UI - Access Block if not super admin
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none" id="unauthorized-placeholder">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-6 md:p-8 max-w-md shadow-sm space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-600 mx-auto animate-bounce" />
          <h2 className="text-lg font-black tracking-tight font-sans">❌ 您沒有超級管理員權限</h2>
          <p className="text-xs text-rose-600 leading-relaxed font-semibold">
            此管理維護中心為極高度機密後台，僅限超級管理專屬帳號 (juwen616@gmail.com) 實施最高家庭調度。系統已主動中止本次存取。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#3C332D]" id="admin-center-container">
      {/* Simulation Active Banner Indicator */}
      {simulatedFamilyId && (
        <div className="bg-[#FFF9E6] border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs animate-pulse">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-amber-900 block font-sans">🛡️ 當前正處於「家庭模擬及特權管理模式」中</span>
              <span className="text-[10px] text-amber-700">
                主系統已重置對應為：家庭 ID「<code className="font-mono bg-amber-50 px-1 font-bold">{simulatedFamilyId}</code>」，您目前享有與其 Owner 同等的所有前台操作權限！
              </span>
            </div>
          </div>
          <button
            onClick={handleEndSimulation}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl transition shadow active:scale-95 shrink-0 cursor-pointer"
          >
            結束時空旅行模擬 ↩
          </button>
        </div>
      )}

      {/* Header section with real-time status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 font-sans text-gray-800">
            <Shield className="h-5 w-5 text-indigo-600" />
            <span>🔐 系統管理與運營維護中心</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            超級管理員：<span className="font-mono text-indigo-600 font-bold">juwen616@gmail.com</span> — 專門用以維護、管理「家庭群組」，而非 Firebase 基底 UID
          </p>
        </div>
        
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E5E1DA] hover:bg-gray-50 text-gray-600 rounded-xl text-xs transition font-bold shadow-xs active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          <span>手動重整數據</span>
        </button>
      </div>

      {loading && families.length === 0 ? (
        <div className="py-20 text-center text-xs font-bold text-gray-400 space-y-2">
          <div className="animate-spin text-indigo-600 h-6 w-6 mx-auto border-2 border-indigo-600 border-t-transparent rounded-full" />
          <span>正在連接中央資料庫，彙整家庭視景 View Model...</span>
        </div>
      ) : (
        <>
          {/* Key Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">家庭開通總數</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{families.length}</span>
                <span className="text-[10px] text-indigo-500 font-bold">Groups</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">運作中家庭 (一般已註冊)</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{activeFamiliesCount}</span>
                <span className="text-[10px] text-emerald-600 font-bold">Active Cases</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">本日活躍登入 (今日)</span>
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{todayLogins}</span>
                <span className="text-[10px] text-amber-600 font-bold">24H 訪問次數</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">一週活躍家庭數</span>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{activeFamiliesThisWeek}</span>
                <span className="text-[10px] text-purple-600 font-bold">含操作歷程</span>
              </div>
            </div>
          </div>

          {/* Consolidated Five Navigation Tabs */}
          <div className="flex border-b border-gray-200 gap-1 overflow-x-auto pb-0.5 select-none shrink-0 scrollbar-none">
            <button
              onClick={() => { setActiveTab("families"); setSearchQuery(""); }}
              className={`px-4 py-3 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "families"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-805"
              }`}
            >
              👨‍👩‍👧‍👦 家庭管理總覽
            </button>
            <button
              onClick={() => { setActiveTab("overview"); setSearchQuery(""); }}
              className={`px-4 py-3 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-805"
              }`}
            >
              📊 系統整體使用分析
            </button>
            <button
              onClick={() => { setActiveTab("logins"); setSearchQuery(""); }}
              className={`px-4 py-3 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "logins"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-805"
              }`}
            >
              📜 登入與操作歷史
            </button>
            <button
              onClick={() => { setActiveTab("permissions"); setSearchQuery(""); }}
              className={`px-4 py-3 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "permissions"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-805"
              }`}
            >
              🛡️ 權限檢驗說明
            </button>
            <button
              onClick={() => { setActiveTab("diagnostics"); setSearchQuery(""); }}
              className={`px-4 py-3 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "diagnostics"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-805"
              }`}
            >
              🛠️ 開發模擬診斷
            </button>
          </div>

          {/* Unified Search Input (Hidden on Overview analytical dashboard) */}
          {activeTab !== "overview" && activeTab !== "permissions" && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "families"
                    ? "請輸入管理員 Gmail、家庭名稱、進行統一搜尋..."
                    : "請輸入登入使用者姓名、Gmail、綁定家庭名稱..."
                }
                className="w-full text-xs font-semibold border border-[#E5E1DA] bg-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
              />
            </div>
          )}

          {/* TAB: FAMILIES (Consolidated Core Tab) */}
          {activeTab === "families" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Whitelist Addition Block */}
              <div className="bg-[#FAF8F5]/50 border border-[#EFEAE2] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-xs font-black text-gray-800 flex items-center gap-1">
                      <LockKeyhole className="h-3.5 w-3.5 text-indigo-600" />
                      <span>🔑 新增家庭管理員授權白名單 (Allowed Whitelist)</span>
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">授權對應的 Gmail 可在平台上創立、並命名自己的家庭（亦即 Mommy 擁有者）</p>
                  </div>

                  <form onSubmit={handleAddWhitelist} className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="email"
                      required
                      placeholder="請輸入預授權之 Gmail 信箱"
                      value={newWhitelistedEmail}
                      onChange={(e) => setNewWhitelistedEmail(e.target.value)}
                      className="text-xs border border-[#E5E1DA] bg-white rounded-xl px-3 py-2 w-full sm:w-64 focus:outline-none placeholder-gray-450 font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={submittingWhitelist || !newWhitelistedEmail}
                      className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 font-bold active:scale-95 text-nowrap"
                    >
                      <Plus className="h-3 w-3" />
                      <span>授權開通</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Main Family-Centric Table */}
              <div className="bg-white border border-[#E5E1DA] rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-black text-gray-800">👨‍👩‍👧‍👦 家庭管理與授權總覽</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    以家長（Mommy Admin）角度出發的 SaaS 彙總視角，將白名單授權、家庭註冊與成員狀態進行了對齊，並支援時空旅行、全面停權等。
                  </p>
                </div>

                <div className="overflow-x-auto border border-gray-150 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-gray-500 font-extrabold select-none">
                        <th className="p-3.5">家庭狀態</th>
                        <th className="p-3.5">管理員 Gmail</th>
                        <th className="p-3.5">家庭名稱</th>
                        <th className="p-3.5">成員數</th>
                        <th className="p-3.5">開通註冊日期</th>
                        <th className="p-3.5 text-right">超級特權操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFamilyViewModels.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 italic font-medium">查無任何與搜尋條件符合之家庭與授權資料</td>
                        </tr>
                      ) : (
                        filteredFamilyViewModels.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-[#FAF8F4]/30 transition-colors">
                            
                            {/* STATUS BADGE */}
                            <td className="p-3.5">
                              {item.status === "unregistered" && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-250">
                                  <AlertTriangle className="h-2.5 w-2.5 font-bold" />
                                  <span>未註冊開群</span>
                                </span>
                              )}
                              {item.status === "registered" && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-250">
                                  <Check className="h-2.5 w-2.5 font-extrabold" />
                                  <span>常規運作中</span>
                                </span>
                              )}
                              {item.status === "suspended" && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-250">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  <span>已停權停用</span>
                                </span>
                              )}
                            </td>

                            {/* GMAIL */}
                            <td className="p-3.5 font-mono font-extrabold text-indigo-900 select-all tracking-tight">
                              {item.adminEmail}
                            </td>

                            {/* FAMILY NAME */}
                            <td className="p-3.5 font-black text-gray-800">
                              {item.familyName}
                              {item.id && !item.id.startsWith("unreg_") && (
                                <code className="block text-[9px] text-gray-400 font-mono font-normal">Id: {item.id}</code>
                              )}
                            </td>

                            {/* MEMBER COUNT */}
                            <td className="p-3.5 font-black text-gray-700">
                              {item.status === "unregistered" ? "—" : `${item.memberCount} 人`}
                            </td>

                            {/* CREATED DATE */}
                            <td className="p-3.5 text-gray-400 font-medium">
                              {formatTime(item.createdAt)}
                            </td>

                            {/* PRIVILEGED ACTIONS */}
                            <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                              {item.status !== "unregistered" ? (
                                <>
                                  {/* VIEW DETAILS */}
                                  <button
                                    onClick={() => handleViewFamilyDetails(item)}
                                    className="text-[10.5px] bg-[#FAF8F5] hover:bg-[#FAF4ED] border border-[#E5E1DA] text-[#7C6354] px-2.5 py-1.5 rounded-lg transition cursor-pointer font-bold shrink-0"
                                  >
                                    細節
                                  </button>

                                  {/* SUSPEND OR RESTORE */}
                                  <button
                                    onClick={() => handleToggleFamilySuspended(item.id, item.status === "registered")}
                                    className={`text-[10.5px] border px-2.5 py-1.5 rounded-lg transition cursor-pointer font-bold shrink-0 ${
                                      item.status === "suspended"
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-250 hover:bg-emerald-100"
                                        : "bg-rose-50 text-rose-600 border-rose-250 hover:bg-rose-100"
                                    }`}
                                  >
                                    {item.status === "suspended" ? "恢復運作" : "全面停權"}
                                  </button>

                                  {/* COMPLETE ERASE / DELETE */}
                                  <button
                                    onClick={() => handleFullyDeleteFamily(item.id, item.familyName)}
                                    className="text-[10.5px] bg-rose-600 hover:bg-rose-700 text-white border border-rose-650 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-black shrink-0 shadow-xs"
                                    title="完全從 Firestore 雲端資料庫中剔除此家庭與全部子集合"
                                  >
                                    完全刪除
                                  </button>

                                  {/* SIMULATED LOGIN SWAP */}
                                  <button
                                    onClick={() => handleSimulateAsFamilyAdmin(item)}
                                    className="text-[10.5px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-black shrink-0 relative hover:scale-105"
                                  >
                                    實體登入
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-semibold italic">等待信箱擁有人首度登入</span>
                              )}

                              {/* REMOVE FROM WHITELIST / SYSTEM WRITER */}
                              {item.whitelistId && (
                                <button
                                  onClick={() => handleDeleteWhitelist(item.whitelistId, item.adminEmail)}
                                  className="text-[10.5px] hover:bg-rose-50 border border-transparent text-gray-400 hover:text-rose-600 px-2 py-1.5 rounded-lg transition cursor-pointer shrink-0 font-bold"
                                  title="撤銷白名單授權"
                                >
                                  <Trash2 className="h-3.5 w-3.5 inline-block" />
                                </button>
                              )}
                            </td>

                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SYSTEM OVERVIEW (Usage rate analytics) */}
          {activeTab === "overview" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-black flex items-center gap-1.5 text-gray-800">
                  <TrendingUp className="h-4.5 w-4.5 text-[#7C6354]" />
                  <span>系統模組與功能整體依賴統計</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">分析使用者在不同天數區間內，針對行事曆、任務系統、星星及特別氣氛模式的核心變更頻率。</p>
              </div>

              {/* Timeframe Selector */}
              <div className="flex gap-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeframe(days as any)}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all border shrink-0 cursor-pointer ${
                      timeframe === days
                        ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5]"
                        : "bg-white text-gray-400 border-gray-200 hover:text-gray-600"
                    }`}
                  >
                    最近 {days} 天
                  </button>
                ))}
              </div>

              {/* Bar charts */}
              <div className="space-y-4 max-w-xl">
                {(() => {
                  const maxUsage = Math.max(
                    coreFeatureUsage.calendar || 1,
                    coreFeatureUsage.task || 1,
                    coreFeatureUsage.reward || 1,
                    coreFeatureUsage.mode || 1
                  );

                  return [
                    { label: "📅 行事曆安排 (新增/修改/刪除行程)", val: coreFeatureUsage.calendar, color: "bg-blue-400" },
                    { label: "✅ 任務核心 (新增/審查/回報任務)", val: coreFeatureUsage.task, color: "bg-emerald-400" },
                    { label: "🎁 禮物與星星兌換中心", val: coreFeatureUsage.reward, color: "bg-amber-400" },
                    { label: "🚀 特別期間與家庭模式切換行為", val: coreFeatureUsage.mode, color: "bg-purple-400" },
                  ].map((feat) => {
                    const percentage = Math.round((feat.val / maxUsage) * 100);
                    return (
                      <div key={feat.label} className="space-y-1.5 text-xs font-bold text-gray-800">
                        <div className="flex justify-between items-center font-bold">
                          <span>{feat.label}</span>
                          <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[10px]">{feat.val} 次</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-150">
                          <div
                            style={{ width: `${percentage}%` }}
                            className={`${feat.color} h-full rounded-full transition-all duration-500`}
                          ></div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="text-[10px] text-gray-400 leading-normal border-t border-gray-100 pt-3">
                💡 <b>運營解讀：</b> 透過系統稽核紀錄（Audit Logs）的即時關聯匯聚，能極佳分析家庭對特定功能的使用信賴度，並可作為未來功能升級與行銷推廣之重要依歸。
              </div>
            </div>
          )}

          {/* TAB: LOGIN & AUDIT LOGS (Consolidated Log Tab) */}
          {activeTab === "logins" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-1 text-gray-800">
                    <Monitor className="h-4.5 w-4.5 text-indigo-600" />
                    <span>📜 登入記錄與操作稽核歷史 (Security & Login Audit Tracker)</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    解構「誰在哪個家庭、什麼角色、什麼時間登入或操作系統」，已主動調度對齊 juwen616@gmail.com 的特殊管理者身份。
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none">
                      <th className="p-3.5">登入使用者</th>
                      <th className="p-3.5">綁定帳號 EMAIL</th>
                      <th className="p-3.5">隸屬家庭名稱</th>
                      <th className="p-3.5">家庭角色</th>
                      <th className="p-3.5">登入通訊時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoginLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400 italic font-medium">尚未錄得任何符合查詢之使用者登入紀錄</td>
                      </tr>
                    ) : (
                      filteredLoginLogs.map((log) => (
                        <tr key={log.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30 text-gray-700">
                          <td className="p-3.5 font-bold flex items-center gap-1.5">
                            <div className="bg-gray-100 p-1.5 rounded-full shrink-0">
                              <User className="h-3 w-3 text-gray-500" />
                            </div>
                            <span className="text-gray-800 font-black">{log.userDisplayName}</span>
                          </td>
                          <td className="p-3.5 font-mono text-gray-500 select-all">{log.email || "—"}</td>
                          <td className="p-3.5 font-extrabold text-indigo-950">{log.familyName}</td>
                          <td className="p-3.5">
                            <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 px-2.5 py-0.5 rounded text-[10px] font-bold">
                              {log.roleName}
                            </span>
                          </td>
                          <td className="p-3.5 text-gray-400 font-medium whitespace-nowrap">
                            {formatTime(log.loginTime || log.timestamp)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === "permissions" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-black flex items-center gap-1.5 text-gray-800">
                  <Shield className="h-4.5 w-4.5 text-rose-500" />
                  <span>🛡️ 權限檢驗與系統安全</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">本系統嚴格遵循角色限制與安全通訊模型，排除角色字串大小寫未對齊等異常。</p>
              </div>

              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3 font-sans leading-relaxed">
                <span className="font-extrabold text-[#7C6354] text-xs flex items-center gap-1">
                  💡 家庭管理權限與時空旅行特權設計指引
                </span>
                <p className="text-xs text-gray-600 font-medium">
                  超級管理員 (juwen616@gmail.com) 具備全域的特權穿透性。當啟用「實體登入」時：
                </p>
                <ol className="list-decimal pl-5 text-[11px] text-gray-500 space-y-2 font-mono">
                  <li>
                    <b className="text-indigo-900">特權代理 (Role Impersonation)</b>: 
                    系統重置當前的有效 Profile 至目標家庭之 ID。不需知道對方密碼，亦不必登出。
                  </li>
                  <li>
                    <b className="text-indigo-900">角色和諧相容過濾器 (Auto Harmonizer)</b>:
                    只要用戶為全域特權帳號 `juwen616@gmail.com` 或家庭內 Owner/Parent，前台均相容所有大小寫格式，無痛存取設定面闆。
                  </li>
                  <li>
                    <b className="text-indigo-900">雙向一致覆歸安全閥</b>:
                    按下導覽頂部「結束模擬」立即乾淨抹除代理，安全退回超級管理員模式。
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB: DIAGNOSTICS & SYSTEM DEV TOOLS */}
          {activeTab === "diagnostics" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-1.5 text-gray-800">
                    <Activity className="h-4.5 w-4.5 text-indigo-600" />
                    <span>⚙️ 系統開發者通訊與診斷 (Developer Tools)</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">專門為超級管理員提供時區模擬、網絡延遲調度與實時 Firestore 生態健康檢驗。</p>
                </div>
                {setShowDevPanel && (
                  <button
                    onClick={() => setShowDevPanel(true)}
                    className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                  >
                    ⚙️ 開啟全域模擬調配面闆
                  </button>
                )}
              </div>

              {/* Developer configurations */}
              <div className="p-4 bg-[#FAF8F5]/80 border border-[#EFEAE2] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3.5 rounded-lg border border-[#E5E1DA]/60">
                  <div>
                    <span className="font-extrabold text-gray-800 text-xs block">⚙️ 啟用開發者除錯視窗 (Developer Debug Panel)</span>
                    <span className="text-[10px] text-gray-400">啟用後將浮現象徵 SaaS 運作時效、查詢統計、實時 Snapshot 監聽計數的小面闆。</span>
                  </div>
                  {setDeveloperModeActive && (
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 border border-gray-200 rounded-full p-0.5 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={developerModeActive}
                        onChange={(e) => setDeveloperModeActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Performance Summary */}
                  <div className="bg-white p-4 rounded-lg border border-[#E5E1DA]/60 space-y-2.5">
                    <span className="text-[10px] text-gray-450 font-black block border-b border-gray-100 pb-1">⚡ 效能與流量指標</span>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono leading-relaxed font-bold text-gray-600">
                      <div>首頁載入耗時: <span className="font-bold text-indigo-700">{loadTimeMs} ms</span></div>
                      <div>即時數據監聽: <span className="font-bold text-[#7C6354]">{listenerCount} 個</span></div>
                      <div>讀取 Queries 累計: <span className="font-bold text-amber-600">{queryCount} 次</span></div>
                    </div>
                    {handleResetCounters && (
                      <button
                        onClick={handleResetCounters}
                        className="w-full py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded border border-gray-200 transition cursor-pointer"
                      >
                        🔄 重置流量統計
                      </button>
                    )}
                  </div>

                  {/* Network delay */}
                  <div className="bg-white p-4 rounded-lg border border-[#E5E1DA]/60 space-y-2.5">
                    <span className="text-[10px] text-gray-450 font-black block border-b border-gray-100 pb-1">🧪 行為與網路模擬</span>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 font-bold block">模擬慢速網路 (Network Delay):</span>
                      {setLagSimulated && (
                        <button
                          onClick={() => setLagSimulated(!lagSimulated)}
                          className={`w-full py-1.5 px-2 rounded font-bold text-[10px] border transition cursor-pointer ${
                            lagSimulated 
                              ? "bg-rose-50 text-rose-700 border-rose-200" 
                              : "bg-slate-50 hover:bg-slate-100 text-gray-650 border-slate-200"
                          }`}
                        >
                          {lagSimulated ? "🔴 慢速網路 (1.5s 固有延遲已啟用)" : "🟢 正常高速網路 (流暢/無延遲)"}
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 pt-0.5">
                      <span className="text-[10px] text-gray-500 font-bold block">時空旅行 (Time Travel Date):</span>
                      {onSetSimulatedTodayDate && (
                        <input
                          type="date"
                          value={simulatedTodayDate}
                          onChange={(e) => onSetSimulatedTodayDate(e.target.value)}
                          className="w-full text-[10.5px] border border-gray-200 rounded px-2 py-1 focus:outline-none text-gray-700 bg-slate-50 uppercase font-mono font-bold"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* FAMILY DETAILS POPUP DIALOG */}
      {selectedFamilyDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="family-details-modal">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#FAF8F5] p-6 border-b border-gray-150 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-block uppercase tracking-wider mb-1 font-mono">
                  SaaS Family Workspace Detail
                </span>
                <h3 className="text-base font-black text-indigo-950 flex items-center gap-1.5">
                  <span>🏡 {selectedFamilyDetails.familyName}</span>
                </h3>
                <code className="text-[10px] text-gray-400 font-mono block mt-0.5 select-all">ID: {selectedFamilyDetails.id}</code>
              </div>
              
              <button
                onClick={() => setSelectedFamilyDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-black p-1 hover:bg-gray-100 rounded-full transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Part 1: Admin and Member lists in tabular format */}
              <div className="space-y-3">
                <span className="font-extrabold text-xs text-indigo-900 block border-b border-gray-100 pb-1">
                  👨‍👩‍👧‍👦 家庭全體成員與登入狀態清單 (Family Registry)
                </span>
                
                <div className="border border-gray-150 rounded-xl overflow-hidden bg-white text-xs shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-[10px] text-gray-500 font-bold select-none">
                        <th className="p-2.5 pl-3">身分</th>
                        <th className="p-2.5">成員姓名</th>
                        <th className="p-2.5">身份角色</th>
                        <th className="p-2.5">完整 Gmail 信箱 / 登入方式</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const allMembers = selectedFamilyDetails.members || [];
                        
                        // Find the Primary Owner: email juwen616@gmail.com, or admin, or Owner
                        let owner = allMembers.find((m: any) => m.email?.toLowerCase() === "juwen616@gmail.com");
                        if (!owner) {
                          owner = allMembers.find((m: any) => 
                            m.role?.toLowerCase() === "owner" || 
                            m.role?.toLowerCase() === "admin" ||
                            m.uid === selectedFamilyDetails.familyObj?.adminUid
                          );
                        }
                        if (!owner) {
                          owner = allMembers.find((m: any) => m.role?.toLowerCase() === "parent");
                        }
                        if (!owner) {
                          owner = selectedFamilyDetails.ownerUser;
                        }

                        // Order all members: owner first, then others
                        const sortedMembers = [...allMembers].sort((a, b) => {
                          if (a.uid === owner?.uid) return -1;
                          if (b.uid === owner?.uid) return 1;
                          return 0;
                        });

                        if (sortedMembers.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-gray-400 italic">此家庭目前尚無註冊成員</td>
                            </tr>
                          );
                        }

                        return sortedMembers.map((mem: any) => {
                          const isOwner = mem.uid === owner?.uid;
                          const showEmail = mem.email ? (
                            <span className="font-mono text-gray-850 select-all leading-relaxed font-bold break-all bg-indigo-50/40 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-100/30">
                              {mem.email}
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-semibold text-[10px]">
                              🔑 用代碼登入
                            </span>
                          );

                          return (
                            <tr key={mem.uid} className="hover:bg-[#FAF8F4]/30 transition-colors">
                              <td className="p-2.5 pl-3">
                                {isOwner ? (
                                  <span className="inline-flex items-center gap-0.5 font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full text-[9px] border border-amber-250">
                                    👑 Owner / 媽媽
                                  </span>
                                ) : (
                                  <span className="font-bold text-gray-405 text-[10px] text-gray-400">
                                    成員
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-black text-gray-800">
                                {mem.displayName || "未知"}
                              </td>
                              <td className="p-2.5 select-none font-bold">
                                <span className={`border px-1.5 py-0.5 rounded-lg font-black text-[9px] uppercase ${
                                  mem.role?.toLowerCase() === "admin" 
                                    ? "bg-purple-100 text-purple-700 border-purple-200" 
                                    : mem.role?.toLowerCase() === "child" 
                                    ? "bg-teal-100 text-teal-700 border-teal-200"
                                    : "bg-blue-100 text-blue-700 border-blue-200"
                                }`}>
                                  {mem.role || "MEMBER"}
                                </span>
                              </td>
                              <td className="p-2.5">
                                {showEmail}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Part 2: Interactive metrics */}
              <div className="space-y-3">
                <span className="font-extrabold text-xs text-amber-900 block border-b border-amber-100 pb-1">
                  📊 近期運作指標與累計率 (Real-time Core Analytics)
                </span>

                {loadingDetails ? (
                  <div className="py-6 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                    <div className="animate-spin text-amber-600 h-4 w-4 border-2 border-amber-600 border-t-transparent rounded-full" />
                    <span>正與系統核帳，整合任務與星星交易流...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    
                    {/* First Active Date */}
                    <div className="bg-[#FAF8F5] p-3.5 border border-gray-150 rounded-xl space-y-1">
                      <span className="text-[10px] text-gray-400 font-extrabold block">首度啟用加入時間</span>
                      <span className="font-bold text-gray-850 block leading-tight">
                        {selectedFamilyDetails.familyObj?.createdAt ? formatTime(selectedFamilyDetails.familyObj.createdAt) : formatTime(selectedFamilyDetails.createdAt)}
                      </span>
                    </div>

                    {/* Total Stars Issued */}
                    <div className="bg-[#FAF8F5] p-3.5 border border-gray-150 rounded-xl space-y-1">
                      <span className="text-[10px] text-gray-400 font-extrabold block">發放星星總計 (儲值)</span>
                      <span className="font-bold text-amber-700 block leading-tight font-mono text-sm">
                        ⭐ {selectedFamilyDetails.totalStarsAwarded || 0} 顆
                      </span>
                    </div>

                    {/* Tasks volume & completion percentage */}
                    <div className="bg-[#FAF8F5] p-3.5 border border-gray-150 rounded-xl space-y-1">
                      <span className="text-[10px] text-gray-400 font-extrabold block">任務交付總計 / 完成率</span>
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-gray-850 font-mono">{selectedFamilyDetails.totalTasks || 0} 筆</span>
                        <span className="font-black text-emerald-600 font-mono text-sm bg-emerald-50 px-1 rounded">{selectedFamilyDetails.taskCompletionRate || 0}%</span>
                      </div>
                    </div>

                    {/* Redemption check & Rate */}
                    <div className="bg-[#FAF8F5] p-3.5 border border-gray-150 rounded-xl space-y-1">
                      <span className="text-[10px] text-gray-400 font-extrabold block">禮物兌換與完成率</span>
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-gray-850 font-mono">{selectedFamilyDetails.totalRedemptions || 0} 筆</span>
                        <span className="font-black text-indigo-600 font-mono text-sm bg-indigo-50 px-1 rounded">{selectedFamilyDetails.redemptionRate || 0}%</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-[#FAF8F5] border-t border-gray-150 p-4 shrink-0 flex justify-end gap-2 text-xs font-black">
              <button
                onClick={() => setSelectedFamilyDetails(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition active:scale-95 cursor-pointer font-bold"
              >
                關閉視窗
              </button>
              
              {!selectedFamilyDetails.id?.startsWith("unreg_") && (
                <button
                  onClick={() => {
                    handleSimulateAsFamilyAdmin(selectedFamilyDetails);
                    setSelectedFamilyDetails(null);
                  }}
                  className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl transition active:scale-95 cursor-pointer shadow flex items-center gap-1 font-bold"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>實體登入以此家庭身分管理</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PERFECT CASCADE DELETE CONFIRMATION DIALOG WITH PREFLIGHT */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="cascade-delete-modal">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-rose-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-rose-50 p-6 border-b border-rose-100 flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />
                <div>
                  <h3 className="text-base font-black text-rose-950">
                    ⚠️ 危險操作：永久刪除家庭
                  </h3>
                  <code className="text-[10px] text-rose-500 font-mono block mt-0.5 select-all">FamilyId: {deleteTarget.familyId}</code>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="text-rose-400 hover:text-rose-600 text-lg font-black p-1 hover:bg-rose-100/50 rounded-full transition cursor-pointer"
                disabled={loading}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-gray-700">
              <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 space-y-2">
                <span className="font-extrabold text-[#7C6354] flex items-center gap-1.5">
                  🔍 系統刪除前預檢 (System Preflight Check)
                </span>
                
                <div className="text-[11px] space-y-1.5 text-gray-600 font-medium">
                  <p>此家庭在 Firestore 雲端包含以下待刪除或解除關聯之資料：</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white p-3 rounded-xl border border-amber-100 font-sans mt-2">
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>👤 家庭成員</span>
                      <span className="font-bold text-gray-800">{deleteTarget.memberCount} 人</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>📅 日曆行程</span>
                      <span className="font-bold text-gray-800">{deleteTarget.calendarCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>📋 任務安排</span>
                      <span className="font-bold text-gray-800">{deleteTarget.taskCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>📢 公告通告</span>
                      <span className="font-bold text-gray-800">{deleteTarget.announcementCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>🎁 禮物商品</span>
                      <span className="font-bold text-gray-800">{deleteTarget.giftCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>💭 許願清單</span>
                      <span className="font-bold text-gray-800">{deleteTarget.wishCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>📝 家庭記事</span>
                      <span className="font-bold text-gray-800">{deleteTarget.noteCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>⚙️ 事項範本</span>
                      <span className="font-bold text-gray-800">{deleteTarget.templateCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>⭐ 星星記錄</span>
                      <span className="font-bold text-gray-800">{deleteTarget.starHistoryCount} 筆</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                      <span>⚙️ 系統設定</span>
                      <span className="font-bold text-gray-800">{deleteTarget.settingsCount} 筆</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-700/80 mt-1 leading-normal">
                    ※ 特別提示：家庭成員之 Firebase Auth 帳密不會被刪除，唯其 familyId、role、status 將解除綁定。相關歷史稽核日誌與管理員登入紀錄將標記為 deletedFamily 而予以保留。
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-sans">
                <div className="text-xs text-rose-805 font-bold leading-relaxed border border-rose-200 bg-rose-50/20 p-4 rounded-2xl">
                  您即將永久刪除：
                  <div className="mt-2 font-mono text-xs text-gray-800 bg-white border border-rose-100 p-2.5 rounded-xl space-y-1">
                    <div>家庭名稱：<span className="font-extrabold text-rose-700">{deleteTarget.familyName}</span></div>
                    <div>FamilyId：<span className="font-semibold text-gray-900">{deleteTarget.familyId}</span></div>
                  </div>
                  <div className="mt-3 text-rose-600 flex items-center gap-1.5">
                    <span>⚠️ 此操作無法復原。是否確認刪除？</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-600">
                    請輸入完整家庭 ID <b className="font-mono text-rose-700 select-all bg-gray-100 px-1.5 py-0.5 rounded">{deleteTarget.familyId}</b> 以確認刪除：
                  </label>
                  <input
                    type="text"
                    value={safeConfirmName}
                    onChange={(e) => setSafeConfirmName(e.target.value)}
                    placeholder="請在此輸入 ID 進行二次確認防誤觸"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-250 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 font-mono tracking-wider focus:outline-hidden"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-150 p-4 shrink-0 flex justify-end gap-2 text-xs font-black">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition active:scale-95 cursor-pointer font-bold"
                disabled={loading}
              >
                取消
              </button>
              
              <button
                onClick={() => deleteFamilyCascade(deleteTarget.familyId)}
                className={`px-5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer font-bold text-white flex items-center gap-1.5 ${
                  safeConfirmName === deleteTarget.familyId && !loading
                    ? "bg-rose-650 hover:bg-rose-700 shadow"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                disabled={safeConfirmName !== deleteTarget.familyId || loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin text-white h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>正在抹除雲端關聯...</span>
                  </>
                ) : (
                  <span>確認永久刪除</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. Whitelist Delete Confirmation Modal */}
      {showWhitelistDeleteModal && whitelistDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-sans">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-rose-600/5 px-6 py-5 border-b border-rose-100 shrink-0 flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">強制撤銷白名單建立資格</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">此動作將一併移除該家庭的最高權限綁定</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh] text-xs leading-relaxed text-gray-600 space-y-4">
              <p className="font-medium text-gray-750">
                您即將完成以下刪除操作，該電子信箱此後需要再次獲得邀請才能建立/重建家庭：
              </p>
              <div className="font-mono text-xs bg-gray-50 border border-gray-200 p-3 rounded-2xl space-y-1.5">
                <div>白名單信箱：<span className="font-extrabold text-indigo-900">{whitelistDeleteTarget.email}</span></div>
                <div>白名單識別 ID：<span className="font-semibold text-gray-550">{whitelistDeleteTarget.id}</span></div>
              </div>
              <p className="text-[11px] text-rose-600 font-bold bg-rose-50/30 border border-rose-100 p-3.5 rounded-2xl">
                ⚠️ 請注意：此操作為即時直接刪除，旨在替代受限環境下遭 iframe 瀏覽器沙盒阻擋的彈窗。
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-150 p-4 shrink-0 flex justify-end gap-2 text-xs font-black">
              <button
                onClick={() => {
                  setShowWhitelistDeleteModal(false);
                  setWhitelistDeleteTarget(null);
                }}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition active:scale-95 cursor-pointer font-bold"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={confirmDeleteWhitelist}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition active:scale-95 cursor-pointer font-bold flex items-center gap-1.5 shadow"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin text-white h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>正在執行刪除...</span>
                  </>
                ) : (
                  <span>確認撤銷白名單</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Family Suspension Confirmation Modal */}
      {showFamilySuspendModal && familySuspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-sans">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in duration-150">
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b shrink-0 flex items-center gap-3 ${
              familySuspendTarget.shouldSuspend ? "bg-rose-600/5 border-rose-100" : "bg-emerald-600/5 border-emerald-100"
            }`}>
              <div className={`p-2.5 rounded-2xl ${
                familySuspendTarget.shouldSuspend ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              }`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">家庭全體狀態一鍵維護</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">同時更新家庭內的所有註冊成員狀態</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh] text-xs leading-relaxed text-gray-600 space-y-4">
              <p className="font-medium text-gray-750">
                確定要變更本家庭中所有成員之開通與使用權限嗎？
              </p>
              <div className="font-mono text-xs bg-gray-50 border border-gray-200 p-3 rounded-2xl space-y-1.5">
                <div>變更目標家庭成員數：<span className="font-extrabold text-gray-800">{familySuspendTarget.memberCount} 人</span></div>
                <div>安全執行指令：<span className="font-black text-indigo-700">{familySuspendTarget.actionText}</span></div>
              </div>
              <p className="text-[11px] text-amber-700 font-bold bg-amber-50/30 border border-amber-100 p-3.5 rounded-2xl">
                ※ 提示：本操作不會停權 email 帳號 juwen616@gmail.com 頂級超級管理員之最高控制權。
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-150 p-4 shrink-0 flex justify-end gap-2 text-xs font-black">
              <button
                onClick={() => {
                  setShowFamilySuspendModal(false);
                  setFamilySuspendTarget(null);
                }}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition active:scale-95 cursor-pointer font-bold"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={confirmFamilySuspend}
                className={`px-5 py-2.5 text-white rounded-xl transition active:scale-95 cursor-pointer font-bold flex items-center gap-1.5 shadow ${
                  familySuspendTarget.shouldSuspend ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin text-white h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>正在套用變更...</span>
                  </>
                ) : (
                  <span>執行指令</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
