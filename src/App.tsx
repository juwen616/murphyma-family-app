import React, { useState, useEffect, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
} from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import {
  SystemMode,
  UserRole,
  UserProfile,
  Family,
  CalendarEvent,
  Task,
  TaskStatus,
  Reward,
  RewardStatus,
  Announcement,
  CommonTemplate,
  FamilySetting,
  Redemption,
  ConfiguredMode,
  getLocalToday,
} from "./types";

import Clock from "./components/Clock";
import HomeDashboard from "./components/HomeDashboard";
import CalendarView from "./components/CalendarView";
import TaskSystem from "./components/TaskSystem";
import RewardCenter from "./components/RewardCenter";
import FavoriteMgr from "./components/FavoriteMgr";
import MembersCenter from "./components/MembersCenter";
import { SpecialPeriodsConfig } from "./components/SpecialPeriodsConfig";
import PerformanceDebugPanel from "./components/PerformanceDebugPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Gift,
  Heart,
  Users,
  LogOut,
  Sparkles,
  Home,
  CheckCircle,
  X,
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSandboxLoggingIn, setIsSandboxLoggingIn] = useState(false);

  // Family Onboarding states
  const [onboardingChoice, setOnboardingChoice] = useState<"none" | "create" | "join">("none");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [joinFamilyId, setJoinFamilyId] = useState("");
  const [joinRole, setJoinRole] = useState<UserRole>(UserRole.PARENT);
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [isOnboardingBusy, setIsOnboardingBusy] = useState(false);

  // Navigation page state
  const [activePage, setActivePage] = useState<"home" | "calendar" | "tasks" | "rewards" | "favorites" | "members" | "special-periods">("home");
  const [calendarDeepLink, setCalendarDeepLink] = useState<{ eventId: string; date: string } | null>(null);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [activeMobileSection, setActiveMobileSection] = useState<string>("home");

  const handleNavigateToEvent = (eventId: string, date: string) => {
    setCalendarDeepLink({ eventId, date });
    setActivePage("calendar");
  };

  // Simulation states for Developer Mode
  const [developerModeActive, setDeveloperModeActive] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [simulatedMemberId, setSimulatedMemberId] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Firestore operations logs state
  const [firestoreLogs, setFirestoreLogs] = useState<any[]>([]);

  const logFirestoreOp = (type: string, path: string, status: "success" | "error", details?: string) => {
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      time: new Date().toLocaleTimeString(),
      type,
      path,
      status,
      details,
    };
    setFirestoreLogs((prev) => [newLog, ...prev].slice(0, 50));
  };

  // Real-time Database state variables
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [activeSetting, setActiveSetting] = useState<FamilySetting | null>(null);
  const [simulatedTodayDate, setSimulatedTodayDate] = useState<string>(getLocalToday());
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [favoriteActivities, setFavoriteActivities] = useState<CommonTemplate[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [starTransactions, setStarTransactions] = useState<any[]>([]);

  // Performance Diagnostic Counters & Progress States
  const mountTime = React.useRef(performance.now());
  const [loadTimeMs, setLoadTimeMs] = useState<number>(0);
  const [queryCount, setQueryCount] = useState<number>(0);
  const [listenerCount, setListenerCount] = useState<number>(0);
  const [lagSimulated, setLagSimulated] = useState<boolean>(false);

  const [dataLoaded, setDataLoaded] = useState({
    family: false,
    settings: false,
    members: false,
    events: false,
    tasks: false,
    rewards: false,
    announcements: false,
    favorites: false,
    redemptions: false,
    starTransactions: false,
  });

  const incrementQueries = (count = 1) => {
    setQueryCount(prev => prev + count);
  };

  const handleResetCounters = () => {
    setQueryCount(0);
  };

  const handleFastRoleSwitch = (targetRole: string, targetMemberId?: string | null) => {
    setSimulatedRole(targetRole as any);
    if (targetMemberId !== undefined) {
      setSimulatedMemberId(targetMemberId);
    } else {
      setSimulatedMemberId(null);
    }
    setDeveloperModeActive(true);
  };

  useEffect(() => {
    if (dataLoaded.members && dataLoaded.events) {
      if (loadTimeMs === 0) {
        const elapsed = Math.round(performance.now() - mountTime.current);
        setLoadTimeMs(elapsed);
      }
    }
  }, [dataLoaded.members, dataLoaded.events, loadTimeMs]);

  // Computed values for Developer Mode / Role switching - must be declared before any conditional returns
  const effectiveUserProfile = useMemo(() => {
    if (!currentUserProfile) return null;
    if (!developerModeActive) return currentUserProfile;

    let base = { ...currentUserProfile };

    // Find the member if simulatedMemberId is specified:
    if (simulatedMemberId) {
      const found = familyMembers.find((m) => m.uid === simulatedMemberId);
      if (found) {
        base = {
          ...base,
          displayName: found.displayName,
          role: found.role,
          photoURL: found.photoURL || "",
          stars: found.stars || 0,
          uid: found.uid,
        } as any;
      }
    }

    if (simulatedRole) {
      base.role = simulatedRole;
    }

    return base as UserProfile;
  }, [developerModeActive, simulatedRole, simulatedMemberId, currentUserProfile, familyMembers]);

  // Restrict navigation if Kid or Pet (auto fallback) - must be declared before any conditional returns
  useEffect(() => {
    if (effectiveUserProfile) {
      const isKidOrPet = effectiveUserProfile.role === UserRole.KID || effectiveUserProfile.role === UserRole.PET;
      if (isKidOrPet && (activePage === "favorites" || activePage === "members")) {
        setActivePage("home");
      }
    }
  }, [effectiveUserProfile?.role, activePage]);

  // Scroll to section helper for mobile single-page interface
  const handleScrollToSection = (id: string, sectionKey: string) => {
    setActiveMobileSection(sectionKey);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 52; // Height of the sticky mobile tab bar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // IntersectionObserver to auto-update mobile navbar highlight
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const sections = [
      "mobile-section-home",
      "mobile-section-calendar",
      "mobile-section-tasks",
      "mobile-section-rewards",
      "mobile-section-favorites",
      "mobile-section-special-periods",
      "mobile-section-members"
    ];

    const observerOption = {
      root: null,
      rootMargin: "-15% 0px -65% 0px", // triggers when section is in active reading view
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id === "mobile-section-home") setActiveMobileSection("home");
          else if (id === "mobile-section-calendar") setActiveMobileSection("calendar");
          else if (id === "mobile-section-tasks") setActiveMobileSection("tasks");
          else if (id === "mobile-section-rewards") setActiveMobileSection("rewards");
          else if (id === "mobile-section-favorites") setActiveMobileSection("favorites");
          else if (id === "mobile-section-special-periods") setActiveMobileSection("special-periods");
          else if (id === "mobile-section-members") setActiveMobileSection("members");
        }
      });
    }, observerOption);

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.unobserve(el);
      });
    };
  }, [effectiveUserProfile?.role]);

  // Auto scroll horizontal tab button into view on mobile
  useEffect(() => {
    const activeBtn = document.querySelector(".mobile-tab-active");
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }, [activeMobileSection]);

  // Automated timezone-localized clock and date advances check
  useEffect(() => {
    const timer = setInterval(() => {
      const currentToday = getLocalToday();
      setSimulatedTodayDate((prev) => {
        // If developer Mode is disabled, we continuously sync with actual local today
        if (!developerModeActive) {
          return currentToday;
        }
        return prev;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [developerModeActive]);

  // 1. Monitor Authentication State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoadingAuth(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Attempt to pull user profile doc
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            setCurrentUserProfile(userSnap.data() as UserProfile);
          } else {
            // First time logging in - set initial null family profile to trigger onboarding
            const initProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "家庭成員",
              photoURL: "✿",
              color: "#B4C3B2",
              familyId: null,
              role: UserRole.MEMBER, // Defaut transient member role until onboarding selection
              stars: 0,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, initProfile);
            setCurrentUserProfile(initProfile);
          }
        } catch (err) {
          console.error("Auth state loading error:", err);
        }
      } else {
        setUser(null);
        setCurrentUserProfile(null);
        setActiveFamily(null);
        setActiveSetting(null);
        setFamilyMembers([]);
        setEvents([]);
        setTasks([]);
        setRewards([]);
        setAnnouncements([]);
        setFavoriteActivities([]);
        setRedemptions([]);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Dynamically calculate and update listener Count based on active page and login state
  useEffect(() => {
    let count = 0;
    if (user && currentUserProfile?.familyId) {
      count += 4; // 4 persistent: family, settings, users, announcements
      if (activePage === "home") {
        count += 2; // calendar_events fixed + single range
      } else if (activePage === "calendar") {
        count += 1; // full calendar_events
      } else if (activePage === "tasks") {
        count += 1; // tasks
      } else if (activePage === "rewards") {
        count += 2; // rewards + redemptions
      } else if (activePage === "favorites") {
        count += 1; // favorites
      } else if (activePage === "members") {
        count += 1; // redemptions
      }
    }
    setListenerCount(count);
  }, [user, currentUserProfile?.familyId, activePage]);

  const lagSimulatedRef = React.useRef(lagSimulated);
  useEffect(() => {
    lagSimulatedRef.current = lagSimulated;
  }, [lagSimulated]);

  // 2. Establish persistent and page-specific data loading caching and loaders
  const CACHE_KEY_MEMBERS = (famId: string) => `cached_family_members_${famId}`;
  const CACHE_KEY_SETTINGS = (famId: string) => `cached_family_settings_${famId}`;
  const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  const [cacheHits, setCacheHits] = useState<number>(0);
  const [cacheRequests, setCacheRequests] = useState<number>(0);

  const getCachedData = (key: string) => {
    setCacheRequests(prev => prev + 1);
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (!parsed || !parsed.timestamp || !parsed.data) return null;
      
      const now = Date.now();
      if (now - parsed.timestamp < CACHE_EXPIRY_MS) {
        setCacheHits(prev => prev + 1);
        return parsed.data;
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("Cache read failed:", e);
    }
    return null;
  };

  const setCachedData = (key: string, data: any) => {
    try {
      const payload = {
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      console.warn("Cache write failed:", e);
    }
  };

  const clearCachedData = (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Cache clear failed:", e);
    }
  };

  const loadAppletData = async (forceRefreshMembers = false) => {
    if (!user || !currentUserProfile?.familyId) return;
    const famId = currentUserProfile.familyId;
    
    const startTimeStamp = performance.now();
    
    try {
      // Get family info statically
      const snap = await getDoc(doc(db, "families", famId));
      incrementQueries(1);
      if (snap.exists()) {
        setActiveFamily(snap.data() as Family);
      }
      setDataLoaded((prev) => ({ ...prev, family: true }));
      const loadElapsed = Math.round(performance.now() - startTimeStamp);
      setLoadTimeMs(loadElapsed);
      logFirestoreOp("get", `families/${famId}`, "success", "載入家庭基本資料");
    } catch (e: any) {
      logFirestoreOp("get", `families/${famId}`, "error", e.message);
      console.error("Master parallel load failed:", e);
    }
  };

  useEffect(() => {
    loadAppletData();
  }, [user?.uid, currentUserProfile?.familyId, activePage]);

  // Comprehensive Real-time database sync listener for all tables
  useEffect(() => {
    if (!user || !currentUserProfile?.familyId) return;
    const famId = currentUserProfile.familyId;
    
    // 9 separate snapshots
    setListenerCount(9);

    // 1. Announcements
    const unsubAnn = onSnapshot(
      query(collection(db, "announcements"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: Announcement[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as Announcement);
        });
        setAnnouncements(list);
        setDataLoaded((prev) => ({ ...prev, announcements: true }));
        logFirestoreOp("list", "announcements", "success", `載入 ${list.length} 筆公告`);
      },
      (err) => {
        logFirestoreOp("list", "announcements", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "announcements");
      }
    );

    // 2. Tasks
    const unsubTasks = onSnapshot(
      query(collection(db, "tasks"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: Task[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as Task);
        });
        setTasks(list);
        setDataLoaded((prev) => ({ ...prev, tasks: true }));
        logFirestoreOp("list", "tasks", "success", `載入 ${list.length} 筆任務`);
      },
      (err) => {
        logFirestoreOp("list", "tasks", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "tasks");
      }
    );

    // 3. Calendar Events
    const unsubEvents = onSnapshot(
      query(collection(db, "calendar_events"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: CalendarEvent[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as CalendarEvent);
        });
        setEvents(list);
        setDataLoaded((prev) => ({ ...prev, events: true }));
        logFirestoreOp("list", "calendar_events", "success", `載入 ${list.length} 筆日曆行程`);
      },
      (err) => {
        logFirestoreOp("list", "calendar_events", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "calendar_events");
      }
    );

    // 4. Rewards
    const unsubRewards = onSnapshot(
      query(collection(db, "rewards"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: Reward[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as Reward);
        });
        setRewards(list);
        setDataLoaded((prev) => ({ ...prev, rewards: true }));
        logFirestoreOp("list", "rewards", "success", `載入 ${list.length} 筆禮物商品`);
      },
      (err) => {
        logFirestoreOp("list", "rewards", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "rewards");
      }
    );

    // 5. Favorite Activities
    const unsubFavorites = onSnapshot(
      query(collection(db, "favorite_activities"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: CommonTemplate[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() } as CommonTemplate);
        });
        setFavoriteActivities(list);
        setDataLoaded((prev) => ({ ...prev, favorites: true }));
        logFirestoreOp("list", "favorite_activities", "success", `載入 ${list.length} 筆常用事項`);
      },
      (err) => {
        logFirestoreOp("list", "favorite_activities", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "favorite_activities");
      }
    );

    // 6. Redemptions
    const unsubRedemptions = onSnapshot(
      query(collection(db, "redemptions"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: Redemption[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() } as Redemption);
        });
        setRedemptions(list);
        setDataLoaded((prev) => ({ ...prev, redemptions: true }));
        logFirestoreOp("list", "redemptions", "success", `載入 ${list.length} 筆兌換清單`);
      },
      (err) => {
        logFirestoreOp("list", "redemptions", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "redemptions");
      }
    );

    // 7. Star Transactions
    const unsubStarTxGroup = onSnapshot(
      query(collection(db, "star_transactions"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: any[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() });
        });
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setStarTransactions(list);
        setDataLoaded((prev) => ({ ...prev, starTransactions: true }));
        logFirestoreOp("list", "star_transactions", "success", `載入 ${list.length} 筆星星異動紀錄`);
      },
      (err) => {
        logFirestoreOp("list", "star_transactions", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "star_transactions");
      }
    );

    // 8. Users (Family Members)
    const unsubUsersGroup = onSnapshot(
      query(collection(db, "users"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: UserProfile[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as UserProfile);
        });
        setFamilyMembers(list);
        setCachedData(CACHE_KEY_MEMBERS(famId), list);
        const myFreshProfile = list.find((m) => m.uid === user.uid);
        if (myFreshProfile) {
          setCurrentUserProfile(myFreshProfile);
        }
        setDataLoaded((prev) => ({ ...prev, members: true }));
        logFirestoreOp("list", "users", "success", `載入 ${list.length} 名家庭成員狀態`);
      },
      (err) => {
        logFirestoreOp("list", "users", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "users");
      }
    );

    // 9. Settings (Family Settings)
    const unsubSettingsGroup = onSnapshot(
      doc(db, "settings", famId),
      (snap) => {
        incrementQueries(1);
        if (snap.exists()) {
          const sData = snap.data() as FamilySetting;
          setActiveSetting(sData);
          setCachedData(CACHE_KEY_SETTINGS(famId), sData);
          logFirestoreOp("get", `settings/${famId}`, "success", `同步系統模式: ${sData.systemMode}`);
        }
        setDataLoaded((prev) => ({ ...prev, settings: true }));
      },
      (err) => {
        logFirestoreOp("get", `settings/${famId}`, "error", err.message);
        handleFirestoreError(err, OperationType.GET, `settings/${famId}`);
      }
    );

    return () => {
      unsubAnn();
      unsubTasks();
      unsubEvents();
      unsubRewards();
      unsubFavorites();
      unsubRedemptions();
      unsubStarTxGroup();
      unsubUsersGroup();
      unsubSettingsGroup();
      setListenerCount(0);
    };
  }, [user?.uid, currentUserProfile?.familyId]);

  // login pipe
  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Authenticator error:", err);
      if (err instanceof Error && (err.message.includes("auth/cancelled-popup-request") || (err as any).code === "auth/cancelled-popup-request")) {
        console.warn("Popup login was cancelled or replaced by a new login flow.");
      } else {
        alert("登入失敗，請確認彈出視窗未被阻擋。如果是在預覽框架內，請點選右上角「在新分頁打開」以順利進行驗證！");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSandboxLogin = async () => {
    if (isSandboxLoggingIn) return;
    setIsSandboxLoggingIn(true);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error("Sandbox login error:", err);
      alert("沙盒免密密防阻擋登入失敗，請稍後再試。");
    } finally {
      setIsSandboxLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  // Onboarding action: Create Family
  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentUserProfile || !newFamilyName.trim() || isOnboardingBusy) return;
    setIsOnboardingBusy(true);

    try {
      const familyId = `fam_${Math.random().toString(36).substr(2, 9)}`;

      // 1. Write family profile
      const familyDocRef = doc(db, "families", familyId);
      const newFamily: Family = {
        id: familyId,
        name: newFamilyName.trim(),
        adminUid: user.uid,
        createdAt: serverTimestamp(),
      };
      await setDoc(familyDocRef, newFamily);

      // 2. Setup family settings with default DAILY mode
      const settingDocRef = doc(db, "settings", familyId);
      const newSetting: FamilySetting = {
        id: familyId,
        familyId,
        systemMode: SystemMode.DAILY,
        updatedAt: serverTimestamp(),
      };
      await setDoc(settingDocRef, newSetting);

      // 3. Update current user profile to admin/媽媽
      const userDocRef = doc(db, "users", user.uid);
      const updatedProfile: UserProfile = {
        ...currentUserProfile,
        familyId,
        role: UserRole.ADMIN, // Mommy creator becomes admin
      };
      await updateDoc(userDocRef, {
        familyId,
        role: UserRole.ADMIN,
      });

      // 4. Create family_members link
      const memberId = `${familyId}_${user.uid}`;
      await setDoc(doc(db, "family_members", memberId), {
        id: memberId,
        familyId,
        userId: user.uid,
        displayName: currentUserProfile.displayName,
        role: UserRole.ADMIN,
        stars: 0,
        createdAt: serverTimestamp(),
      });

      setCurrentUserProfile(updatedProfile);
      setActivePage("home");
    } catch (err) {
      console.error(err);
      alert("家庭建立失敗，請稍後再試。");
    } finally {
      setIsOnboardingBusy(false);
    }
  };

  // Onboarding action: Join Family
  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentUserProfile || !joinFamilyId.trim() || isOnboardingBusy) return;
    setIsOnboardingBusy(true);

    try {
      const targetFamilySnap = await getDoc(doc(db, "families", joinFamilyId.trim()));
      if (!targetFamilySnap.exists()) {
        alert("找不到此家庭邀請代碼，請向媽媽（管理員）核對代號！");
        setIsOnboardingBusy(false);
        return;
      }

      const famData = targetFamilySnap.data() as Family;

      // Update user document
      const userRef = doc(db, "users", user.uid);
      const updatedProfile: UserProfile = {
        ...currentUserProfile,
        familyId: famData.id,
        role: joinRole,
        displayName: joinDisplayName.trim() || currentUserProfile.displayName,
      };

      await updateDoc(userRef, {
        familyId: famData.id,
        role: joinRole,
        displayName: joinDisplayName.trim() || currentUserProfile.displayName,
      });

      // Create member link document
      const memberId = `${famData.id}_${user.uid}`;
      await setDoc(doc(db, "family_members", memberId), {
        id: memberId,
        familyId: famData.id,
        userId: user.uid,
        displayName: joinDisplayName.trim() || currentUserProfile.displayName,
        role: joinRole,
        stars: 0,
        createdAt: serverTimestamp(),
      });

      setCurrentUserProfile(updatedProfile);
      setActivePage("home");
    } catch (err) {
      console.error(err);
      alert("加入家庭失敗，請稍後重試。");
    } finally {
      setIsOnboardingBusy(false);
    }
  };

  // Write announcement
  const handleAddAnnouncement = async (title: string, content: string) => {
    if (!currentUserProfile?.familyId) return;
    try {
      const annId = `ann_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "announcements", annId), {
        id: annId,
        familyId: currentUserProfile.familyId,
        title,
        content,
        creatorUid: user?.uid || "",
        creatorName: currentUserProfile.displayName,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "announcements");
    }
  };

  // Delete announcement (妈妈 only)
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  // Add Calendar event
  const handleAddEvent = async (eventData: Omit<CalendarEvent, "id" | "creatorUid" | "creatorName" | "createdAt">) => {
    if (!currentUserProfile?.familyId) return;
    const evtId = `evt_${Math.random().toString(36).substr(2, 9)}`;
    const newEventObj: CalendarEvent = {
      ...eventData,
      id: evtId,
      creatorUid: user?.uid || "",
      creatorName: currentUserProfile.displayName || "系統",
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Optimistic State Update for instantaneous visual response (0ms latency in UI)
      setEvents((prev) => {
        if (prev.some((e) => e.id === evtId)) return prev;
        return [...prev, newEventObj];
      });

      // 2. Await actual Firestore write
      await setDoc(doc(db, "calendar_events", evtId), {
        ...eventData,
        id: evtId,
        creatorUid: user?.uid || "",
        creatorName: currentUserProfile.displayName || "系統",
        createdAt: serverTimestamp(),
      });

      logFirestoreOp("create", `calendar_events/${evtId}`, "success", `新增行程【${eventData.title}】`);
      toast.success(`📅 成功建立行程【${eventData.title}】！`);
      
      loadAppletData();
      return { id: evtId, event: newEventObj };
    } catch (err: any) {
      // Revert optimistic update on exception
      setEvents((prev) => prev.filter((e) => e.id !== evtId));
      console.error("❌ Add Calendar Event Failed:", err);
      logFirestoreOp("create", "calendar_events", "error", err.message);
      toast.error(`❌ 新增行程失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.CREATE, "calendar_events");
      throw err;
    }
  };

  // Delete Calendar event
  const handleDeleteEvent = async (id: string) => {
    let deletedEvent: CalendarEvent | null = null;
    try {
      // 1. Snaps optimistic deletion (remove instantly from state)
      setEvents((prev) => {
        const found = prev.find((e) => e.id === id);
        if (found) deletedEvent = found;
        return prev.filter((e) => e.id !== id);
      });

      // 2. Erase from Firestore
      await deleteDoc(doc(db, "calendar_events", id));
      
      logFirestoreOp("delete", `calendar_events/${id}`, "success", `刪除行程【${deletedEvent?.title || id}】`);
      toast.success("✅ 行程已刪除！");
      loadAppletData();
    } catch (err: any) {
      // Revert optimistic state back
      if (deletedEvent) {
        setEvents((prev) => [...prev, deletedEvent!]);
      }
      console.error("❌ Delete Calendar Event Failed:", err);
      logFirestoreOp("delete", `calendar_events/${id}`, "error", err.message);
      toast.error(`❌ 刪除行程失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.DELETE, `calendar_events/${id}`);
      throw err;
    }
  };

  // Edit Calendar event (Supports cascading updates for future occurrences of recurring/fixed activities)
  const handleEditEvent = async (id: string, eventData: Partial<CalendarEvent>, updateFuture: boolean = false) => {
    const originalEvents = [...events];
    try {
      // 1. Snaps optimistic edit update
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...eventData } : e));

      // 2. Run Firestore writes
      if (updateFuture) {
        const currentEventSnap = await getDoc(doc(db, "calendar_events", id));
        if (currentEventSnap.exists()) {
          const curEvent = currentEventSnap.data() as CalendarEvent;
          const templateId = curEvent.templateId;

          if (templateId) {
            const todayStr = curEvent.date;
            const q = query(
              collection(db, "calendar_events"),
              where("familyId", "==", currentUserProfile?.familyId),
              where("templateId", "==", templateId)
            );
            const querySnapshot = await getDocs(q);
            const updatePromises: Promise<void>[] = [];
            querySnapshot.forEach((docSnap) => {
              const evtData = docSnap.data() as CalendarEvent;
              if (evtData.date >= todayStr) {
                const upObj: any = {
                  title: eventData.title || evtData.title,
                  time: eventData.time || evtData.time,
                  note: eventData.note || evtData.note,
                  isPublic: eventData.isPublic !== undefined ? eventData.isPublic : evtData.isPublic,
                  dailyNotes: eventData.dailyNotes !== undefined ? eventData.dailyNotes : evtData.dailyNotes,
                };
                updatePromises.push(updateDoc(doc(db, "calendar_events", docSnap.id), upObj));
              }
            });

            const blueprintRef = doc(db, "favorite_activities", templateId);
            const blueprintSnap = await getDoc(blueprintRef);
            if (blueprintSnap.exists()) {
              const upB: any = {};
              if (eventData.title) upB.title = eventData.title;
              if (eventData.time && eventData.time.includes("~")) {
                const [start, end] = eventData.time.split("~");
                upB.defaultStartTime = start;
                upB.defaultEndTime = end;
              }
              await updateDoc(blueprintRef, upB);
              logFirestoreOp("update", `favorite_activities/${templateId}`, "success", `同步更新常用事項範本`);
            }

            await Promise.all(updatePromises);
            logFirestoreOp("update", `calendar_events_cascade/${templateId}`, "success", `序列更新 ${updatePromises.length} 筆未來重複行程`);
            toast.success("✅ 未來重複行程修改成功！");
            loadAppletData();
            return;
          }
        }
      }

      await updateDoc(doc(db, "calendar_events", id), eventData);
      logFirestoreOp("update", `calendar_events/${id}`, "success", `更新行程【${eventData.title || ""}】`);
      toast.success("✅ 行程修改成功！");
      loadAppletData();
    } catch (err: any) {
      setEvents(originalEvents);
      console.error("❌ Edit Calendar Event Failed:", err);
      logFirestoreOp("update", `calendar_events/${id}`, "error", err.message);
      toast.error(`❌ 修改行程失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `calendar_events/${id}`);
      throw err;
    }
  };

  // Create Task (Parent only)
  const handleAddTask = async (taskData: Omit<Task, "id" | "status" | "createdAt">) => {
    if (!currentUserProfile?.familyId) return;
    try {
      const kids = familyMembers.filter((m) => m.role === UserRole.KID);
      const kidsToAssign = taskData.assignedTo === "all"
        ? kids.map((k) => k.uid)
        : taskData.assignedTo.split(",").filter((id) => id && id !== "all");

      // If no kids are found or assigned, default to creating a single task of assignedTo as is
      if (kidsToAssign.length === 0) {
        const tId = `task_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, "tasks", tId), {
          ...taskData,
          id: tId,
          status: TaskStatus.PENDING,
          createdAt: serverTimestamp(),
        });
      } else {
        // Create an independent copy for each kid individually so they accumulate stars independently
        const promises = kidsToAssign.map(async (kidUid) => {
          const tId = `task_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(db, "tasks", tId), {
            ...taskData,
            assignedTo: kidUid,
            id: tId,
            status: TaskStatus.PENDING,
            createdAt: serverTimestamp(),
          });
        });
        await Promise.all(promises);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "tasks");
    }
  };

  // Edit Task (Parent only)
  const handleEditTask = async (taskId: string, updatedData: Partial<Task>) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), updatedData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  // Submit task completion (kid only)
  const handleSubmitTask = async (taskId: string, submissionNote: string, childMood?: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: TaskStatus.SUBMITTED,
        submissionNote,
        childMood: childMood || "",
        submittedAt: serverTimestamp(),
        submitterUid: user.uid, // Track who submitted the task to reward properly
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  // Approve reward and increase kid stars
  const handleApproveTask = async (
    taskId: string,
    kidUid: string,
    starsReward: number,
    approverName: string,
    parentEncouragement?: string
  ) => {
    try {
      // 1. Approve task document and save encouragement remarks
      await updateDoc(doc(db, "tasks", taskId), {
        status: TaskStatus.APPROVED,
        approvedAt: serverTimestamp(),
        approvedBy: approverName,
        parentEncouragement: parentEncouragement || "",
      });

      // 2. Add stars to target kid's user profile
      const kidProfileRef = doc(db, "users", kidUid);
      const kidSnap = await getDoc(kidProfileRef);
      if (kidSnap.exists()) {
        const curStars = kidSnap.data().stars || 0;
        await updateDoc(kidProfileRef, {
          stars: curStars + starsReward,
        });

        // 3. Keep companion family_member profile stars counts in synchronization
        const memberId = `${currentUserProfile?.familyId}_${kidUid}`;
        await updateDoc(doc(db, "family_members", memberId), {
          stars: curStars + starsReward,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  // Reject/Return Task
  const handleRejectTask = async (taskId: string, rejectionNote: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: TaskStatus.REJECTED,
        rejectionNote,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string, recycleStars?: boolean) => {
    try {
      if (recycleStars) {
        // Fetch the task first to determine who got the stars and how many
        const taskSnap = await getDoc(doc(db, "tasks", taskId));
        const taskData = taskSnap.data() as Task;
        if (taskData && taskData.status === TaskStatus.APPROVED) {
          const kidUid = taskData.submitterUid || taskData.assignedTo;
          const starsReward = taskData.starsReward || 0;
          if (kidUid && kidUid !== "all" && starsReward > 0) {
            const kidProfileRef = doc(db, "users", kidUid);
            const kidSnap = await getDoc(kidProfileRef);
            if (kidSnap.exists()) {
              const curStars = kidSnap.data().stars || 0;
              const newStars = Math.max(0, curStars - starsReward);
              
              // 1. Update kid user doc
              await updateDoc(kidProfileRef, { stars: newStars });

              // 2. Update companion family_member link
              const memberId = `${currentUserProfile?.familyId}_${kidUid}`;
              await updateDoc(doc(db, "family_members", memberId), { stars: newStars });

              // 3. Write record into star_transactions
              const transId = `trans_${Math.random().toString(36).substr(2, 9)}`;
              await setDoc(doc(db, "star_transactions", transId), {
                id: transId,
                familyId: currentUserProfile?.familyId || "",
                childUid: kidUid,
                childName: kidSnap.data().displayName || "孩子",
                amount: -starsReward,
                type: "decrease",
                reason: `任務【${taskData.title}】被刪除，同步回收發放的星星`,
                operatorUid: user?.uid || "",
                operatorName: currentUserProfile?.displayName || "家長",
                createdAt: serverTimestamp()
              });
            }
          }
        }
      }
      
      await deleteDoc(doc(db, "tasks", taskId));
      await loadAppletData(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  // Stars Adjustment Function
  const handleAdjustStars = async (targetUid: string, amount: number, reason: string, type: "increase" | "decrease") => {
    if (!currentUserProfile?.familyId) return;
    const actionLabel = type === "increase" ? "加點" : "扣點";
    try {
      const parentName = currentUserProfile?.displayName || "家長";
      
      // 1. Fetch current target child user document
      const targetUserRef = doc(db, "users", targetUid);
      const targetUserSnap = await getDoc(targetUserRef);
      if (!targetUserSnap.exists()) {
        throw new Error("找不到目標小孩的資料");
      }
      const targetUserData = targetUserSnap.data();
      const oldStars = targetUserData.stars || 0;
      let newStars = oldStars;
      if (type === "increase") {
        newStars = oldStars + amount;
      } else {
        newStars = Math.max(0, oldStars - amount); // deduct amount
      }

      // 2. Update user profile stars
      await updateDoc(targetUserRef, { stars: newStars });
      logFirestoreOp("update", `users/${targetUid}`, "success", `調整星星餘額: ${oldStars} ➡️ ${newStars}`);

      // 3. Keep companion family_member link stars counts in synchronization
      const realMemberId = `${currentUserProfile?.familyId}_${targetUid}`;
      try {
        await updateDoc(doc(db, "family_members", realMemberId), { stars: newStars });
        logFirestoreOp("update", `family_members/${realMemberId}`, "success", `同步家庭成員星星餘額 ➡️ ${newStars}`);
      } catch (memErr: any) {
        // Safe degrade in case family_member doc doesn't exist
        console.warn("Family member link synchronization skipped or not found:", memErr);
        logFirestoreOp("update", `family_members/${realMemberId}`, "error", `同步家庭成員星星餘額失敗 (可能文件不存在): ${memErr.message}`);
      }

      // 4. Record of Star Transaction
      const transactionId = `trans_${Math.random().toString(36).substr(2, 9)}`;
      const newTransaction = {
        id: transactionId,
        familyId: currentUserProfile?.familyId || "",
        childUid: targetUid,
        childName: targetUserData.displayName || "小孩",
        amount: type === "increase" ? amount : -amount,
        type,
        reason,
        operatorUid: user?.uid || "",
        operatorName: parentName,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "star_transactions", transactionId), newTransaction);
      logFirestoreOp("create", `star_transactions/${transactionId}`, "success", `建立星星異動紀錄: ${actionLabel} ${amount} 顆 (${reason})`);

      // 5. Success Toast
      toast.success(type === "increase" ? `🎉 成功加點 ${amount} 顆星星！` : `✅ 成功扣除 ${amount} 顆星星！`);

      // 6. Force refresh UI completely
      await loadAppletData(true);
    } catch (err: any) {
      console.error(`${actionLabel} 失敗:`, err);
      logFirestoreOp("write", `star_adjustments/${targetUid}`, "error", err.message);
      toast.error(`❌ ${actionLabel} 失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.WRITE, `star_adjustments/${targetUid}`);
    }
  };

  // Add Gift/Reward
  const handleAddReward = async (rewardData: Omit<Reward, "id" | "creatorUid" | "creatorName" | "createdAt">) => {
    if (!currentUserProfile?.familyId) return;
    try {
      const rewardId = `rew_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "rewards", rewardId), {
        ...rewardData,
        id: rewardId,
        creatorUid: user?.uid || "",
        creatorName: currentUserProfile.displayName,
        createdAt: serverTimestamp(),
      });
      logFirestoreOp("create", `rewards/${rewardId}`, "success", `新增禮物商品: 【${rewardData.title}】`);
      toast.success(`🎉 成功新增禮物商品【${rewardData.title}】！`);
    } catch (err: any) {
      logFirestoreOp("create", `rewards`, "error", err.message);
      toast.error(`❌ 新增禮物商品失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.CREATE, "rewards");
    }
  };

  // Approve Wish and list in available items (No inventory stock, as requested)
  const handleApproveWish = async (rewardId: string) => {
    try {
      await updateDoc(doc(db, "rewards", rewardId), {
        status: RewardStatus.AVAILABLE,
      });
      logFirestoreOp("update", `rewards/${rewardId}`, "success", `批准心願禮物`);
      toast.success(`🎉 成功將該禮物上架為可兌換商品！`);
    } catch (err: any) {
      logFirestoreOp("update", `rewards/${rewardId}`, "error", err.message);
      toast.error(`❌ 批准禮物失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `rewards/${rewardId}`);
    }
  };

  // Kid Redeems reward (Creates a pending redemption request safely)
  const handleRedeemReward = async (reward: Reward) => {
    if (!user || !currentUserProfile) return;
    if (currentUserProfile.stars < reward.starsCost) {
      toast.error("❌ 星星不夠喔，再去多解一些日常任務吧！💪");
      return;
    }

    try {
      const redId = `red_${Math.random().toString(36).substr(2, 9)}`;
      const newRedemption: Omit<Redemption, "id"> = {
        familyId: currentUserProfile.familyId || "",
        rewardId: reward.id,
        rewardTitle: reward.title,
        starsRequired: reward.starsCost,
        childUid: user.uid,
        childName: currentUserProfile.displayName,
        status: "pending",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "redemptions", redId), newRedemption);
      logFirestoreOp("create", `redemptions/${redId}`, "success", `申請兌換禮物: 【${reward.title}】`);
      toast.success(`🎁 兌換申請已送出，等待家長審核核准！`);
    } catch (err: any) {
      logFirestoreOp("create", `redemptions`, "error", err.message);
      toast.error(`❌ 申請兌換失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.CREATE, "redemptions");
    }
  };

  // Parent Approves Redemption (Deducts child's accumulated stars)
  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      const redRef = doc(db, "redemptions", redemptionId);
      const redSnap = await getDoc(redRef);
      if (!redSnap.exists()) {
        toast.error("❌ 找不到兌換請求記錄");
        return;
      }
      const redData = redSnap.data() as Redemption;

      // 1. Deduct stars from child's user profile
      const childProfileRef = doc(db, "users", redData.childUid);
      const childSnap = await getDoc(childProfileRef);
      if (childSnap.exists()) {
        const currentStars = childSnap.data().stars || 0;
        const newStars = Math.max(0, currentStars - redData.starsRequired);

        // Update user profile stars
        await updateDoc(childProfileRef, { stars: newStars });
        logFirestoreOp("update", `users/${redData.childUid}`, "success", `扣除兌換星星: ${currentStars} ➡️ ${newStars}`);

        // Update companion family_member link stars
        const memberId = `${currentUserProfile?.familyId}_${redData.childUid}`;
        try {
          await updateDoc(doc(db, "family_members", memberId), { stars: newStars });
          logFirestoreOp("update", `family_members/${memberId}`, "success", `同步扣除家庭成員星星: ➡️ ${newStars}`);
        } catch (memErr) {
          console.warn("Family member link synchronization skipped during redemption approval:", memErr);
        }

        // 2. Set redemption status to approved
        await updateDoc(redRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
        });
        logFirestoreOp("update", `redemptions/${redemptionId}`, "success", `批准兌換心願禮物`);

        // 3. Keep record in stars transactions so it is listed in history!
        const transactionId = `trans_${Math.random().toString(36).substr(2, 9)}`;
        const newTransaction = {
          id: transactionId,
          familyId: currentUserProfile?.familyId || "",
          childUid: redData.childUid,
          childName: redData.childName,
          amount: -redData.starsRequired,
          type: "decrease",
          reason: `兌換商品【${redData.rewardTitle}】`,
          operatorUid: user?.uid || "",
          operatorName: currentUserProfile?.displayName || "家長",
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "star_transactions", transactionId), newTransaction);
        logFirestoreOp("create", `star_transactions/${transactionId}`, "success", `建立因兌換扣星之異動紀錄`);

        toast.success(`🎉 成功核准 ${redData.childName} 兌換【${redData.rewardTitle}】！已扣除 ${redData.starsRequired} 顆星星！`);
      }
    } catch (err: any) {
      logFirestoreOp("write", `redemptions/${redemptionId}`, "error", err.message);
      toast.error(`❌ 核准兌換失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.WRITE, `redemptions/${redemptionId}`);
    }
  };

  // Parent Rejects Redemption request
  const handleRejectRedemption = async (redemptionId: string) => {
    try {
      await updateDoc(doc(db, "redemptions", redemptionId), {
        status: "rejected",
      });
      logFirestoreOp("update", `redemptions/${redemptionId}`, "success", `駁回兌換申請`);
      toast.success(`✅ 已駁回該兌換申請。`);
    } catch (err: any) {
      logFirestoreOp("write", `redemptions/${redemptionId}`, "error", err.message);
      toast.error(`❌ 駁回申請失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.WRITE, `redemptions/${redemptionId}`);
    }
  };

  // Delete reward
  const handleDeleteReward = async (rewardId: string) => {
    try {
      await deleteDoc(doc(db, "rewards", rewardId));
      logFirestoreOp("delete", `rewards/${rewardId}`, "success", "刪除禮物及商品");
      toast.success("✅ 禮物商品已刪除！");
    } catch (err: any) {
      logFirestoreOp("delete", `rewards/${rewardId}`, "error", err.message);
      toast.error(`❌ 刪除禮物失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.DELETE, `rewards/${rewardId}`);
    }
  };

  // Update reward details
  const handleUpdateReward = async (rewardId: string, updates: Partial<Reward>) => {
    try {
      await updateDoc(doc(db, "rewards", rewardId), updates);
      logFirestoreOp("update", `rewards/${rewardId}`, "success", `更新禮物商品: ${updates.title || ""}`);
      toast.success("✅ 禮物商品修改成功！");
    } catch (err: any) {
      logFirestoreOp("update", `rewards/${rewardId}`, "error", err.message);
      toast.error(`❌ 修改禮物失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `rewards/${rewardId}`);
    }
  };

// Helper function to calculate matching weekdays for recurring lessons
function generateTemplateDates(startDateStr: string, weekdays: number[], count: number = 12): string[] {
  const dates: string[] = [];
  let current = new Date(startDateStr);
  if (isNaN(current.getTime())) {
    current = new Date();
  }
  
  // Guard against locking up - search maximum 120 days to locate 'count' matches
  for (let i = 0; i < 120 && dates.length < count; i++) {
    const dow = current.getDay();
    if (weekdays.includes(dow)) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

  // Add Favorite Activity
  const handleAddFavorite = async (activityData: Omit<CommonTemplate, "id" | "creatorUid" | "createdAt"> & { startDate?: string }) => {
    if (!currentUserProfile?.familyId) return;
    try {
      const fvId = `tpl_${Math.random().toString(36).substr(2, 9)}`;
      const savedData: any = {
        ...activityData,
        id: fvId,
        creatorUid: user?.uid || "",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "favorite_activities", fvId), savedData);

      // If isRecurring is true, automatically populate future matching dates over the next 12 occurrences (only for calendar or both types)
      if (activityData.isRecurring && activityData.repeatDays && activityData.repeatDays.length > 0 && (activityData.type === "calendar" || activityData.type === "both")) {
        const start = activityData.startDate || new Date().toLocaleDateString("sv-SE");
        const dates = generateTemplateDates(start, activityData.repeatDays, 12);
        
        const addPromises = dates.map(async (dt) => {
          const evId = `evt_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(db, "calendar_events", evId), {
            id: evId,
            familyId: currentUserProfile.familyId,
            title: activityData.title,
            date: dt,
            time: `${activityData.defaultStartTime || "15:00"}~${activityData.defaultEndTime || "16:30"}`,
            category: "",
            isFixed: false,
            note: "",
            isPublic: true,
            creatorUid: user?.uid || "",
            creatorName: currentUserProfile.displayName,
            createdAt: serverTimestamp(),
            templateId: fvId,
          });
        });
        await Promise.all(addPromises);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "favorite_activities");
    }
  };

  // Edit Favorite Activity with Downstream Syncing
  const handleEditFavorite = async (activityId: string, updatedData: Partial<CommonTemplate>) => {
    if (!currentUserProfile?.familyId) return;
    try {
      await updateDoc(doc(db, "favorite_activities", activityId), {
        ...updatedData,
      });

      const todayStr = new Date().toLocaleDateString("sv-SE");
      const q = query(
        collection(db, "calendar_events"),
        where("familyId", "==", currentUserProfile.familyId),
        where("templateId", "==", activityId)
      );
      const querySnapshot = await getDocs(q);
      const updatePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnap) => {
        const evtData = docSnap.data();
        if (evtData.date >= todayStr) {
          const updateObj: any = {};
          if (updatedData.title !== undefined) updateObj.title = updatedData.title;
          if (updatedData.defaultStartTime !== undefined || updatedData.defaultEndTime !== undefined) {
            const start = updatedData.defaultStartTime || evtData.time?.split("~")[0] || "15:00";
            const end = updatedData.defaultEndTime || evtData.time?.split("~")[1] || "16:30";
            updateObj.time = `${start}~${end}`;
          }
          if (Object.keys(updateObj).length > 0) {
            updatePromises.push(updateDoc(doc(db, "calendar_events", docSnap.id), updateObj));
          }
        }
      });

      if (updatedData.repeatDays !== undefined || updatedData.startDate !== undefined || (updatedData.isRecurring !== undefined)) {
        const futureDocs = querySnapshot.docs.filter(d => d.data().date >= todayStr);
        await Promise.all(futureDocs.map(d => deleteDoc(doc(db, "calendar_events", d.id))));

        const isNowRecurring = updatedData.isRecurring !== undefined ? updatedData.isRecurring : true;
        const regenStartDate = updatedData.startDate || todayStr;
        const finalStartDate = regenStartDate > todayStr ? regenStartDate : todayStr;
        const newWeekdays = updatedData.repeatDays || [];
        const currentType = updatedData.type || "both";
        if (isNowRecurring && newWeekdays.length > 0 && (currentType === "calendar" || currentType === "both")) {
          const dates = generateTemplateDates(finalStartDate, newWeekdays, 12);
          const addPromises = dates.map(async (dt) => {
            const evId = `evt_${Math.random().toString(36).substr(2, 9)}`;
            await setDoc(doc(db, "calendar_events", evId), {
              id: evId,
              familyId: currentUserProfile.familyId,
              title: updatedData.title || (futureDocs.length > 0 ? futureDocs[0].data().title : ""),
              date: dt,
              time: `${updatedData.defaultStartTime || "15:00"}~${updatedData.defaultEndTime || "16:30"}`,
              category: "",
              isFixed: false,
              note: "",
              isPublic: true,
              creatorUid: user?.uid || "",
              creatorName: currentUserProfile?.displayName || "家長",
              createdAt: serverTimestamp(),
              templateId: activityId,
            });
          });
          await Promise.all(addPromises);
        }
      } else {
        await Promise.all(updatePromises);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `favorite_activities/${activityId}`);
    }
  };

  // Delete Favorite Activity with Cascade Downstream Syncing
  const handleDeleteFavorite = async (activityId: string, deleteFutureEvents: boolean = true) => {
    try {
      await deleteDoc(doc(db, "favorite_activities", activityId));
      
      if (deleteFutureEvents) {
        const todayStr = new Date().toLocaleDateString("sv-SE");
        const q = query(
          collection(db, "calendar_events"),
          where("familyId", "==", currentUserProfile?.familyId),
          where("templateId", "==", activityId)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises: Promise<void>[] = [];
        querySnapshot.forEach((docSnap) => {
          const evtData = docSnap.data();
          if (evtData.date >= todayStr) {
            deletePromises.push(deleteDoc(doc(db, "calendar_events", docSnap.id)));
          }
        });
        await Promise.all(deletePromises);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `favorite_activities/${activityId}`);
    }
  };

  // Update System active Mode
  const handleUpdateSystemMode = async (mode: SystemMode) => {
    if (!currentUserProfile?.familyId) return;
    const famId = currentUserProfile.familyId;
    try {
      await updateDoc(doc(db, "settings", famId), {
        systemMode: mode,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/${famId}`);
    }
  };

  // Save Configured Period Mode
  const handleSaveConfiguredMode = async (modeConfig: ConfiguredMode) => {
    if (!currentUserProfile?.familyId) return;
    const famId = currentUserProfile.familyId;
    const currentList = activeSetting?.configuredModes || [];
    const exists = currentList.some((m) => m.id === modeConfig.id);
    let updatedList: ConfiguredMode[];
    if (exists) {
      updatedList = currentList.map((m) => m.id === modeConfig.id ? modeConfig : m);
    } else {
      updatedList = [...currentList, modeConfig];
    }
    try {
      await updateDoc(doc(db, "settings", famId), {
        configuredModes: updatedList,
        updatedAt: serverTimestamp(),
      });
      clearCachedData(CACHE_KEY_SETTINGS(famId));
      setTimeout(() => {
        loadAppletData();
      }, 100);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/${famId}`);
    }
  };

  // Delete Configured Period Mode
  const handleDeleteConfiguredMode = async (modeId: string, deleteAssociatedEvents: boolean = true) => {
    console.log("[Delete Mode] Initializing deletion for modeId:", modeId, "deleteAssociatedEvents:", deleteAssociatedEvents);
    const famId = currentUserProfile?.familyId || effectiveUserProfile?.familyId || activeFamily?.id;
    if (!famId) {
      console.error("[Delete Mode Error] No familyId found for current session user.");
      throw new Error("無法取得目前使用者的家庭識別碼(familyId)，請重新登入。");
    }

    const currentList = activeSetting?.configuredModes || [];
    const modeToDelete = currentList.find((m) => m.id === modeId);

    if (!modeToDelete) {
      console.error("[Delete Mode Error] Mode not found in current settings configuredModes list.");
      throw new Error(`找不到 ID 為 ${modeId} 的排程模式資料。`);
    }

    console.log("[Delete Mode] Identified mode to delete:", modeToDelete);
    const updatedList = currentList.filter((m) => m.id !== modeId);

    try {
      // 1. Delete associated travel modes document if it exists separately
      console.log("[Delete Mode] Step 1: Deleting independent travel_modes doc if separate...");
      try {
        await deleteDoc(doc(db, "travel_modes", modeId));
        console.log("[Delete Mode] Travel mode doc deleted successfully.");
      } catch (err) {
        console.warn("[Delete Mode] Optional separate travel_modes collection deletion skipped or not found:", err);
      }

      // 2. Query and delete any calendar events within the mode date range and associated with this trip/exam name
      if (deleteAssociatedEvents) {
        console.log("[Delete Mode] Step 2: Querying calendar events in same family to delete:", famId);
        const q = query(
          collection(db, "calendar_events"),
          where("familyId", "==", famId)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises: Promise<void>[] = [];

        const { startDate, endDate, name } = modeToDelete;
        console.log(`[Delete Mode] Target boundaries: Name = "${name}", Date Range = ${startDate} ~ ${endDate}`);

        querySnapshot.forEach((docSnap) => {
          const evt = docSnap.data() as any;
          const evtDate = evt.date || evt.startDate;
          
          // Match by linked id OR by name within range
          const isLinked = evt.specialPeriodId === modeId;
          
          const tripNamePart = name.replace("旅行", "").replace("模式", "").trim();
          const matchesTitle = evt.title && (evt.title.includes(name) || (tripNamePart && evt.title.includes(tripNamePart)));
          const matchesNote = evt.note && (evt.note.includes(name) || (tripNamePart && evt.note.includes(tripNamePart)));
          const matchesDateAndText = evtDate && evtDate >= startDate && evtDate <= endDate && (matchesTitle || matchesNote);

          if (isLinked || matchesDateAndText) {
            console.log(`[Delete Mode] Scheduling deletion of calendar event: "${evt.title}" (ID: ${docSnap.id})`);
            deletePromises.push(deleteDoc(doc(db, "calendar_events", docSnap.id)));
          }
        });

        if (deletePromises.length > 0) {
          console.log(`[Delete Mode] Committing deletions for ${deletePromises.length} calendar events...`);
          await Promise.all(deletePromises);
          console.log("[Delete Mode] All associated calendar events deleted.");
        } else {
          console.log("[Delete Mode] No associated calendar events matching the mode found.");
        }
      } else {
        console.log("[Delete Mode] Step 2 skipped: Keeping calendar events as requested.");
      }

      // 3. Save the filtered configuredModes list to the settings document (This will automatically clean up nested itineraries/daily plans)
      console.log("[Delete Mode] Step 3: Saving updated configuredModes to settings...");
      await updateDoc(doc(db, "settings", famId), {
        configuredModes: updatedList,
        updatedAt: serverTimestamp(),
      });
      console.log("[Delete Mode] Mode configuredModes array updated, settings document saved successfully!");
      if (famId) {
        clearCachedData(CACHE_KEY_SETTINGS(famId));
        setTimeout(() => {
          loadAppletData();
        }, 100);
      }

    } catch (err: any) {
      console.error("[Delete Mode Crash] Error occurred during delete mode operation:", err);
      handleFirestoreError(err, OperationType.UPDATE, `settings/${famId}`);
      throw err;
    }
  };

  // Add Family Member manually
  const handleAddMember = async (memberData: {
    displayName: string;
    role: UserRole;
    birthday?: string;
    color?: string;
    photoURL?: string;
  }) => {
    if (!currentUserProfile?.familyId) return;
    try {
      const newUid = `user_v_${Math.random().toString(36).substr(2, 9)}`;
      const newProfile: any = {
        uid: newUid,
        email: "",
        displayName: memberData.displayName,
        photoURL: memberData.photoURL || "✿",
        color: memberData.color || "#B4C3B2",
        familyId: currentUserProfile.familyId,
        role: memberData.role,
        stars: 0,
        createdAt: serverTimestamp(),
      };
      if (memberData.birthday) newProfile.birthday = memberData.birthday;
      if (memberData.color) newProfile.color = memberData.color;
      
      await setDoc(doc(db, "users", newUid), newProfile);
      if (currentUserProfile.familyId) {
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
        setTimeout(() => loadAppletData(true), 100);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "users");
    }
  };

  // Edit Family Member manually
  const handleEditMember = async (
    memberUid: string,
    updatedData: {
      displayName: string;
      role: UserRole;
      birthday?: string;
      color?: string;
      photoURL?: string;
    }
  ) => {
    try {
      const updateObj: any = {
        displayName: updatedData.displayName,
        role: updatedData.role,
      };
      if (updatedData.birthday !== undefined) updateObj.birthday = updatedData.birthday;
      if (updatedData.color !== undefined) updateObj.color = updatedData.color;
      if (updatedData.photoURL !== undefined) updateObj.photoURL = updatedData.photoURL;
      
      await updateDoc(doc(db, "users", memberUid), updateObj);
      if (currentUserProfile?.familyId) {
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
        setTimeout(() => loadAppletData(true), 100);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${memberUid}`);
    }
  };

  // Delete Family Member
  const handleDeleteMember = async (memberUid: string) => {
    if (memberUid === user?.uid) {
      alert("不能刪除您自己喔！");
      return;
    }
    try {
      await deleteDoc(doc(db, "users", memberUid));
      if (currentUserProfile?.familyId) {
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
        setTimeout(() => loadAppletData(true), 100);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${memberUid}`);
    }
  };

  const getSystemModeChinese = (mode: string) => {
    switch (mode) {
      case "daily":
      case SystemMode.DAILY:
        return "日常模式";
      case "travel":
      case SystemMode.TRAVEL:
        return "旅遊模式";
      case "exam":
      case SystemMode.EXAM:
        return "考前模式";
      case "vacation":
      case SystemMode.VACATION:
        return "寒暑假模式";
      case "custom":
      case SystemMode.CUSTOM:
        return "自訂模式";
      default:
        return "日常模式";
    }
  };

  // Dynamic Period-Based Active Mode Resolution matching simulatedTodayDate
  const activeModeDetails = useMemo(() => {
    const modes = activeSetting?.configuredModes || [];
    const members = familyMembers || [];

    // Prioritized order picker:
    // 1. Travel Mode
    const travel = modes.find(m => m.type === SystemMode.TRAVEL && m.startDate <= simulatedTodayDate && simulatedTodayDate <= m.endDate);
    if (travel) {
      return { modeValue: SystemMode.TRAVEL, config: travel };
    }

    // 2. Exam Mode
    const exam = modes.find(m => m.type === SystemMode.EXAM && m.startDate <= simulatedTodayDate && simulatedTodayDate <= m.endDate);
    if (exam) {
      return { modeValue: SystemMode.EXAM, config: exam };
    }

    // 3. Vacation Mode
    const vacation = modes.find(m => m.type === SystemMode.VACATION && m.startDate <= simulatedTodayDate && simulatedTodayDate <= m.endDate);
    if (vacation) {
      return { modeValue: SystemMode.VACATION, config: vacation };
    }

    // 4. Custom Mode
    const custom = modes.find(m => m.type === SystemMode.CUSTOM && m.startDate <= simulatedTodayDate && simulatedTodayDate <= m.endDate);
    if (custom) {
      return { modeValue: SystemMode.CUSTOM, config: custom };
    }

    return {
      modeValue: SystemMode.DAILY,
      config: undefined,
    };
  }, [activeSetting?.configuredModes, familyMembers, simulatedTodayDate]);

  const currentModeValue = activeModeDetails.modeValue;
  const activeModeConfig = activeModeDetails.config;

  // 3. Render Loading screen
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 font-bold select-none">家庭生活管理系統啟動中...</p>
        </div>
      </div>
    );
  }

  // 4. Render Google Login Portal
  if (!user || !currentUserProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-sky-50 via-indigo-50/20 to-pink-50 flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Heart className="h-9 w-9 animate-pulse fill-indigo-200 stroke-indigo-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">家庭生活管理中心</h1>
            <p className="text-sm text-gray-500 font-medium">比行事曆更貼心，比記事本更有趣。用愛串聯全家生活！</p>
          </div>

          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 text-xs text-left leading-relaxed text-amber-900 space-y-1.5">
            <span className="font-extrabold text-amber-850 flex items-center gap-1.5">
              💡 安全與連接提醒：
            </span>
            <p>
              本系統採用 <b>Google 快速認證安全登入</b>。初次登入會引導設定您在家庭的角色。若安全視窗被瀏覽器攔截，可點選右上角的「在新分頁打開」連結正常認證。
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn || isSandboxLoggingIn}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:translate-y-0.5 text-white font-bold rounded-2xl shadow-md cursor-pointer transition flex items-center justify-center gap-2.5 tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4.5 w-4.5 text-indigo-200" /> {isLoggingIn ? "正在啟動 Google 登入..." : "使用 Google 快速登入"}
            </button>

            <div className="relative flex py-1 items-center justify-center">
              <span className="text-[11px] font-bold text-gray-400">─── 框架限制解決方案 ───</span>
            </div>

            <button
              onClick={handleSandboxLogin}
              disabled={isLoggingIn || isSandboxLoggingIn}
              className="w-full py-3 bg-[#FAF8F5] hover:bg-[#F4EFE6] text-[#6B4B3E] font-extrabold rounded-2xl border border-[#EFEAE2] active:translate-y-0.5 cursor-pointer transition flex items-center justify-center gap-2.5 tracking-wide text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
            >
              <span>🚪 免跳窗沙盒登入 (防瀏覽器阻擋模式)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Render Family Onboarding Selector (if user has no familyId linked)
  if (!currentUserProfile.familyId) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="max-w-lg w-full bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">您好，{currentUserProfile.displayName}！</h1>
            <p className="text-sm text-gray-500 font-medium">請選擇您的起步站，建立新家庭或加入您家人的暖心小組：</p>
          </div>

          {onboardingChoice === "none" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setOnboardingChoice("create");
                  setNewFamilyName(`${currentUserProfile.displayName}的幸福本家`);
                }}
                className="p-6 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-300 border border-gray-100 rounded-2xl text-left transition text-sm space-y-2 flex flex-col justify-between"
              >
                <span className="text-indigo-600 font-bold bg-white px-2.5 py-0.5 rounded-full text-xs">A 計畫</span>
                <h3 className="font-extrabold text-gray-800 text-sm mt-2">🏡 創建全新家庭</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  適合<b>管理員（媽媽）</b>發起本專案。建立後您將能指派週課表，指派任務賺星星。
                </p>
              </button>

              <button
                onClick={() => {
                  setOnboardingChoice("join");
                  setJoinDisplayName(currentUserProfile.displayName);
                }}
                className="p-6 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 border border-gray-100 rounded-2xl text-left transition text-sm space-y-2 flex flex-col justify-between"
              >
                <span className="text-emerald-700 font-bold bg-white px-2.5 py-0.5 rounded-full text-xs">B 計畫</span>
                <h3 className="font-extrabold text-gray-800 text-sm mt-2">🔑 加入既有家庭</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  適合<b>爸爸、小孩或其他家族成員</b>。輸入管理員媽媽產製的專屬進駐邀請代碼。
                </p>
              </button>
            </div>
          )}

          {/* ONBOARDING: Create Family */}
          {onboardingChoice === "create" && (
            <form onSubmit={handleCreateFamily} className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm border-l-4 border-indigo-600 pl-2">
                建立新家庭結構＆建立公告設定
              </h3>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">家庭管理中心名稱</label>
                <input
                  type="text"
                  required
                  placeholder="林家的幸福本家、小豬溫馨窩..."
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-555"
                />
              </div>
              <div className="bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-800 leading-relaxed font-sans">
                ⚠️ <b>確認聲明：</b> 建立本家庭後，您的角色將固定為<b>管理員（媽媽）</b>，擁有最高審核與刪除權力，並能產製代碼邀請其他成員！
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOnboardingChoice("none")}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 border rounded-lg transition"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={isOnboardingBusy || !newFamilyName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {isOnboardingBusy ? "家庭建立中..." : "確認創建家庭"}
                </button>
              </div>
            </form>
          )}

          {/* ONBOARDING: Join Family */}
          {onboardingChoice === "join" && (
            <form onSubmit={handleJoinFamily} className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm border-l-4 border-emerald-500 pl-2">
                輸入加入邀請代碼＆指定角色
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">家庭邀請代碼 (Family ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="請向媽媽索取代碼，例如: fam_xxxxxx"
                    value={joinFamilyId}
                    onChange={(e) => setJoinFamilyId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">您在家庭的暱稱顯示</label>
                  <input
                    type="text"
                    required
                    value={joinDisplayName}
                    onChange={(e) => setJoinDisplayName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">選擇您的家庭角色關係</label>
                <select
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value as UserRole)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                >
                  <option value={UserRole.PARENT}>爸爸媽媽（家長成員）- 可指派任務、與孩子進行確認並給予獎勵</option>
                  <option value={UserRole.KID}>小孩成員 - 查看行事曆任務、回報完成通關、發送許願池</option>
                  <option value={UserRole.MEMBER}>其他家庭成員 (外公外婆爺爺奶奶寵物等) - 唯讀檢視</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOnboardingChoice("none")}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 border rounded-lg transition"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={isOnboardingBusy || !joinFamilyId.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  {isOnboardingBusy ? "正在核實進入中..." : "核備並進入"}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-gray-50 pt-4 text-center">
            <button
               onClick={handleLogout}
               className="text-xs font-bold text-gray-400 hover:text-red-500 transition inline-flex items-center gap-1"
            >
               <LogOut className="h-3.5 w-3.5" /> 登出目前 Google 帳號
            </button>
          </div>
        </div>
      </div>
    );
  }



  const isSuperAdmin = currentUserProfile && (currentUserProfile.email === "juwen616@gmail.com" || currentUserProfile.role === UserRole.ADMIN);

  const getRoleLabel = (r?: UserRole) => {
    if (!r) return "無";
    if (r === UserRole.ADMIN) return "管理員";
    if (r === UserRole.PARENT) return "家長";
    if (r === UserRole.KID) return "小孩";
    if (r === UserRole.MEMBER) return "成員";
    if (r === UserRole.PET) return "寵物";
    return "未知";
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col text-gray-800">
      <Toaster position="top-right" />
      {/* Top Header Information panel */}
      <header
        id="applet-top-header"
        className="relative md:sticky md:top-0 bg-white border-b border-[#E5E1DA] z-40 shadow-sm font-sans flex flex-col"
      >
        {/* Upper Brand Row - Compressed height by 40%+ on mobile & desktop with direct horizontal layout */}
        <div className="px-4 py-1.5 md:py-2.5 flex flex-row items-center justify-between gap-3 flex-wrap md:flex-nowrap border-b border-[#F5F2EB]/50 md:px-6">
          <div className="flex items-center gap-1.5 select-none shrink-0">
            <div className="h-7 w-7 bg-[#4A6076] text-white rounded-lg flex items-center justify-center shrink-0">
              <Heart className="h-3.5 w-3.5 fill-white" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight text-[#2D2926] font-sans flex items-center gap-1 leading-none">
                🏡 小龜家生活大小事
              </h1>
              <span className="text-[9px] font-sans text-gray-400 mt-0.5 block leading-none">
                一家人的日常與成長
              </span>
            </div>
          </div>

          {/* Real-time Clock display with single-line format */}
          <div className="shrink-0">
            <Clock />
          </div>

          <div className="flex items-center gap-2 shrink-0 md:gap-3">
            {/* User badge representing EFFECTIVE (simulated/actual) profile role */}
            {effectiveUserProfile && (
              <div className="flex items-center gap-2 border-r border-[#E5E1DA] pr-2.5 pt-0.5 pb-0.5">
                <div
                  style={{ backgroundColor: effectiveUserProfile.color || "#B4C3B2" }}
                  className="h-7.5 w-7.5 rounded-full flex items-center justify-center text-xs text-[#2D2926] border border-[#E5E1DA] select-none font-extrabold shadow-sm shrink-0 animate-in fade-in"
                >
                  {(!effectiveUserProfile.photoURL || effectiveUserProfile.photoURL.startsWith("http")) 
                    ? (effectiveUserProfile.displayName ? effectiveUserProfile.displayName.charAt(0) : "✿") 
                    : effectiveUserProfile.photoURL}
                </div>
                <div className="text-right">
                  <h3 className="text-[11px] font-extrabold text-[#2D2926] leading-none">
                    {effectiveUserProfile.displayName}
                  </h3>
                  <span className={`inline-block text-[8px] font-bold mt-0.5 px-1 py-0.5 rounded select-none leading-none ${
                    effectiveUserProfile.role === UserRole.ADMIN
                      ? "bg-rose-100 text-rose-800"
                      : effectiveUserProfile.role === UserRole.PARENT
                      ? "bg-indigo-100 text-indigo-800"
                      : effectiveUserProfile.role === UserRole.KID
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {effectiveUserProfile.role === UserRole.ADMIN && "管理員"}
                    {effectiveUserProfile.role === UserRole.PARENT && "家長"}
                    {effectiveUserProfile.role === UserRole.KID && `小孩 🌟 ${effectiveUserProfile.stars || 0}`}
                    {effectiveUserProfile.role === UserRole.MEMBER && "成員"}
                    {effectiveUserProfile.role === UserRole.PET && "寵物 🐾"}
                  </span>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setShowDevPanel(true)}
                className="p-1 px-2 text-[10px] font-bold text-[#5B7283] hover:text-[#3C332D] bg-[#F7F3EB] hover:bg-[#EFEAE2] border border-[#EFEAE2] rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="切換模擬角色測試"
              >
                ⚙️ 測試
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition"
              title="登出系統"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Japanese style Horizontal Tab navigation bar - Clean and scrollable on mobile (Hidden on Mobile, replaced by Bottom Bar) */}
        <div className="bg-[#FAF9F6] border-b border-[#E5E1DA] px-4 py-1.5 md:px-6 hidden md:block">
          <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4 overflow-x-auto scrollbar-none py-0.5">
            <div className="flex items-center gap-1.5 select-none overflow-x-auto scrollbar-none whitespace-nowrap flex-nowrap shrink-0">
              <button
                onClick={() => setActivePage("home")}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "home"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                首頁
              </button>

              <button
                onClick={() => setActivePage("calendar")}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "calendar"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                家庭行事曆
              </button>

              <button
                onClick={() => setActivePage("tasks")}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "tasks"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                任務中心
              </button>

              <button
                onClick={() => setActivePage("rewards")}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "rewards"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                禮物中心
              </button>

              {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
                <button
                  onClick={() => setActivePage("favorites")}
                  className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                    activePage === "favorites"
                      ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                      : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                  }`}
                >
                  常用事項
                </button>
              )}

              <button
                onClick={() => setActivePage("special-periods")}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "special-periods"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                特別期間安排
              </button>

              {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
                <button
                  onClick={() => setActivePage("members")}
                  className={`px-3.5 py-1 text-xs font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                    activePage === "members"
                      ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                      : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                  }`}
                >
                  家庭成員
                </button>
              )}
            </div>

            {/* Mode indicator badge */}
            <div className="shrink-0 flex items-center gap-1 bg-white border border-[#E5E1DA] px-2.5 py-0.5 rounded-full text-[10px] font-black text-[#5B7283] whitespace-nowrap">
              🌱 模式：{getSystemModeChinese(currentModeValue)}
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE STICKY HORIZONTAL TAB BAR - scrolls horizontally, sticky on mobile */}
      <div className="sticky top-0 bg-white/94 backdrop-blur-md border-b border-[#EFEAE2] p-2.5 z-40 md:hidden block shadow-xs overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 whitespace-nowrap scroll-smooth w-full select-none">
          <button
            onClick={() => handleScrollToSection("mobile-section-home", "home")}
            className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
              activeMobileSection === "home"
                ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
            }`}
          >
            🏠 首頁
          </button>
          
          <button
            onClick={() => handleScrollToSection("mobile-section-calendar", "calendar")}
            className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
              activeMobileSection === "calendar"
                ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
            }`}
          >
            📅 家庭行事曆
          </button>

          <button
            onClick={() => handleScrollToSection("mobile-section-tasks", "tasks")}
            className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
              activeMobileSection === "tasks"
                ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
            }`}
          >
            ✅ 任務中心
          </button>

          <button
            onClick={() => handleScrollToSection("mobile-section-rewards", "rewards")}
            className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
              activeMobileSection === "rewards"
                ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
            }`}
          >
            🎁 禮物中心
          </button>

          {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
            <button
              onClick={() => handleScrollToSection("mobile-section-favorites", "favorites")}
              className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
                activeMobileSection === "favorites"
                  ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                  : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
              }`}
            >
              ⚡ 常用事項
            </button>
          )}

          <button
            onClick={() => handleScrollToSection("mobile-section-special-periods", "special-periods")}
            className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
              activeMobileSection === "special-periods"
                ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
            }`}
          >
            🏕️ 特別期間安排
          </button>

          {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
            <button
              onClick={() => handleScrollToSection("mobile-section-members", "members")}
              className={`mobile-tab-btn px-4 py-1.5 text-xs font-black rounded-full transition-all border shrink-0 ${
                activeMobileSection === "members"
                  ? "mobile-tab-active bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] font-extrabold shadow-xs"
                  : "bg-[#FFFDFB] text-[#5B7283] border-[#EFEAE2]"
              }`}
            >
              👨‍👩‍👧‍👦 家庭成員
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-grow max-w-7xl w-full mx-auto p-4 lg:p-6 pb-6">
        
        {/* Primary Workspace Sections */}
        <main className="w-full">
          <ErrorBoundary>
            {/* DESKTOP MODE VIEW (conditional tab pages) */}
            <div className="hidden md:block w-full">
              {activePage === "home" && effectiveUserProfile && (
                <HomeDashboard
                  currentUser={effectiveUserProfile}
                  events={events}
                  announcements={announcements}
                  tasks={tasks}
                  familyMembers={familyMembers}
                  systemMode={currentModeValue}
                  rewards={rewards}
                  onAddAnnouncement={handleAddAnnouncement}
                  onDeleteAnnouncement={handleDeleteAnnouncement}
                  onNavigateToEvent={handleNavigateToEvent}
                  activeModeConfig={activeModeConfig}
                  configuredModes={activeSetting?.configuredModes || []}
                  simulatedTodayDate={simulatedTodayDate}
                  onSetSimulatedTodayDate={setSimulatedTodayDate}
                  onSaveConfiguredMode={handleSaveConfiguredMode}
                  onDeleteConfiguredMode={handleDeleteConfiguredMode}
                  dataLoaded={dataLoaded}
                />
              )}

              {activePage === "calendar" && effectiveUserProfile && (
                <CalendarView
                  currentUser={effectiveUserProfile}
                  events={events}
                  favoriteActivities={favoriteActivities}
                  familyMembers={familyMembers}
                  deepLink={calendarDeepLink}
                  onClearDeepLink={() => setCalendarDeepLink(null)}
                  onAddEvent={handleAddEvent}
                  onEditEvent={handleEditEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onAddFavorite={handleAddFavorite}
                  configuredModes={activeSetting?.configuredModes || []}
                  simulatedTodayDate={simulatedTodayDate}
                  onSaveConfiguredMode={handleSaveConfiguredMode}
                  onChangePage={setActivePage}
                />
              )}

              {activePage === "tasks" && effectiveUserProfile && (
                <TaskSystem
                  currentUser={effectiveUserProfile}
                  tasks={tasks}
                  familyMembers={familyMembers}
                  systemMode={currentModeValue}
                  favoriteActivities={favoriteActivities}
                  onAddTask={handleAddTask}
                  onSubmitTask={handleSubmitTask}
                  onApproveTask={handleApproveTask}
                  onRejectTask={handleRejectTask}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={handleEditTask}
                  simulatedTodayDate={simulatedTodayDate}
                />
              )}

              {activePage === "rewards" && effectiveUserProfile && (
                <RewardCenter
                  currentUser={effectiveUserProfile}
                  rewards={rewards}
                  redemptions={redemptions}
                  familyMembers={familyMembers}
                  starTransactions={starTransactions}
                  onAdjustStars={handleAdjustStars}
                  onAddReward={handleAddReward}
                  onApproveWish={handleApproveWish}
                  onRedeemReward={handleRedeemReward}
                  onApproveRedemption={handleApproveRedemption}
                  onRejectRedemption={handleRejectRedemption}
                  onDeleteReward={handleDeleteReward}
                  onUpdateReward={handleUpdateReward}
                />
              )}

              {activePage === "favorites" && effectiveUserProfile && (
                <FavoriteMgr
                  currentUser={effectiveUserProfile}
                  favoriteActivities={favoriteActivities}
                  onAddFavorite={handleAddFavorite}
                  onDeleteFavorite={handleDeleteFavorite}
                  onEditFavorite={handleEditFavorite}
                />
              )}

              {activePage === "special-periods" && effectiveUserProfile && (
                <SpecialPeriodsConfig
                  currentUser={effectiveUserProfile}
                  configuredModes={activeSetting?.configuredModes || []}
                  systemMode={currentModeValue}
                  onSaveConfiguredMode={handleSaveConfiguredMode}
                  onDeleteConfiguredMode={handleDeleteConfiguredMode}
                  simulatedTodayDate={simulatedTodayDate}
                />
              )}

              {activePage === "members" && effectiveUserProfile && (
                <MembersCenter
                  currentUser={effectiveUserProfile}
                  familyMembers={familyMembers}
                  systemMode={currentModeValue}
                  familyId={effectiveUserProfile.familyId || ""}
                  familyName={activeFamily?.name || "家庭名單"}
                  tasks={tasks}
                  redemptions={redemptions}
                  onUpdateSystemMode={handleUpdateSystemMode}
                  onAddMember={handleAddMember}
                  onEditMember={handleEditMember}
                  onDeleteMember={handleDeleteMember}
                  configuredModes={activeSetting?.configuredModes || []}
                  onSaveConfiguredMode={handleSaveConfiguredMode}
                  onDeleteConfiguredMode={handleDeleteConfiguredMode}
                  simulatedTodayDate={simulatedTodayDate}
                  onSetSimulatedTodayDate={setSimulatedTodayDate}
                />
              )}
            </div>

            {/* MOBILE MODE VIEW (single-page vertical nesting layout) */}
            <div className="block md:hidden w-full space-y-12">
              {effectiveUserProfile && (
                <>
                  {/* 首頁 */}
                  <section id="mobile-section-home" className="scroll-mt-16 animate-in fade-in duration-300">
                    <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                      <div className="border-b border-rose-100 pb-2 mb-4">
                        <h2 className="text-sm font-black text-[#C76A5A] flex items-center gap-1">
                          <span>🏠</span> 家長小孩共享首頁
                        </h2>
                      </div>
                      <HomeDashboard
                        currentUser={effectiveUserProfile}
                        events={events}
                        announcements={announcements}
                        tasks={tasks}
                        familyMembers={familyMembers}
                        systemMode={currentModeValue}
                        rewards={rewards}
                        onAddAnnouncement={handleAddAnnouncement}
                        onDeleteAnnouncement={handleDeleteAnnouncement}
                        onNavigateToEvent={(eventId, date) => handleScrollToSection("mobile-section-calendar", "calendar")}
                        activeModeConfig={activeModeConfig}
                        configuredModes={activeSetting?.configuredModes || []}
                        simulatedTodayDate={simulatedTodayDate}
                        onSetSimulatedTodayDate={setSimulatedTodayDate}
                        onSaveConfiguredMode={handleSaveConfiguredMode}
                        onDeleteConfiguredMode={handleDeleteConfiguredMode}
                        dataLoaded={dataLoaded}
                      />
                    </div>
                  </section>

                  {/* 家庭行事曆 */}
                  <section id="mobile-section-calendar" className="scroll-mt-16 animate-in fade-in duration-300">
                    <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                      <div className="border-b border-rose-100 pb-2 mb-4">
                        <h2 className="text-sm font-black text-[#5B7283] flex items-center gap-1">
                          <span>📅</span> 家庭行事曆
                        </h2>
                      </div>
                      <CalendarView
                        currentUser={effectiveUserProfile}
                        events={events}
                        favoriteActivities={favoriteActivities}
                        familyMembers={familyMembers}
                        deepLink={calendarDeepLink}
                        onClearDeepLink={() => setCalendarDeepLink(null)}
                        onAddEvent={handleAddEvent}
                        onEditEvent={handleEditEvent}
                        onDeleteEvent={handleDeleteEvent}
                        onAddFavorite={handleAddFavorite}
                        configuredModes={activeSetting?.configuredModes || []}
                        simulatedTodayDate={simulatedTodayDate}
                        onSaveConfiguredMode={handleSaveConfiguredMode}
                        onChangePage={setActivePage}
                      />
                    </div>
                  </section>

                  {/* 任務中心 */}
                  <section id="mobile-section-tasks" className="scroll-mt-16 animate-in fade-in duration-300">
                    <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                      <div className="border-b border-rose-100 pb-2 mb-4">
                        <h2 className="text-sm font-black text-[#5D8064] flex items-center gap-1">
                          <span>✅</span> 任務中心與回報通關
                        </h2>
                      </div>
                      <TaskSystem
                        currentUser={effectiveUserProfile}
                        tasks={tasks}
                        familyMembers={familyMembers}
                        systemMode={currentModeValue}
                        favoriteActivities={favoriteActivities}
                        onAddTask={handleAddTask}
                        onSubmitTask={handleSubmitTask}
                        onApproveTask={handleApproveTask}
                        onRejectTask={handleRejectTask}
                        onDeleteTask={handleDeleteTask}
                        onEditTask={handleEditTask}
                        simulatedTodayDate={simulatedTodayDate}
                      />
                    </div>
                  </section>

                  {/* 禮物中心 */}
                  <section id="mobile-section-rewards" className="scroll-mt-16 animate-in fade-in duration-300">
                    <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                      <div className="border-b border-rose-100 pb-2 mb-4">
                        <h2 className="text-sm font-black text-[#BB7E67] flex items-center gap-1">
                          <span>🎁</span> 禮物中心與星星祈願
                        </h2>
                      </div>
                      <RewardCenter
                        currentUser={effectiveUserProfile}
                        rewards={rewards}
                        redemptions={redemptions}
                        familyMembers={familyMembers}
                        starTransactions={starTransactions}
                        onAdjustStars={handleAdjustStars}
                        onAddReward={handleAddReward}
                        onApproveWish={handleApproveWish}
                        onRedeemReward={handleRedeemReward}
                        onApproveRedemption={handleApproveRedemption}
                        onRejectRedemption={handleRejectRedemption}
                        onDeleteReward={handleDeleteReward}
                        onUpdateReward={handleUpdateReward}
                      />
                    </div>
                  </section>

                  {/* 常用事項 */}
                  {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
                    <section id="mobile-section-favorites" className="scroll-mt-16 animate-in fade-in duration-300">
                      <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                        <div className="border-b border-rose-100 pb-2 mb-4">
                          <h2 className="text-sm font-black text-[#577085] flex items-center gap-1">
                            <span>⚡</span> 常用事項管理 (家長專屬)
                          </h2>
                        </div>
                        <FavoriteMgr
                          currentUser={effectiveUserProfile}
                          favoriteActivities={favoriteActivities}
                          onAddFavorite={handleAddFavorite}
                          onDeleteFavorite={handleDeleteFavorite}
                          onEditFavorite={handleEditFavorite}
                        />
                      </div>
                    </section>
                  )}

                  {/* 特別期間安排 */}
                  <section id="mobile-section-special-periods" className="scroll-mt-16 animate-in fade-in duration-300">
                    <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                      <div className="border-b border-rose-100 pb-2 mb-4">
                        <h2 className="text-sm font-black text-[#7559AC] flex items-center gap-1">
                          <span>🏕️</span> 特別期間與家庭模式安排
                        </h2>
                      </div>
                      <SpecialPeriodsConfig
                        currentUser={effectiveUserProfile}
                        configuredModes={activeSetting?.configuredModes || []}
                        systemMode={currentModeValue}
                        onSaveConfiguredMode={handleSaveConfiguredMode}
                        onDeleteConfiguredMode={handleDeleteConfiguredMode}
                        simulatedTodayDate={simulatedTodayDate}
                      />
                    </div>
                  </section>

                  {/* 家庭成員 */}
                  {effectiveUserProfile && (effectiveUserProfile.role === UserRole.ADMIN || effectiveUserProfile.role === UserRole.PARENT) && (
                    <section id="mobile-section-members" className="scroll-mt-16 animate-in fade-in duration-300">
                      <div className="border border-[#EFEAE2] rounded-[24px] bg-[#FCFBF9] p-4 soft-journal-shadow">
                        <div className="border-b border-rose-100 pb-2 mb-4">
                          <h2 className="text-sm font-black text-[#3C332D] flex items-center gap-1">
                            <span>👨‍👩‍👧‍👦</span> 家庭成員與系統狀態
                          </h2>
                        </div>
                        <MembersCenter
                          currentUser={effectiveUserProfile}
                          familyMembers={familyMembers}
                          systemMode={currentModeValue}
                          familyId={effectiveUserProfile.familyId || ""}
                          familyName={activeFamily?.name || "家庭名單"}
                          tasks={tasks}
                          redemptions={redemptions}
                          onUpdateSystemMode={handleUpdateSystemMode}
                          onAddMember={handleAddMember}
                          onEditMember={handleEditMember}
                          onDeleteMember={handleDeleteMember}
                          configuredModes={activeSetting?.configuredModes || []}
                          onSaveConfiguredMode={handleSaveConfiguredMode}
                          onDeleteConfiguredMode={handleDeleteConfiguredMode}
                          simulatedTodayDate={simulatedTodayDate}
                          onSetSimulatedTodayDate={setSimulatedTodayDate}
                        />
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      <footer className="bg-white border-t border-gray-100 py-4 text-center text-[10px] text-gray-400 select-none">
        <p>© 2026 家庭生活管理中心 Family Schedule V2 · 以愛為核心的極簡清新設計</p>
      </footer>

      {currentUserProfile && (
        <PerformanceDebugPanel
          loadTimeMs={loadTimeMs}
          queryCount={queryCount}
          listenerCount={listenerCount}
          lagSimulated={lagSimulated}
          setLagSimulated={setLagSimulated}
          currentUserEmail={user?.email || "測試/無帳密登入"}
          currentUserDisplayName={effectiveUserProfile?.displayName || "一般"}
          currentUserRole={getRoleLabel(effectiveUserProfile?.role || UserRole.MEMBER)}
          familyId={effectiveUserProfile?.familyId}
          onResetCounters={handleResetCounters}
          onFastRoleSwitch={handleFastRoleSwitch}
          familyMembers={familyMembers}
          simulatedRole={simulatedRole}
          simulatedMemberId={simulatedMemberId}
          simulatedTodayDate={simulatedTodayDate}
          onSetSimulatedTodayDate={setSimulatedTodayDate}
          cacheHitRate={cacheRequests > 0 ? Math.round((cacheHits / cacheRequests) * 100) : 0}
          firestoreLogs={firestoreLogs}
        />
      )}

      {/* Developer Mode simulation switcher panel overlay */}
      {showDevPanel && currentUserProfile && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-2xl w-full relative font-sans shadow-xl">
            <button
              onClick={() => setShowDevPanel(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-[#3C332D] mb-2 flex items-center gap-2">
              🧪 角色模擬測試中心 (Developer Mode)
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-5 leading-relaxed">
              身為最高權限管理員，在此處您可以快速模擬切換至任意家庭角色或特定成員的 UI 視角。
              此模式僅修改前端視角權限與 UI，<b>絕對不會</b>修改任何 Firestore 資料庫或實際使用者資料。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Switch Identity */}
              <div className="space-y-4">
                <div className="p-4 bg-rose-50/20 border border-rose-100 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-gray-500 block">【 1. 切換模擬角色身份 】</span>
                  <div className="flex flex-col gap-2">
                    {[
                      { role: UserRole.ADMIN, label: "管理員（所有管理權限）" },
                      { role: UserRole.PARENT, label: "家長（指派任務、確認回報、獎勵許願）" },
                      { role: UserRole.KID, label: "小孩（日常任務完成、發送許願、累積星星）" },
                      { role: UserRole.MEMBER, label: "家庭成員（行程與一般通知）" },
                      { role: UserRole.PET, label: "寵物（萌寵視角、打針提醒與日常大小事）" }
                    ].map((item) => (
                      <label key={item.role} className="flex items-center gap-2 text-xs font-bold text-[#3C332D] cursor-pointer">
                        <input
                          type="radio"
                          name="simulate-role"
                          checked={simulatedRole === item.role}
                          onChange={() => {
                            setSimulatedRole(item.role);
                            setDeveloperModeActive(true);
                          }}
                          className="h-4 w-4 text-[#5B7283] cursor-pointer"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#EFEAE2] rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-gray-400 block">【 2. 切換特定模擬成員 】</span>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#3C332D] cursor-pointer">
                      <input
                        type="radio"
                        name="simulate-member"
                        checked={!simulatedMemberId}
                        onChange={() => {
                          setSimulatedMemberId(null);
                        }}
                        className="h-4 w-4 text-[#5B7283] cursor-pointer"
                      />
                      <span>不限定（僅切換角色）</span>
                    </label>

                    {familyMembers.map((m) => (
                      <label key={m.uid} className="flex items-center gap-2 text-xs font-bold text-[#3C332D] cursor-pointer">
                        <input
                          type="radio"
                          name="simulate-member"
                          checked={simulatedMemberId === m.uid}
                          onChange={() => {
                            setSimulatedMemberId(m.uid);
                            setSimulatedRole(m.role); // automatically match role too
                            setDeveloperModeActive(true);
                          }}
                          className="h-4 w-4 text-[#5B7283] cursor-pointer"
                        />
                        <span className="flex items-center gap-1.5">
                          {m.displayName}
                          <span className="text-[10px] font-normal text-gray-400">({getRoleLabel(m.role)})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Privilege Matrix Table */}
              <div className="border border-[#EFEAE2] rounded-2xl p-4 bg-[#FAF8F5] space-y-3 font-sans">
                <span className="text-xs font-black text-[#3C332D] block mb-2">📋 模擬角色權限總覽表</span>
                <div className="overflow-x-auto text-[11px] leading-relaxed">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFEAE2] font-extrabold text-gray-500">
                        <th className="pb-1.5">角色</th>
                        <th className="pb-1.5">可見頁面</th>
                        <th className="pb-1.5">可執行功能</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-650">
                      <tr>
                        <td className="py-2 text-[#EAA59E] font-bold">管理員</td>
                        <td className="py-2">全部頁面</td>
                        <td className="py-2">完整管理、成員管理、系統設定設定</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-[#5B7283] font-bold">家長</td>
                        <td className="py-2">排除核心系統設定</td>
                        <td className="py-2">任務指派、回報確認、活動登錄</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-amber-600 font-bold">小孩</td>
                        <td className="py-2">首頁、行事曆、任務、禮物</td>
                        <td className="py-2">完成回報與認證、累積星星兌換、許願</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-emerald-600 font-bold">家庭成員</td>
                        <td className="py-2">首頁、行事曆、任務</td>
                        <td className="py-2">日程確認、家庭公告和訊息</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold">寵物</td>
                        <td className="py-2">首頁、行事曆</td>
                        <td className="py-2">萌寵狀態、接種提醒、萌照展示</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-5 mt-5 border-t border-[#F7F3EB]">
              <span className="text-xs text-gray-400 font-bold">
                * 真實角色：{currentUserProfile?.displayName} ({getRoleLabel(currentUserProfile?.role)})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeveloperModeActive(false);
                    setSimulatedRole(null);
                    setSimulatedMemberId(null);
                    setShowDevPanel(false);
                  }}
                  className="px-4 py-2 border border-[#EFEAE2] text-xs font-bold text-gray-500 bg-white rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  解除模擬
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDevPanel(false);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-xl transition cursor-pointer"
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
