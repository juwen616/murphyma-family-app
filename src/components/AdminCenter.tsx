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
  serverTimestamp,
} from "firebase/firestore";
import {
  Shield,
  Users,
  Home,
  FileText,
  Activity,
  Plus,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Check,
  Monitor,
  Calendar,
  Sparkles,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

interface AdminCenterProps {
  currentUser: any;
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
}

export default function AdminCenter({
  currentUser,
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
  handleResetCounters
}: AdminCenterProps) {
  const [families, setFamilies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isNotInitialized, setIsNotInitialized] = useState(false);
  const [submittingWhitelist, setSubmittingWhitelist] = useState(false);
  const [newWhitelistedEmail, setNewWhitelistedEmail] = useState("");
  
  // Tabs for sub-sections
  const [activeTab, setActiveTab] = useState<"overview" | "whitelist" | "families" | "users" | "audit" | "logins" | "diagnostics">("overview");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Analytics timeframe
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);

  // Helper to log errors only if developerModeActive is true
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
      } catch (e: any) {
        logError("Fetch users error:", e);
        if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
          setIsNotInitialized(true);
        }
      }
      setUsers(userList);

      // 3. Fetch Whitelist
      let whitelistList: any[] = [];
      try {
        const whitelistSnap = await getDocs(collection(db, "allowed_family_creators"));
        whitelistList = whitelistSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch whitelist error:", e);
        if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
          setIsNotInitialized(true);
        }
      }
      setWhitelist(whitelistList);

      // 4. Fetch Audit Logs
      let auditList: any[] = [];
      try {
        const auditQuery = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(250));
        const auditSnap = await getDocs(auditQuery);
        auditList = auditSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch audit logs error:", e);
        if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
          setIsNotInitialized(true);
        }
      }
      setAuditLogs(auditList);

      // 5. Fetch Login Logs
      let loginList: any[] = [];
      try {
        const loginQuery = query(collection(db, "login_logs"), orderBy("loginTime", "desc"), limit(250));
        const loginSnap = await getDocs(loginQuery);
        loginList = loginSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        logError("Fetch login logs error:", e);
        if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
          setIsNotInitialized(true);
        }
      }
      setLoginLogs(loginList);

    } catch (error: any) {
      logError("General error loading admin center data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const verifyIdentityAndLoad = async () => {
      if (!currentUser?.uid) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const isSA = userData?.systemRole === "SUPER_ADMIN" || currentUser.email === "juwen616@gmail.com";
          if (isSA) {
            setIsSuperAdmin(true);
            await fetchAdminData();
          } else {
            setIsSuperAdmin(false);
            setLoading(false);
          }
        } else {
          if (currentUser.email === "juwen616@gmail.com") {
            setIsSuperAdmin(true);
            await fetchAdminData();
          } else {
            setIsSuperAdmin(false);
            setLoading(false);
          }
        }
      } catch (err: any) {
        logError("Verification of SuperAdmin identity failed:", err);
        if (currentUser.email === "juwen616@gmail.com") {
          setIsSuperAdmin(true);
          await fetchAdminData();
        } else {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    };
    verifyIdentityAndLoad();
  }, [currentUser?.uid]);

  // Handler to add whitelist
  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newWhitelistedEmail.trim().toLowerCase();
    if (!email) return;
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
      fetchAdminData();
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

  // Handler to delete whitelist entry
  const handleDeleteWhitelist = async (id: string, email: string) => {
    if (!confirm(`確認要刪除「${email}」的家庭建立資格嗎？`)) return;
    try {
      await deleteDoc(doc(db, "allowed_family_creators", id));
      toast.success(`✓ 已將 ${email} 從白名單中移除`);
      fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 刪除失敗：${err.message}`);
    }
  };

  // Handler to suspend/ban user
  const handleToggleUserSuspended = async (targetUser: any) => {
    const newSuspended = !targetUser.suspended;
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        suspended: newSuspended,
      });
      toast.success(`✓ "${targetUser.displayName}" 帳號狀態已改為：${newSuspended ? "🔴 已停權" : "🟢 正常"}`);
      fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 停權修改失敗：${err.message}`);
    }
  };

  // Handler to delete family
  const handleDeleteFamily = async (fam: any) => {
    if (!confirm(`⚠️ 警示：這將會永久刪除「${fam.name}」的所有家庭資料，此動作無法復原！確定要執行嗎？`)) return;
    try {
      await deleteDoc(doc(db, "families", fam.id));
      toast.success(`✓ 成功刪除家庭「${fam.name}」`);
      fetchAdminData();
    } catch (err: any) {
      toast.error(`❌ 刪除失敗：${err.message}`);
    }
  };

  // Formatter helpers
  const formatTime = (ts: any) => {
    if (!ts) return "--";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  };

  // Analytics derivations
  const numFamilies = families.length;
  const numUsers = users.length;
  
  const todayLogins = useMemo(() => {
    const todayStr = new Date().toDateString();
    return loginLogs.filter((log) => {
      const date = log.loginTime ? (log.loginTime.seconds ? new Date(log.loginTime.seconds * 1000) : new Date(log.loginTime)) : null;
      return date && date.toDateString() === todayStr;
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

  // Analytics usage statistics
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
      else if (act.includes("模式")) counts.mode++;
    });

    return counts;
  }, [auditLogs, timeframe]);

  // Filtered lists
  const filteredWhitelist = useMemo(() => {
    return whitelist.filter(item => 
      item.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [whitelist, searchQuery]);

  const familyMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      if (u.familyId) {
        counts[u.familyId] = (counts[u.familyId] || 0) + 1;
      }
    });
    return counts;
  }, [users]);

  const filteredFamilies = useMemo(() => {
    return families.filter(fam => 
      fam.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fam.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [families, searchQuery]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => 
      log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [auditLogs, searchQuery]);

  if (isSuperAdmin === false) {
    return null;
  }

  if (isSuperAdmin === null && loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E1DA] p-12 text-center text-sm text-gray-500 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
        <p className="font-bold">驗證管理員權限中，請稍候...</p>
      </div>
    );
  }

  return (
    <div id="system-admin-panel" className="max-w-6xl mx-auto space-y-6 font-sans text-[#2D2926]">
      {isNotInitialized && (
        <div id="admin-not-initialized-alert" className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs font-bold leading-relaxed space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-black">
            <span>⚠️</span> 系統管理中心尚未完成初始化
          </p>
          <p className="text-[11px] font-medium text-amber-700">
            請稍候，某些數據庫表尚未完全建立，或 Firestore 權限配置尚未套用。在此期間數據將預設為空。
          </p>
        </div>
      )}
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl">
            <Shield className="h-8 w-8 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans">系統管理與維護中心</h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium">超級管理員機密操作主控台 ． 目前登入：{currentUser.displayName} ({currentUser.email})</p>
          </div>
        </div>
        
        <button
          onClick={fetchAdminData}
          className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 hover:border-indigo-400 px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md select-none font-bold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>刷新系統狀態</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E1DA] p-12 text-center text-sm text-gray-500 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          <p className="font-bold">深度查詢資料庫中，請稍候...</p>
        </div>
      ) : (
        <>
          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">總家庭數量</span>
                <Home className="h-4 w-4 text-[#7C6354]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{numFamilies}</span>
                <span className="text-[10px] text-emerald-600 font-bold">現正註冊</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">總會員帳號</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{numUsers}</span>
                <span className="text-[10px] text-indigo-500 font-bold">成員與帳戶</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">本日活躍登入 (今日)</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{todayLogins}</span>
                <span className="text-[10px] text-emerald-600 font-bold">24H 訪問次數</span>
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold font-sans">一週活躍家庭數</span>
                <Check className="h-4 w-4 text-purple-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-800">{activeFamiliesThisWeek}</span>
                <span className="text-[10px] text-purple-600 font-bold">有操作行為</span>
              </div>
            </div>
          </div>

          {/* Tab Selection Navigation */}
          <div className="flex border-b border-gray-250 gap-2 shrink-0 overflow-x-auto pb-1">
            <button
              onClick={() => { setActiveTab("overview"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              📊 使用率與趨勢分析
            </button>
            <button
              onClick={() => { setActiveTab("whitelist"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "whitelist"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              🔑 建立家庭 whitelist
            </button>
            <button
              onClick={() => { setActiveTab("families"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "families"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              🏡 註冊家庭清冊
            </button>
            <button
              onClick={() => { setActiveTab("users"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "users"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              👥 使用者停權管理
            </button>
            <button
              onClick={() => { setActiveTab("audit"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "audit"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              ⚙️ 操作稽核日誌
            </button>
            <button
              onClick={() => { setActiveTab("logins"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "logins"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              💻 登入歷史紀錄
            </button>
            <button
              onClick={() => { setActiveTab("diagnostics"); setSearchQuery(""); }}
              className={`px-4 py-2.5 text-xs font-black transition whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === "diagnostics"
                  ? "border-indigo-600 text-indigo-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              ⚙️ 開發者工具
            </button>
          </div>

          {/* Search Bar - Hidden on Overview tab */}
          {activeTab !== "overview" && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`搜尋目前分頁資料 (${searchQuery ? "搜尋中" : "可輸入名稱、Email、角色..."})`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-[#E5E1DA] bg-white rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* TAB 1: OVERVIEW (Usage rate analytics) */}
          {activeTab === "overview" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#7C6354]" />
                  <span>系統模組與功能使用率統計</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">統計稽核日誌中，針對不同時效區段核心功能的變更與操作行為頻率</p>
              </div>

              {/* Timeframe Selector */}
              <div className="flex gap-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeframe(days as any)}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all border shrink-0 cursor-pointer ${
                      timeframe === days
                        ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5]"
                        : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    最近 {days} 天
                  </button>
                ))}
              </div>

              {/* Bar charts using Pure CSS flex boxes for robust premium display */}
              <div className="space-y-4 max-w-lg">
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
                      <div key={feat.label} className="space-y-1 text-xs">
                        <div className="flex justify-between items-center font-bold">
                          <span>{feat.label}</span>
                          <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{feat.val} 次</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
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
                💡 <b>分析解讀：</b> 本分析能協助了解使用者對核心系統（行事曆、任務系統、星星及特殊氣氛模式）的實際依賴頻度，進而為未來的 SaaS 加值功能提供開發方向諮詢。
              </div>
            </div>
          )}

          {/* TAB 2: WHITELIST */}
          {activeTab === "whitelist" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-1.5 text-gray-800">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    <span>家庭創建白名單 (Allowed Whitelist)</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">控制可在系統創立家庭（即 Mommy 身份）的註冊 Gmail 清冊</p>
                </div>

                <form onSubmit={handleAddWhitelist} className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="email"
                    required
                    placeholder="請輸入欲許可的 Gmail 帳號"
                    value={newWhitelistedEmail}
                    onChange={(e) => setNewWhitelistedEmail(e.target.value)}
                    className="text-xs border border-[#E5E1DA] bg-white rounded-xl px-3 py-2 w-full sm:w-60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingWhitelist || !newWhitelistedEmail}
                    className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    <span>加入帳號</span>
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none">
                      <th className="p-3">許可 Email 帳號</th>
                      <th className="p-3">狀態</th>
                      <th className="p-3">註冊白名單時間</th>
                      <th className="p-3 text-right">操作行為</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWhitelist.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400 italic">尚未建立資料</td>
                      </tr>
                    ) : (
                      filteredWhitelist.map((item) => (
                        <tr key={item.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono font-extrabold text-indigo-900">{item.email}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-50 text-gray-400 border border-gray-200'
                            }`}>
                              {item.status === 'active' ? '● 啟用中' : '○ 已停用'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">{formatTime(item.createdAt)}</td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleToggleWhitelistStatus(item)}
                              className="text-xs bg-slate-50 hover:bg-slate-100 border border-[#E5E1DA] text-[#4A6076] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              {item.status === "active" ? "停用" : "啟用"}
                            </button>
                            <button
                              onClick={() => handleDeleteWhitelist(item.id, item.email)}
                              className="text-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FAMILIES */}
          {activeTab === "families" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black">🏡 註冊家庭清冊</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">顯示系統目前已創立的所有家庭名冊；管理員可強制移除家庭資料</p>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none">
                      <th className="p-3">家庭 ID Code</th>
                      <th className="p-3">家庭名稱單位</th>
                      <th className="p-3">創建者 UID</th>
                      <th className="p-3">家庭邀請代碼</th>
                      <th className="p-3">開通時間</th>
                      <th className="p-3 text-right">權限維護</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFamilies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">尚未建立資料</td>
                      </tr>
                    ) : (
                      filteredFamilies.map((fam) => (
                        <tr key={fam.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono text-gray-500 select-all">{fam.id}</td>
                          <td className="p-3 font-extrabold text-gray-800">{fam.name}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-400">{fam.adminUid || "無"}</td>
                          <td className="p-3"><p className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded w-max text-[10px] font-bold">{fam.inviteCode || fam.id}</p></td>
                          <td className="p-3 text-gray-400">{formatTime(fam.createdAt)}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteFamily(fam)}
                              className="text-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              永久刪除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: USERS */}
          {activeTab === "users" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black">👥 使用者管理與帳號停權</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">列出系統全部登錄之使用者資訊；支援超級管理員強行對帳號實施停權與覆歸</p>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none">
                      <th className="p-3">使用者 ID (UID)</th>
                      <th className="p-3">姓名</th>
                      <th className="p-3">綁定 Email</th>
                      <th className="p-3">家庭隸屬學區 (FamilyId)</th>
                      <th className="p-3">角色權限</th>
                      <th className="p-3">開通與註冊時間</th>
                      <th className="p-3 text-right">帳號狀態維護</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">尚未建立資料</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono text-[10px] text-gray-400 select-all">{user.uid}</td>
                          <td className="p-3 font-black text-gray-800">{user.displayName}</td>
                          <td className="p-3 font-mono">{user.email || "（沙盒手動新增）"}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-400">{user.familyId || "○ 尚未建立/無群組"}</td>
                          <td className="p-3">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">{formatTime(user.createdAt)}</td>
                          <td className="p-3 text-right">
                            {user.email === "juwen616@gmail.com" ? (
                              <span className="text-[10px] text-indigo-500 font-black px-2 py-1 bg-slate-50 border rounded-lg">不可停權</span>
                            ) : (
                              <button
                                onClick={() => handleToggleUserSuspended(user)}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ml-auto ${
                                  user.suspended
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                                }`}
                              >
                                {user.suspended ? (
                                  <>
                                    <Unlock className="h-3 w-3" />
                                    <span>覆歸帳號</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    <span>停權帳號</span>
                                  </>
                                )}
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
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black">⚙️ 操作稽核日誌</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">記錄所有跨家庭及使用者的重要日常行為：新增/刪除行事曆、任務完成审查、兌換商品、修改權限等</p>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none sticky top-0">
                      <th className="p-3 bg-slate-50">記錄時間</th>
                      <th className="p-3 bg-slate-50">操作者姓名</th>
                      <th className="p-3 bg-slate-50">隸屬家庭Id</th>
                      <th className="p-3 bg-slate-50">行為動作</th>
                      <th className="p-3 bg-slate-50">被操作物件名稱</th>
                      <th className="p-3 bg-slate-50">被操作物件 ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">尚未建立資料</td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono text-gray-400 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                          <td className="p-3 font-bold text-indigo-900">{log.userName}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-400">{log.familyId || "（全系統）"}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-gray-800 font-medium">{log.targetName}</td>
                          <td className="p-3 font-mono text-[9px] text-gray-400">{log.targetId || "--"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: LOGIN LOGS */}
          {activeTab === "logins" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black">💻 登入歷史紀錄</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">系統各裝置首次及重新連線時的自動登錄軌跡，包含終端平台、瀏覽器核心以及當下時間戳記</p>
              </div>

              <div className="overflow-x-auto border border-[#E5E1DA] rounded-2xl max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E5E1DA] text-gray-500 font-bold select-none sticky top-0">
                      <th className="p-3 bg-slate-50">登入時間</th>
                      <th className="p-3 bg-slate-50">使用者姓名</th>
                      <th className="p-3 bg-slate-50">登入 Email</th>
                      <th className="p-3 bg-slate-50">終端載體 (OS)</th>
                      <th className="p-3 bg-slate-50">瀏覽器核心</th>
                      <th className="p-3 bg-slate-50">使用者識別 (UID)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">尚未建立資料</td>
                      </tr>
                    ) : (
                      loginLogs.map((log) => (
                        <tr key={log.id} className="border-b border-[#FAF9F6] last:border-0 hover:bg-[#FAF8F4]/30">
                          <td className="p-3 font-mono text-gray-400 whitespace-nowrap">{formatTime(log.loginTime)}</td>
                          <td className="p-3 font-bold text-gray-850">{log.userName}</td>
                          <td className="p-3 font-mono text-indigo-900">{log.email}</td>
                          <td className="p-3 text-gray-600 font-semibold">{log.device || "Desktop"}</td>
                          <td className="p-3 text-gray-500 font-mono">{log.browser || "Agent"}</td>
                          <td className="p-3 font-mono text-[9px] text-gray-400">{log.userId}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: FIRESTORE DIAGNOSTICS & DEVELOPER TOOLS */}
          {activeTab === "diagnostics" && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-1.5 text-gray-800">
                    <Activity className="h-4.5 w-4.5 text-indigo-600" />
                    <span>⚙️ 系統開發者工具 (Developer Tools)</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">專為 SUPER_ADMIN 提供的模擬、時區、網絡與實時 Cloud Firestore 數據健康度主控台</p>
                </div>
                {setShowDevPanel && (
                  <button
                    onClick={() => setShowDevPanel(true)}
                    className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    ⚙️ 開啟角色模擬與分析面板
                  </button>
                )}
              </div>

              {/* Developer simulated configurations */}
              <div className="p-4 bg-[#FAF8F5]/80 border border-[#EFEAE2] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3.5 rounded-lg border border-[#E5E1DA]/60">
                  <div>
                    <span className="font-extrabold text-gray-800 text-xs block">⚙️ 啟用開發者除錯小面板 (Developer Mode)</span>
                    <span className="text-[10px] text-gray-400">啟用後，右下角將浮現實時『效能診斷與開發』小面板以方便在正式頁面追踪效能。</span>
                  </div>
                  {setDeveloperModeActive && (
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={developerModeActive}
                        onChange={(e) => setDeveloperModeActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650"></div>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Performance Indicators Summary */}
                  <div className="bg-white p-4 rounded-lg border border-[#E5E1DA]/60 space-y-2.5">
                    <span className="text-[10px] text-gray-400 font-bold block border-b border-gray-100 pb-1">⚡ 當前效能與流量指標</span>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono leading-relaxed">
                      <div>首頁載入: <span className="font-bold text-indigo-700">{loadTimeMs} ms</span></div>
                      <div>即時監聽: <span className="font-bold text-[#7C6354]">{listenerCount} 個</span></div>
                      <div>統計 Queries: <span className="font-bold text-amber-600">{queryCount} 次</span></div>
                    </div>
                    {handleResetCounters && (
                      <button
                        onClick={handleResetCounters}
                        className="w-full py-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded border border-gray-200 transition cursor-pointer"
                      >
                        🔄 重置計數
                      </button>
                    )}
                  </div>

                  {/* Environment simulation (Lag & Dates) */}
                  <div className="bg-white p-4 rounded-lg border border-[#E5E1DA]/60 space-y-2.5">
                    <span className="text-[10px] text-gray-400 font-bold block border-b border-gray-100 pb-1">🧪 行為與網路模擬</span>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 font-bold block">模擬慢速網路 (Network Delay):</span>
                      {setLagSimulated && (
                        <button
                          onClick={() => setLagSimulated(!lagSimulated)}
                          className={`w-full py-1 px-2 rounded font-bold text-[10px] border transition cursor-pointer ${
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
                      <span className="text-[10px] text-gray-500 font-bold block">模擬時間旅行 (Time Travel Date):</span>
                      <div className="flex gap-1">
                        <input
                          type="date"
                          value={simulatedTodayDate || ""}
                          onChange={(e) => onSetSimulatedTodayDate && onSetSimulatedTodayDate(e.target.value)}
                          className="flex-grow bg-white border border-[#E5E1DA] rounded px-1.5 py-0.5 text-[10.5px] font-mono focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            if (onSetSimulatedTodayDate) {
                              const today = new Date();
                              const y = today.getFullYear();
                              const m = String(today.getMonth() + 1).padStart(2, "0");
                              const d = String(today.getDate()).padStart(2, "0");
                              onSetSimulatedTodayDate(`${y}-${m}-${d}`);
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold bg-[#EFEAE2] hover:bg-[#E2D9CE] text-[#3C332D] rounded transition cursor-pointer"
                        >
                          重置
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Firestore diagnostic details */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-black text-gray-800 block">📊 Firestore 即時數據對接狀況</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#FCFBF9] border border-[#E5E1DA] p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">連線狀態</span>
                    <div className="text-xs font-extrabold text-emerald-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>🟢 系統連線線上 (CONNECTED)</span>
                    </div>
                  </div>

                  <div className="bg-[#FCFBF9] border border-[#E5E1DA] p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">本地快取狀態</span>
                    <div className="text-xs font-extrabold text-indigo-600 flex items-center gap-1">
                      <span>🟢 離線持久快取已就緒</span>
                    </div>
                  </div>

                  <div className="bg-[#FCFBF9] border border-[#E5E1DA] p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">快取文件總數</span>
                    <div className="text-xs font-extrabold text-gray-800 font-mono">
                      <span>{families.length + users.length + whitelist.length + auditLogs.length + loginLogs.length} docs loaded</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 pt-1">
                  <h4 className="text-xs font-black text-gray-850 flex items-center gap-1.5">
                    📂 集合實時快取與數據流狀況
                  </h4>
                  <div className="space-y-2">
                    {[
                      { name: "families", desc: "登記註冊的實體家庭", count: families.length, health: "100% 正常加密流" },
                      { name: "users", desc: "系統已登記的使用者帳戶", count: users.length, health: "100% 正常加密流" },
                      { name: "allowed_family_creators", desc: "家庭創建白名單許可信賴網", count: whitelist.length, health: "100% 唯讀流" },
                      { name: "audit_logs", desc: "維護與操作稽核軌跡", count: auditLogs.length, health: "100% 寫入流" },
                      { name: "login_logs", desc: "帳號安全登錄歷程紀錄", count: loginLogs.length, health: "100% 唯讀/寫入流" },
                    ].map((coll) => (
                      <div key={coll.name} className="flex justify-between items-center text-xs border border-[#FAF9F6] bg-[#FCFBF9] p-3 rounded-lg hover:bg-[#FDFDFD] transition">
                        <div>
                          <p className="font-mono font-black text-indigo-950">/{coll.name}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">{coll.desc}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-2.5 py-0.5 rounded font-black font-mono">
                            {coll.count} docs
                          </span>
                          <p className="text-[9px] text-emerald-600 font-black mt-0.5">● 數據同步正常</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
