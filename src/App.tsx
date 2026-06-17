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
  FamilyNote,
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
import FamilyNotesView from "./components/FamilyNotesView";
import { canManageFamily, getPermissionsByRole } from "./utils/permissionUtils";
import MembersCenter from "./components/MembersCenter";
import { SpecialPeriodsConfig } from "./components/SpecialPeriodsConfig";
import PerformanceDebugPanel from "./components/PerformanceDebugPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AdminCenter from "./components/AdminCenter";

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
  MoreHorizontal,
  Menu,
  Bell,
  Settings,
  BookOpen,
} from "lucide-react";

export const getRoleLabel = (r?: UserRole | string) => {
  if (!r) return "無";
  if (r === UserRole.SUPER_ADMIN) return "超級管理員";
  if (r === UserRole.OWNER || r === "Owner") return "管理員";
  if (r === UserRole.PARENT) return "家長";
  if (r === UserRole.CHILD || r === "Child") return "小孩";
  if (r === UserRole.VIEWER || r === "Viewer") return "成員";
  return "未知";
};

export function normalizeDbRole(roleStr: string | undefined): UserRole {
  if (!roleStr) return UserRole.VIEWER;
  const lower = roleStr.toLowerCase();
  if (lower === "owner" || lower === "admin") return UserRole.OWNER;
  if (lower === "parent") return UserRole.PARENT;
  if (lower === "child" || lower === "kid") return UserRole.CHILD;
  if (lower === "viewer" || lower === "member" || lower === "pet") return UserRole.VIEWER;
  return UserRole.VIEWER;
}

export function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    // If it's a firebaseFieldValue or similar, return as is
    if (obj.constructor && obj.constructor.name === "FieldValue") {
      return obj;
    }
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = removeUndefinedFields(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSandboxLoggingIn, setIsSandboxLoggingIn] = useState(false);

  // New states for the redesigned landing login page
  const [loginTab, setLoginTab] = useState<"google" | "invite">("google");
  const [bindGoogle, setBindGoogle] = useState(true);

  // States for simplified invitations flow
  const [foundInvite, setFoundInvite] = useState<any | null>(null);
  const [isSearchingInvite, setIsSearchingInvite] = useState(false);
  const [searchInviteError, setSearchInviteError] = useState<string | null>(null);

  // 5-second Auth loading timeout guard to prevent page freezing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoadingAuth) {
        console.warn("Auth initialization timed out (5s), displaying login portal directly.");
        setIsLoadingAuth(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoadingAuth]);

  // Family Onboarding states
  const [onboardingChoice, setOnboardingChoice] = useState<"none" | "create" | "join">("none");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [joinFamilyId, setJoinFamilyId] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinRole, setJoinRole] = useState<UserRole>(UserRole.PARENT);
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [isOnboardingBusy, setIsOnboardingBusy] = useState(false);
  const [googleMatchInvite, setGoogleMatchInvite] = useState<any>(null);

  // Whitelisting & Requests
  const [isWhitelistedCreator, setIsWhitelistedCreator] = useState(false);
  const [myPendingRequest, setMyPendingRequest] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [hasRepairedBirthdays, setHasRepairedBirthdays] = useState(false);

  // Navigation page state
  const [activePage, setActivePage] = useState<"home" | "calendar" | "tasks" | "rewards" | "favorites" | "members" | "special-periods" | "admin-center" | "admin" | "notes" | "more">("home");
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
  const [simulatedFamilyId, setSimulatedFamilyId] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [devModalTab, setDevModalTab] = useState<"roles" | "metrics" | "logs">("roles");

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

  const addAuditLog = async (action: string, targetId: string = "", targetName: string = "") => {
    try {
      const currentProfile = currentUserProfile;
      if (!currentProfile) return;
      const logId = `aud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await setDoc(doc(db, "audit_logs", logId), {
        id: logId,
        userId: currentProfile.uid,
        userName: `${currentProfile.displayName} (${currentProfile.role})`,
        familyId: currentProfile.familyId || "",
        action,
        targetId,
        targetName,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
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
  const [familyNotes, setFamilyNotes] = useState<FamilyNote[]>([]);
  const [favoriteActivities, setFavoriteActivities] = useState<CommonTemplate[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [starTransactions, setStarTransactions] = useState<any[]>([]);
  const [recentlyDeletedTransactions, setRecentlyDeletedTransactions] = useState<any[]>([]);

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

    let base = { ...currentUserProfile };

    if (simulatedFamilyId) {
      base.familyId = simulatedFamilyId;
    }

    if (developerModeActive) {
      // Find the member if simulatedMemberId is specified:
      if (simulatedMemberId) {
        const found = familyMembers.find((m) => m.uid === simulatedMemberId);
        if (found) {
          base = {
            ...base,
            displayName: found.displayName,
            role: normalizeDbRole(found.role),
            photoURL: found.photoURL || "",
            stars: found.stars || 0,
            uid: found.uid,
          } as any;
        }
      }

      if (simulatedRole) {
        base.role = normalizeDbRole(simulatedRole);
      }
    }

    // Ensure normalized role at all times
    base.role = normalizeDbRole(base.role);

    return base as UserProfile;
  }, [developerModeActive, simulatedRole, simulatedMemberId, simulatedFamilyId, currentUserProfile, familyMembers]);


  // Mobile single-page interface helper
  const handleScrollToSection = (id: string, sectionKey: string) => {
    if (activePage === "admin") {
      setActivePage("home");
    }
    setActiveMobileSection(sectionKey);
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        const headerOffset = 115; // Adjusted to perfectly align under the sticky mobile headers
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 100);
  };

  // Auto-center mobile tab scroll when activeMobileSection or activePage changes
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const activeKey = activePage === "admin" ? "admin" : activeMobileSection;
    if (activeKey) {
      const activeBtn = document.getElementById(`mobile-tab-btn-${activeKey}`);
      const scrollContainer = document.getElementById("mobile-tab-scroll-container");
      if (activeBtn && scrollContainer) {
        const containerWidth = scrollContainer.offsetWidth;
        const btnLeft = activeBtn.offsetLeft;
        const btnWidth = activeBtn.offsetWidth;
        scrollContainer.scrollTo({
          left: btnLeft - containerWidth / 2 + btnWidth / 2,
          behavior: "smooth"
        });
      }
    }
  }, [activeMobileSection, activePage]);

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

  // Load Whitelist status dynamically
  useEffect(() => {
    if (!user || !user.email) {
      setIsWhitelistedCreator(false);
      return;
    }
    if (user.email.toLowerCase() === "juwen616@gmail.com") {
      setIsWhitelistedCreator(true);
      return;
    }
    const checkWhitelist = async () => {
      try {
        const creatorsRef = collection(db, "allowed_family_creators");
        const q = query(creatorsRef, where("email", "==", user.email!.toLowerCase()));
        getDocs(q).then((qSnap) => {
          let active = false;
          qSnap.forEach(docSnap => {
            if (docSnap.data().status === "active") {
              active = true;
            }
          });
          setIsWhitelistedCreator(active);
        }).catch(err => {
          console.error("Error loading whitelist snap:", err);
        });
      } catch (err) {
        console.error("Error loading whitelist:", err);
      }
    };
    checkWhitelist();
  }, [user?.email]);

  // One-time repair for missing birthday information/nested member alignment
  useEffect(() => {
    if (currentUserProfile?.familyId && !hasRepairedBirthdays) {
      setHasRepairedBirthdays(true);
      runAutoRepair(currentUserProfile.familyId);
    }
  }, [currentUserProfile?.familyId, hasRepairedBirthdays]);

  // Helper to check and search invitations for Google accounts
  const checkGoogleInvites = async (email: string | null) => {
    if (!email) return;
    try {
      console.log("Checking Google match invite for:", email);
      const q = query(
        collection(db, "invites"),
        where("email", "==", email.toLowerCase()),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const invData = docSnap.data();
        console.log("Automatic Google invite match found:", invData);
        setGoogleMatchInvite({
          id: docSnap.id,
          ...invData
        });
      } else {
        setGoogleMatchInvite(null);
      }
    } catch (err) {
      console.error("Error checking direct Google invites:", err);
    }
  };

  // 1. Monitor Authentication State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoadingAuth(true);
      if (firebaseUser) {
        try {
          // Check if there is an existing user doc in "users" collection mapping to this googleUid or email
          let profileDoc: any = null;
          
          // First, query by googleUid
          const qUid = query(collection(db, "users"), where("googleUid", "==", firebaseUser.uid));
          const snapUid = await getDocs(qUid);
          if (!snapUid.empty) {
            profileDoc = snapUid.docs[0];
          } else if (firebaseUser.email) {
            // Second, check by email
            const qEmail = query(collection(db, "users"), where("email", "==", firebaseUser.email));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
              profileDoc = snapEmail.docs[0];
            }
          }

          let matchedProfile: UserProfile | null = null;
          let effectiveUid = firebaseUser.uid;

          if (profileDoc) {
            matchedProfile = profileDoc.data() as UserProfile;
            effectiveUid = profileDoc.id;
            
            // Override user state to make sure all features refer to original member UID
            setUser({
              uid: effectiveUid,
              email: firebaseUser.email || matchedProfile.email || "",
              displayName: firebaseUser.displayName || matchedProfile.displayName,
              photoURL: firebaseUser.photoURL || matchedProfile.photoURL || "✿",
              isAnonymous: false,
            } as any);
          } else {
            setUser(firebaseUser);
          }

          // Attempt to pull user profile doc
          const userDocRef = doc(db, "users", effectiveUid);
          const userSnap = matchedProfile ? { exists: () => true, data: () => matchedProfile, id: effectiveUid } : await getDoc(userDocRef);

          // Standard loading flow
          if (userSnap.exists()) {
            const profileData = (matchedProfile ? matchedProfile : userSnap.data()) as UserProfile;
            if (profileData.familyId) {
              try {
                const nestedMemberSnap = await getDoc(
                  doc(db, "families", profileData.familyId, "members", effectiveUid)
                );
                if (nestedMemberSnap.exists()) {
                  const nestedData = nestedMemberSnap.data();
                  if (nestedData?.role) {
                    profileData.role = normalizeDbRole(nestedData.role);
                  }
                }
              } catch (nestedErr) {
                console.warn("Failed to fetch nested member role on login:", nestedErr);
              }
              setCurrentUserProfile(profileData);
              setActivePage("home");
              setOnboardingChoice("none");
            } else {
              setCurrentUserProfile(profileData);
              await checkGoogleInvites(firebaseUser.email);
            }
          } else {
            const initProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "家庭成員",
              photoURL: "✿",
              color: "#B4C3B2",
              familyId: null,
              role: UserRole.MEMBER,
              stars: 0,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, initProfile);
            setCurrentUserProfile(initProfile);
            await checkGoogleInvites(firebaseUser.email);
          }
        } catch (err) {
          console.error("Auth state loading error:", err);
        }
      } else {
        // First check if we have a saved active login/invite session in localStorage
        let savedFamilyCode = localStorage.getItem("familyCode");
        let savedInviteCode = localStorage.getItem("inviteCode");
        let savedMemberId = localStorage.getItem("memberId");

        const familyLoginStr = localStorage.getItem("familyLogin");
        if (familyLoginStr) {
          try {
            const familyLogin = JSON.parse(familyLoginStr);
            if (familyLogin && familyLogin.familyId && familyLogin.loginCode) {
              if (!savedFamilyCode) savedFamilyCode = familyLogin.familyId;
              if (!savedInviteCode) savedInviteCode = familyLogin.loginCode;
            }
          } catch (e) {
            console.warn("familyLogin parse error:", e);
          }
        }

        if (savedFamilyCode && savedInviteCode) {
          try {
            const inviteRef = doc(db, "families", savedFamilyCode, "invites", savedInviteCode);
            const inviteSnap = await getDoc(inviteRef);
            let inviteData: any = null;
            let isFound = false;

            if (inviteSnap.exists()) {
              inviteData = inviteSnap.data();
              isFound = true;
            } else {
              const q = query(
                collection(db, "families", savedFamilyCode, "invites"),
                where("inviteCode", "==", savedInviteCode)
              );
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                inviteData = qSnap.docs[0].data();
                isFound = true;
              }
            }

            const canLogin = isFound && (
              inviteData.status === "accepted" ||
              inviteData.status === "joined" ||
              !!inviteData.joinedUserId ||
              !!inviteData.acceptedBy
            );

            if (canLogin) {
              const targetUid = savedMemberId || inviteData.joinedUserId || inviteData.acceptedBy || inviteData.memberId;
              if (targetUid) {
                let uSnap = await getDoc(doc(db, "users", targetUid));
                if (!uSnap.exists()) {
                  console.log("Startup Reconstructing user doc for targetUid:", targetUid);
                  const reconstructedProfile: UserProfile = removeUndefinedFields({
                    uid: targetUid,
                    email: inviteData.email || "",
                    displayName: inviteData.name || inviteData.displayName || "家庭成員",
                    photoURL: inviteData.avatar || "🙂",
                    color: "#B4C3B2",
                    familyId: savedFamilyCode,
                    role: (inviteData.role || inviteData.targetRole || "Child") as UserRole,
                    stars: 0,
                    birthday: inviteData.birthday || null,
                    showAgeInCalendar: inviteData.showAgeInCalendar ?? inviteData.showAge ?? true,
                    gender: inviteData.gender ?? "",
                    createdAt: serverTimestamp(),
                    inviteStatus: "active",
                  });
                  await setDoc(doc(db, "users", targetUid), reconstructedProfile);
                  uSnap = await getDoc(doc(db, "users", targetUid));
                }

                if (uSnap.exists()) {
                  const freshProfile = uSnap.data() as UserProfile;
                  if (freshProfile.familyId) {
                    try {
                      const nestedSnap = await getDoc(
                        doc(db, "families", freshProfile.familyId, "members", targetUid)
                      );
                      if (nestedSnap.exists() && nestedSnap.data()?.role) {
                        freshProfile.role = normalizeDbRole(nestedSnap.data()?.role);
                      }
                    } catch (nestedErr) {
                      console.warn("Failed to retrieve nested role during guest session restore:", nestedErr);
                    }
                  }
                  localStorage.setItem("local_guest_profile", JSON.stringify(freshProfile));
                  localStorage.setItem("memberId", targetUid);

                  // Keep familyLogin in sync
                  localStorage.setItem(
                    "familyLogin",
                    JSON.stringify({
                      familyId: savedFamilyCode,
                      loginCode: savedInviteCode,
                      memberName: freshProfile.displayName,
                      role: freshProfile.role,
                      guestUid: targetUid
                    })
                  );

                  const mockUser = {
                    uid: freshProfile.uid,
                    email: freshProfile.email || "",
                    displayName: freshProfile.displayName,
                    isAnonymous: true,
                    photoURL: freshProfile.photoURL || "✿"
                  } as any;

                  setUser(mockUser);
                  setCurrentUserProfile(freshProfile);
                  if (freshProfile.familyId) {
                    setActivePage("home");
                    setOnboardingChoice("none");
                    setIsLoadingAuth(false);
                    return;
                  }
                }
              }
            }
          } catch (autoErr) {
            console.warn("Auto verification check error on start:", autoErr);
          }
        }

        // Check if we have a locally stored guest profile session
        const localGuestProfStr = localStorage.getItem("local_guest_profile");
        if (localGuestProfStr) {
          try {
            const localProfile = JSON.parse(localGuestProfStr) as UserProfile;
            let freshProfile = localProfile;
            try {
              const uSnap = await getDoc(doc(db, "users", localProfile.uid));
              if (uSnap.exists()) {
                freshProfile = uSnap.data() as UserProfile;
                if (freshProfile.familyId) {
                  try {
                    const nestedSnap = await getDoc(
                      doc(db, "families", freshProfile.familyId, "members", localProfile.uid)
                    );
                    if (nestedSnap.exists() && nestedSnap.data()?.role) {
                      freshProfile.role = normalizeDbRole(nestedSnap.data()?.role);
                    }
                  } catch (nestedErr) {
                    console.warn("Failed to retrieve nested role from guest local session:", nestedErr);
                  }
                }
                localStorage.setItem("local_guest_profile", JSON.stringify(freshProfile));
              }
            } catch (fsErr) {
              console.warn("Could not fetch fresh guest profile from firestore:", fsErr);
            }

            const mockUser = {
              uid: freshProfile.uid,
              email: freshProfile.email || "",
              displayName: freshProfile.displayName,
              isAnonymous: true,
              photoURL: freshProfile.photoURL || "✿"
            } as any;

            setUser(mockUser);
            setCurrentUserProfile(freshProfile);
            if (freshProfile.familyId) {
              setActivePage("home");
              setOnboardingChoice("none");
            }
          } catch (jsonErr) {
            console.error("Failed to parse local guest profile:", jsonErr);
            setUser(null);
            setCurrentUserProfile(null);
            setActiveFamily(null);
            setActiveSetting(null);
            setFamilyMembers([]);
            setEvents([]);
            setTasks([]);
            setRewards([]);
            setAnnouncements([]);
            setFamilyNotes([]);
            setFavoriteActivities([]);
            setRedemptions([]);
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
          setFamilyNotes([]);
          setFavoriteActivities([]);
          setRedemptions([]);
        }
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
    if (!user || !effectiveUserProfile?.familyId) return;
    const famId = effectiveUserProfile.familyId;
    
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
  }, [user?.uid, effectiveUserProfile?.familyId]);

  // Comprehensive Real-time database sync listener for all tables
  useEffect(() => {
    if (!user || !effectiveUserProfile?.familyId) return;
    const famId = effectiveUserProfile.familyId;
    
    // 11 separate snapshots (including family, settings, and join requests)
    setListenerCount(11);

    // Warm-up states instantly from offline localStorage cache for sub-second system load
    const cacheKey = (tbl: string) => `cache_${tbl}_${famId}`;
    
    const cachedFamily = getCachedData(cacheKey("family"));
    if (cachedFamily) {
      setActiveFamily(cachedFamily);
      setDataLoaded((prev) => ({ ...prev, family: true }));
    }
    const cachedSettings = getCachedData(cacheKey("settings"));
    if (cachedSettings) {
      setActiveSetting(cachedSettings);
      setDataLoaded((prev) => ({ ...prev, settings: true }));
    }
    const cachedMembers = getCachedData(cacheKey("members"));
    if (cachedMembers) {
      setFamilyMembers(cachedMembers);
      setDataLoaded((prev) => ({ ...prev, members: true }));
    }
    const cachedAnn = getCachedData(cacheKey("announcements"));
    if (cachedAnn) {
      setAnnouncements(cachedAnn);
      setDataLoaded((prev) => ({ ...prev, announcements: true }));
    }
    const cachedNotes = getCachedData(cacheKey("notes"));
    if (cachedNotes) {
      setFamilyNotes(cachedNotes);
    }
    const cachedTasks = getCachedData(cacheKey("tasks"));
    if (cachedTasks) {
      setTasks(cachedTasks);
      setDataLoaded((prev) => ({ ...prev, tasks: true }));
    }
    const cachedEvents = getCachedData(cacheKey("events"));
    if (cachedEvents) {
      const filteredCached = (cachedEvents as CalendarEvent[]).filter(evt => {
        const isPrivate = 
          evt.isPublic === false || 
          String(evt.isPublic) === "false" ||
          (evt as any).isPrivate === true || 
          (evt as any).isPrivate === "true" ||
          (evt as any).visibility === "private";

        if (!isPrivate) return true;

        const activeUid = effectiveUserProfile?.uid || user?.uid;
        const role = effectiveUserProfile?.role;
        const isOwner = 
          role === UserRole.OWNER || 
          role === UserRole.SUPER_ADMIN || 
          String(role).toLowerCase() === "owner" || 
          String(role).toLowerCase() === "admin" || 
          String(role).toLowerCase() === "superadmin";

        const isCreator = 
          (activeUid && evt.creatorUid && evt.creatorUid === activeUid) || 
          (activeUid && (evt as any).createdByUid && (evt as any).createdByUid === activeUid);

        return isCreator || isOwner;
      });
      setEvents(filteredCached);
      setDataLoaded((prev) => ({ ...prev, events: true }));
    }
    const cachedRewards = getCachedData(cacheKey("rewards"));
    if (cachedRewards) {
      setRewards(cachedRewards);
      setDataLoaded((prev) => ({ ...prev, rewards: true }));
    }
    const cachedFavs = getCachedData(cacheKey("favorites"));
    if (cachedFavs) {
      setFavoriteActivities(cachedFavs);
      setDataLoaded((prev) => ({ ...prev, favorites: true }));
    }
    const cachedReds = getCachedData(cacheKey("redemptions"));
    if (cachedReds) {
      setRedemptions(cachedReds);
      setDataLoaded((prev) => ({ ...prev, redemptions: true }));
    }
    const cachedStarTx = getCachedData(cacheKey("startx"));
    if (cachedStarTx) {
      setStarTransactions(cachedStarTx);
      setDataLoaded((prev) => ({ ...prev, starTransactions: true }));
    }

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
        setCachedData(cacheKey("announcements"), list);
        setDataLoaded((prev) => ({ ...prev, announcements: true }));
        logFirestoreOp("list", "announcements", "success", `載入 ${list.length} 筆公告`);
      },
      (err) => {
        logFirestoreOp("list", "announcements", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "announcements");
      }
    );

    // 1b. Family Notes
    const unsubNotes = onSnapshot(
      query(collection(db, "family_notes"), where("familyId", "==", famId)),
      (snapshot) => {
        incrementQueries(1);
        const list: FamilyNote[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as FamilyNote);
        });
        setFamilyNotes(list);
        setCachedData(cacheKey("notes"), list);
        logFirestoreOp("list", "family_notes", "success", `載入 ${list.length} 筆家庭記事`);
      },
      (err) => {
        logFirestoreOp("list", "family_notes", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "family_notes");
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
        setCachedData(cacheKey("tasks"), list);
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
          const evt = snap.data() as CalendarEvent;
          const isPrivate = 
            evt.isPublic === false || 
            String(evt.isPublic) === "false" ||
            (evt as any).isPrivate === true || 
            (evt as any).isPrivate === "true" ||
            (evt as any).visibility === "private";

          if (!isPrivate) {
            list.push(evt);
          } else {
            const activeUid = effectiveUserProfile?.uid || user?.uid;
            const role = effectiveUserProfile?.role;
            const isOwner = 
              role === UserRole.OWNER || 
              role === UserRole.SUPER_ADMIN || 
              String(role).toLowerCase() === "owner" || 
              String(role).toLowerCase() === "admin" || 
              String(role).toLowerCase() === "superadmin";

            const isCreator = 
              (activeUid && evt.creatorUid && evt.creatorUid === activeUid) || 
              (activeUid && (evt as any).createdByUid && (evt as any).createdByUid === activeUid);

            if (isCreator || isOwner) {
              list.push(evt);
            }
          }
        });
        setEvents(list);
        setCachedData(cacheKey("events"), list);
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
        setCachedData(cacheKey("rewards"), list);
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
        setCachedData(cacheKey("favorites"), list);
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
        setCachedData(cacheKey("redemptions"), list);
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
        setCachedData(cacheKey("startx"), list);
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
        setCachedData(cacheKey("members"), list);
        setCachedData(CACHE_KEY_MEMBERS(famId), list);
        const myFreshProfile = list.find((m) => m.uid === user.uid);
        if (myFreshProfile) {
          setCurrentUserProfile((prev) => {
            if (prev) {
              return { ...myFreshProfile, role: prev.role };
            }
            return myFreshProfile;
          });
        }
        setDataLoaded((prev) => ({ ...prev, members: true }));
        logFirestoreOp("list", "users", "success", `載入 ${list.length} 名家庭成員狀態`);
      },
      (err) => {
        logFirestoreOp("list", "users", "error", err.message);
        handleFirestoreError(err, OperationType.LIST, "users");
      }
    );

    // 12. Nested Family Members (Primary Source of truth for Roles)
    const unsubNestedMembers = onSnapshot(
      collection(db, "families", famId, "members"),
      (snapshot) => {
        incrementQueries(1);
        const nestedMembersMap = new Map<string, any>();
        snapshot.forEach((snap) => {
          nestedMembersMap.set(snap.id, snap.data());
        });

        setFamilyMembers((prevMembers) => {
          const updated = prevMembers.map((m) => {
            const nested = nestedMembersMap.get(m.uid);
            if (nested && nested.role) {
              return { ...m, role: normalizeDbRole(nested.role) };
            }
            return m;
          });
          setCachedData(cacheKey("members"), updated);
          setCachedData(CACHE_KEY_MEMBERS(famId), updated);
          return updated;
        });

        const myNested = nestedMembersMap.get(user.uid);
        if (myNested && myNested.role) {
          const normalizedRole = normalizeDbRole(myNested.role);
          setCurrentUserProfile((prev) => {
            if (prev && prev.role !== normalizedRole) {
              return { ...prev, role: normalizedRole };
            }
            return prev;
          });
        }
      },
      (err) => {
        console.error("Failed to sync nested members:", err);
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
          setCachedData(cacheKey("settings"), sData);
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

    // 10. Join Requests
    const unsubJoinRequests = onSnapshot(
      query(collection(db, "join_requests"), where("familyId", "==", famId), where("status", "==", "pending")),
      (snapshot) => {
        incrementQueries(1);
        const list: any[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data());
        });
        setPendingRequests(list);
        logFirestoreOp("list", "join_requests", "success", `載入 ${list.length} 筆加入申請`);
      },
      (err) => {
        console.error("Failed to load join requests:", err);
      }
    );

    // 11. Family Info (Real-time sync to avoid getDoc on tab switches)
    const unsubFamily = onSnapshot(
      doc(db, "families", famId),
      (snap) => {
        incrementQueries(1);
        if (snap.exists()) {
          const fData = snap.data() as Family;
          setActiveFamily(fData);
          setCachedData(cacheKey("family"), fData);
        }
        setDataLoaded((prev) => ({ ...prev, family: true }));
        logFirestoreOp("get", `families/${famId}`, "success", "同步家庭基本資料");
      },
      (err) => {
        console.error("Failed to load family snapshot:", err);
      }
    );

    return () => {
      unsubAnn();
      unsubNotes();
      unsubTasks();
      unsubEvents();
      unsubRewards();
      unsubFavorites();
      unsubRedemptions();
      unsubStarTxGroup();
      unsubUsersGroup();
      unsubNestedMembers();
      unsubSettingsGroup();
      unsubJoinRequests();
      unsubFamily();
      setListenerCount(0);
    };
  }, [user?.uid, effectiveUserProfile?.familyId, effectiveUserProfile?.role]);

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
        toast.error("登入失敗\n請重新嘗試 Google 登入。\n若持續失敗請聯絡管理員。");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBindGoogle = async (memberUid: string) => {
    try {
      const provider = new GoogleAuthProvider();
      toast("請在彈出的視窗中完成 Google 登入以綁定此成員...", { duration: 4000 });
      
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      if (!googleUser) {
        toast.error("無法取得 Google 使用者資訊，繫結失敗");
        return;
      }
      
      const googleUid = googleUser.uid;
      const googleEmail = googleUser.email || "";
      
      // Update existing users in Firestore
      const userDocRef = doc(db, "users", memberUid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await updateDoc(userDocRef, {
          googleUid: googleUid,
          email: googleEmail,
        });
      }
      
      // Update families/{familyId}/members in Firestore
      if (currentUserProfile?.familyId) {
        const nestedMemberRef = doc(db, "families", currentUserProfile.familyId, "members", memberUid);
        const nestedSnap = await getDoc(nestedMemberRef);
        if (nestedSnap.exists()) {
          await updateDoc(nestedMemberRef, {
            googleUid: googleUid,
            email: googleEmail,
          });
        }
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
      }
      
      toast.success("🎉 已成功將 Google 帳號與此成員綁定完成！");
    } catch (err: any) {
      console.error("Bind Google account error:", err);
      toast.error("綁定 Google 失敗：" + err.message);
    }
  };

  const handleCodeLogin = async (familyCodeParam: string, inviteCodeParam: string) => {
    const cleanedFamilyId = familyCodeParam.trim();
    const cleanedInviteCode = inviteCodeParam.trim().toUpperCase();

    if (!cleanedFamilyId || !cleanedInviteCode) {
      setSearchInviteError("請同時輸入家庭代碼與邀請/登入代碼。");
      return;
    }

    setIsSearchingInvite(true);
    setSearchInviteError(null);

    try {
      // 1. Check family document existence first
      const familyRef = doc(db, "families", cleanedFamilyId);
      const familySnap = await getDoc(familyRef);

      if (!familySnap.exists()) {
        setSearchInviteError("找不到此家庭資料，請確認家庭代碼是否正確。");
        return;
      }

      // 2. Read from families/{familyId}/invites/{inviteCode}
      const inviteRef = doc(db, "families", cleanedFamilyId, "invites", cleanedInviteCode);
      let inviteSnap = await getDoc(inviteRef);

      let isFound = false;
      let inviteData: any = null;

      if (inviteSnap.exists()) {
        inviteData = inviteSnap.data();
        isFound = true;
      } else {
        // Fallback check field inviteCode
        const q = query(
          collection(db, "families", cleanedFamilyId, "invites"),
          where("inviteCode", "==", cleanedInviteCode)
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          inviteSnap = qSnap.docs[0];
          inviteData = inviteSnap.data();
          isFound = true;
        }
      }

      const canLogin = isFound && (
        inviteData.status === "accepted" ||
        inviteData.status === "joined" ||
        !!inviteData.joinedUserId ||
        !!inviteData.acceptedBy
      );

      if (!canLogin) {
        if (inviteData.status === "pending") {
          setSearchInviteError("此邀請尚未加入家庭，請點選首次加入。");
        } else {
          setSearchInviteError("此邀請/登入狀態非有效登入狀態。");
        }
        return;
      }

      const targetUid = inviteData.joinedUserId || inviteData.acceptedBy || inviteData.memberId;
      if (!targetUid) {
        setSearchInviteError("此代碼尚未綁定有效的成員帳戶。");
        return;
      }

      // Fetch user profile from root users collection
      const userDocRef = doc(db, "users", targetUid);
      let userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        console.log("Reconstructing user doc for targetUid:", targetUid);
        // Automatically reconstruct users document
        const reconstructedProfile: UserProfile = removeUndefinedFields({
          uid: targetUid,
          email: inviteData.email || "",
          displayName: inviteData.name || inviteData.displayName || "家庭成員",
          photoURL: inviteData.avatar || "🙂",
          color: "#B4C3B2",
          familyId: cleanedFamilyId,
          role: (inviteData.role || inviteData.targetRole || "Child") as UserRole,
          stars: 0,
          birthday: inviteData.birthday || null,
          showAgeInCalendar: inviteData.showAgeInCalendar ?? inviteData.showAge ?? true,
          gender: inviteData.gender ?? "",
          createdAt: serverTimestamp(),
          inviteStatus: "active",
        });
        await setDoc(userDocRef, reconstructedProfile);
        userSnap = await getDoc(userDocRef);
      }

      if (!userSnap.exists()) {
        setSearchInviteError("找不到對應的成員帳戶 profile。");
        return;
      }

      const profileData = userSnap.data() as UserProfile;

      // 成功加入/登入家庭後寫入 familyLogin 登入憑證
      localStorage.setItem(
        "familyLogin",
        JSON.stringify({
          familyId: cleanedFamilyId,
          loginCode: cleanedInviteCode,
          memberName: profileData.displayName,
          role: profileData.role,
          guestUid: targetUid
        })
      );

      // 3. Save to localStorage
      localStorage.setItem("familyCode", cleanedFamilyId);
      localStorage.setItem("inviteCode", cleanedInviteCode);
      localStorage.setItem("memberId", targetUid);
      localStorage.setItem("local_guest_profile", JSON.stringify(profileData));

      const mockUser = {
        uid: targetUid,
        email: profileData.email || "",
        displayName: profileData.displayName,
        isAnonymous: true,
        photoURL: profileData.photoURL || "✿"
      } as any;

      setUser(mockUser);
      setCurrentUserProfile(profileData);
      
      setActivePage("home");
      setOnboardingChoice("none");
      
      toast.success(`🎉 歡迎回來，${profileData.displayName}！`);
    } catch (err: any) {
      console.error("Code login error:", err);
      setSearchInviteError("登入驗證時出錯：" + err.message);
    } finally {
      setIsSearchingInvite(false);
    }
  };

  const handleQueryInvite = async (familyIdParam: string, inviteCodeParam: string) => {
    const cleanedFamilyId = familyIdParam.trim();
    const cleanedInviteCode = inviteCodeParam.trim().toUpperCase();

    if (!cleanedFamilyId || !cleanedInviteCode) {
      setFoundInvite(null);
      setSearchInviteError("請同時輸入家庭代碼與邀請碼。");
      return;
    }

    setIsSearchingInvite(true);
    setSearchInviteError(null);
    setFoundInvite(null);

    try {
      console.log("query invites under:", cleanedFamilyId, "code:", cleanedInviteCode);

      // Check family document existence first
      const familyRef = doc(db, "families", cleanedFamilyId);
      const familySnap = await getDoc(familyRef);

      if (!familySnap.exists()) {
        setSearchInviteError("找不到此家庭資料，請確認家庭代碼是否正確。");
        setFoundInvite(null);
        return;
      }

      const familyData = familySnap.data();

      // Read from families/{familyId}/invites/{inviteCode}
      const inviteRef = doc(db, "families", cleanedFamilyId, "invites", cleanedInviteCode);

      const queryPath = `families/${cleanedFamilyId}/invites/${cleanedInviteCode}`;
      console.log(
        "Query Path",
        queryPath
      );

      console.log(
        "Family Code",
        cleanedFamilyId
      );

      console.log(
        "Invite Code",
        cleanedInviteCode
      );

      let inviteSnap = await getDoc(inviteRef);

      console.log(
        "Document Exists",
        inviteSnap.exists()
      );

      let isFound = false;
      let inviteData: any = null;
      let finalInviteId = "";

      if (inviteSnap.exists()) {
        inviteData = inviteSnap.data();
        finalInviteId = inviteSnap.id;
        isFound = true;
        console.log(
          "Invite Data",
          inviteData
        );
      } else {
        // Step 3: if not found, check if it's stored as field where inviteCode == cleanedInviteCode
        console.log("Not found as doc ID, trying query on 'inviteCode' field...");
        const q = query(
          collection(db, "families", cleanedFamilyId, "invites"),
          where("inviteCode", "==", cleanedInviteCode)
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          inviteSnap = qSnap.docs[0];
          inviteData = inviteSnap.data();
          finalInviteId = inviteSnap.id;
          isFound = true;
          console.log(
            "Document Exists",
            true
          );
          console.log(
            "Invite Data",
            inviteData
          );
        }
      }

      if (!isFound) {
        setFoundInvite(null);
        setSearchInviteError("找不到邀請資料，請確認驗證資訊是否正確。");

        // Fourth Step: print out all documents under families/{familyId}/invites
        try {
          const snapshot = await getDocs(
            collection(
              db,
              "families",
              cleanedFamilyId,
              "invites"
            )
          );

          console.log(
            "All Invites",
            snapshot.docs.map(d => ({
              id: d.id,
              ...d.data()
            }))
          );
        } catch (subErr: any) {
          console.error("Failed to query subcollection documents:", subErr);
        }
      } else {
        console.log("invite result", inviteData);

        if (inviteData.status === "joined") {
          setFoundInvite(null);
          setSearchInviteError("此邀請已成功加入家庭！請直接在下方點選「登入系統」進行登入。");
        } else if (inviteData.status === "pending") {
          // Found it! Include familyName from family document if not present in inviteData
          setFoundInvite({
            id: finalInviteId,
            ...inviteData,
            inviteCode: cleanedInviteCode, // Ensure we preserve the code
            familyName: familyData.name || inviteData.familyName || "我的家庭"
          });
        } else {
          setFoundInvite(null);
          setSearchInviteError(`此邀請狀態為「${inviteData.status || "空值"}」，已無法進行首次加入流程。`);
        }
      }
    } catch (err: any) {
      console.error("invite query failed", err);
      const isPermissionDenied = 
        err?.code === "permission-denied" || 
        err?.name === "PermissionDeniedError" ||
        String(err).includes("permission-denied") ||
        String(err).includes("Permission denied") ||
        (err?.message && (err.message.includes("permission-denied") || err.message.includes("Permission denied")));

      console.log("Is Blocked by Firestore Rules:", isPermissionDenied);

      if (isPermissionDenied) {
        setSearchInviteError("權限不足");
      } else {
        setSearchInviteError("驗證失敗：請檢查代碼或與管理員確認網路。");
      }
    } finally {
      setIsSearchingInvite(false);
    }
  };

  const confirmJoinFamily = async (inviteParam?: any, specialUid?: string, specialEmail?: string) => {
    const invite = inviteParam || foundInvite;
    if (!invite || isOnboardingBusy) return;
    setIsOnboardingBusy(true);

    const familyId = invite.familyId;
    const inviteCode = invite.inviteCode;
    const inviteData = invite;

    try {
      console.log("開始加入家庭");
      console.log("familyId", familyId);
      console.log("inviteCode", inviteCode);
      console.log("inviteData", inviteData);

      let targetUid = specialUid || "";
      let targetEmail = specialEmail || "";

      if (!targetUid) {
        if (user) {
          // Already logged in with Google (Onboarding mode)
          if (invite.email && invite.email.toLowerCase() !== user.email?.toLowerCase()) {
            toast.error(`⚠️ 此邀請碼限制指定 Google 帳號 (${invite.email}) 使用！目前您登入的帳戶為 (${user.email})！`);
            setIsOnboardingBusy(false);
            return;
          }
          targetUid = user.uid;
          targetEmail = user.email || "";
        } else if (invite.email) {
          // Requires specific Google login accounts
          const provider = new GoogleAuthProvider();
          const res = await signInWithPopup(auth, provider);
          const firebaseUser = res.user;

          if (firebaseUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
            toast.error(`⚠️ 此邀請碼限制指定 Google 帳號 (${invite.email}) 使用！目前您登入的帳戶為 (${firebaseUser.email})！`);
            await signOut(auth);
            setIsOnboardingBusy(false);
            return;
          }
          targetUid = firebaseUser.uid;
          targetEmail = firebaseUser.email || "";
        } else {
          // Guest mode
          targetUid = `guest_${invite.inviteCode}_${Math.random().toString(36).substr(2, 9)}`;
        }
      }

      if (invite.email && invite.email.toLowerCase() !== targetEmail.toLowerCase()) {
        toast.error(`⚠️ 此邀請碼限制指定 Google 帳號 (${invite.email}) 使用！目前您登入的帳戶為 (${targetEmail})！`);
        setIsOnboardingBusy(false);
        return;
      }

      const targetFamilyId = familyId;
      const targetFamilyName = invite.familyName || "我的家庭";
      const targetRole = invite.role || invite.targetRole || UserRole.VIEWER;
      const targetName = invite.name || invite.memberName || "新成員";
      const isLocalGuest = !user && !specialUid;

      // 4th, 5th, and 6th Steps: Enforce uniqueness within family for inviteCode, joinedUserId, and memberId
      const membersRef = collection(db, "families", targetFamilyId, "members");
      const membersSnap = await getDocs(membersRef);

      let duplicateMemberUid = "";
      let hasCheckedDuplicate = false;

      // 1. Check if invitation block matches
      const codeIsUsed = (invite.status === "joined" || invite.status === "accepted" || !!invite.joinedUserId || !!invite.acceptedBy);
      if (codeIsUsed) {
        duplicateMemberUid = invite.joinedUserId || invite.acceptedBy || invite.memberId;
        hasCheckedDuplicate = true;
      }

      // 2. Check nested family members collection
      membersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const docId = docSnap.id;
        const mUid = d.uid || d.userId || docId;
        const mInviteCode = d.inviteCode || d.loginCode || d.loginCode || d.inviteCode;

        const isMatchedUid = (mUid && mUid === targetUid) || (d.joinedUserId && d.joinedUserId === targetUid);
        const isMatchedInviteCode = (mInviteCode && mInviteCode.toUpperCase() === inviteCode.toUpperCase()) || (invite.inviteCode && mInviteCode && mInviteCode.toUpperCase() === invite.inviteCode.toUpperCase());
        const isMatchedMemberId = (invite.memberId && (docId === invite.memberId || d.memberId === invite.memberId));

        if (isMatchedUid || isMatchedInviteCode || isMatchedMemberId) {
          if (!duplicateMemberUid) {
            duplicateMemberUid = mUid || docId;
          }
          hasCheckedDuplicate = true;
        }
      });

      // 3. Check root users collection for the same unique items
      if (!hasCheckedDuplicate) {
        const rootUsersQuery = query(collection(db, "users"), where("familyId", "==", targetFamilyId));
        const rootUsersSnap = await getDocs(rootUsersQuery);
        rootUsersSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const docId = docSnap.id;
          const isMatchedUid = (docId === targetUid) || (d.uid === targetUid);
          const isMatchedInviteCode = (d.inviteCode && d.inviteCode.toUpperCase() === inviteCode.toUpperCase());
          const isMatchedMemberId = (invite.memberId && (docId === invite.memberId || d.memberId === invite.memberId));

          if (isMatchedUid || isMatchedInviteCode || isMatchedMemberId) {
            duplicateMemberUid = docId || d.uid;
            hasCheckedDuplicate = true;
          }
        });
      }

      // If duplicate found, directly login existing member data, do not create a new member or write to subcollection again (Step 4, 5, 6)
      if (hasCheckedDuplicate) {
        console.log("Anti-duplicate trigger: Direct logging in existing member uid:", duplicateMemberUid);
        const resolvedUid = duplicateMemberUid || targetUid || invite.memberId;

        // Fetch existing user doc
        const userDocRef = doc(db, "users", resolvedUid);
        let userSnap = await getDoc(userDocRef);
        let profileData: any = null;

        if (userSnap.exists()) {
          profileData = userSnap.data();
        } else {
          // Reconstruct user doc for direct login if missing
          console.log("Reconstructing user doc in anti-duplicate flow for uid:", resolvedUid);
          profileData = removeUndefinedFields({
            uid: resolvedUid,
            email: targetEmail || invite.email || "",
            displayName: targetName || invite.name || "家庭成員",
            photoURL: invite.avatar || "🙂",
            color: "#B4C3B2",
            familyId: targetFamilyId,
            role: targetRole as UserRole,
            stars: 0,
            birthday: invite.birthday || null,
            showAgeInCalendar: invite.showAge ?? true,
            gender: invite.gender ?? "",
            createdAt: serverTimestamp(),
            inviteStatus: "active",
          });
          await setDoc(userDocRef, profileData);
        }

        // Save persistent login states
        localStorage.setItem("familyCode", targetFamilyId);
        localStorage.setItem("inviteCode", inviteCode);
        localStorage.setItem("memberId", resolvedUid);
        localStorage.setItem(
          "familyLogin",
          JSON.stringify({
            familyId: targetFamilyId,
            loginCode: inviteCode,
            memberName: profileData.displayName,
            role: profileData.role,
            guestUid: resolvedUid
          })
        );
        localStorage.setItem("local_guest_profile", JSON.stringify(profileData));

        const mockUser = {
          uid: resolvedUid,
          email: profileData.email || "",
          displayName: profileData.displayName,
          isAnonymous: true,
          photoURL: profileData.photoURL || "✿"
        } as any;

        setUser(mockUser);
        setCurrentUserProfile(profileData);
        setActivePage("home");
        setOnboardingChoice("none");
        setFoundInvite(null);

        toast.success(`🎉 歡迎！您已登入家庭「${targetFamilyName}」為正式一員！`);
        setIsOnboardingBusy(false);
        return;
      }

      // 1. 驗證邀請存在且狀態為 pending
      if (invite.status && invite.status !== "pending") {
        toast.error("⚠️ 此邀請碼目前已被使用或無效！");
        setIsOnboardingBusy(false);
        return;
      }

      // Check if user already has a pending request with identical name / role before joining
      let alreadyExists = false;
      membersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.name === targetName && normalizeDbRole(d.role) === normalizeDbRole(targetRole)) {
          alreadyExists = true;
        }
      });

      if (alreadyExists) {
        toast.error("⚠️ 此成員已加入家庭！");
        setIsOnboardingBusy(false);
        return;
      }

      // Verify and delete placeholder user if needed
      let placeholderData: any = {};
      if (invite.memberId) {
        const mSnap = await getDoc(doc(db, "users", invite.memberId));
        if (mSnap.exists()) {
          placeholderData = mSnap.data();
          await deleteDoc(doc(db, "users", invite.memberId));
        }
        const oldMemberLinkId = `${targetFamilyId}_${invite.memberId}`;
        await deleteDoc(doc(db, "family_members", oldMemberLinkId));
      }

      const finalDisplayName = targetName;
      const finalRole = targetRole;
      const finalColor = invite.color || placeholderData.color || "#B4C3B2";
      const finalPhotoURL = invite.avatar || placeholderData.photoURL || "✿";
      const finalBirthday = invite.birthday || placeholderData.birthday || null;
      const finalGender = invite.gender || placeholderData.gender || "";
      const finalShowAge = invite.showAge ?? true;
      const mergedStars = placeholderData.stars || 0;

      const memberId = targetUid;
      const memberData = removeUndefinedFields({
        name: inviteData.name || "",
        displayName: inviteData.name || "",
        role: inviteData.role || inviteData.targetRole || "Child",
        birthday: inviteData.birthday ?? null,
        gender: inviteData.gender ?? "",
        avatar: inviteData.avatar ?? "🙂",
        photoURL: inviteData.avatar ?? "🙂",
        email: inviteData.email ?? "",
        showAge: inviteData.showAge ?? true,
        showAgeInCalendar: inviteData.showAgeInCalendar ?? inviteData.showAge ?? true,
        familyId: familyId,
        loginCode: inviteCode,
        createdAt: serverTimestamp(),
        joinedAt: serverTimestamp()
      });

      console.log("memberData", memberData);

      // Create/Update root user profile
      const updatedProfile: UserProfile = removeUndefinedFields({
        uid: targetUid,
        email: targetEmail,
        displayName: finalDisplayName,
        photoURL: finalPhotoURL,
        color: finalColor,
        familyId: targetFamilyId,
        role: finalRole as UserRole,
        stars: mergedStars,
        birthday: finalBirthday || null,
        showAgeInCalendar: finalShowAge,
        gender: finalGender,
        createdAt: serverTimestamp(),
        inviteCode: invite.inviteCode,
        inviteStatus: "active",
      });
      await setDoc(doc(db, "users", targetUid), updatedProfile);
      console.log("Login Credential Saved");

      // Create the nested families/{familyId}/members/{userId} document
      console.log("即將建立路徑：");
      console.log(`families/${familyId}/members/${memberId}`);
      const memberDocRef = doc(db, "families", targetFamilyId, "members", targetUid);
      
      await setDoc(memberDocRef, memberData);
      console.log("Member Created");

      // Auto Birthday Event
      if (memberData.birthday) {
        await createBirthdayEvent(targetUid, memberData.birthday, targetFamilyId, memberData.name);
      }

      // Create family_members link (legacy root sync)
      const memberLinkId = `${targetFamilyId}_${targetUid}`;
      await setDoc(doc(db, "family_members", memberLinkId), removeUndefinedFields({
        id: memberLinkId,
        familyId: targetFamilyId,
        userId: targetUid,
        displayName: finalDisplayName,
        role: finalRole as UserRole,
        stars: mergedStars,
        createdAt: serverTimestamp(),
      }));

      // Mark invite as accepted in nest subcollection
      const nestInviteRef = doc(db, "families", targetFamilyId, "invites", invite.inviteCode);
      await updateDoc(nestInviteRef, removeUndefinedFields({
        status: "joined",
        acceptedBy: targetUid,
        acceptedAt: new Date().toISOString(),
        joinedUserId: targetUid,
        joinedEmail: targetEmail,
        joinedTime: new Date().toISOString(),
      }));

      // Mark invite as accepted in root invites collection
      if (invite.id) {
        try {
          await updateDoc(doc(db, "invites", invite.id), removeUndefinedFields({
            status: "joined",
            acceptedBy: targetUid,
            acceptedAt: new Date().toISOString(),
            joinedUserId: targetUid,
            joinedEmail: targetEmail,
            joinedTime: new Date().toISOString(),
          }));
        } catch (ignored) {}
      }
      console.log("Invite Updated");

      // Record local storage information for persistent login
      localStorage.setItem("familyCode", targetFamilyId);
      localStorage.setItem("inviteCode", invite.inviteCode);
      localStorage.setItem("memberId", targetUid);

      // 成功加入家庭後，寫入 familyLogin 登入憑證
      localStorage.setItem(
        "familyLogin",
        JSON.stringify({
          familyId: targetFamilyId,
          loginCode: invite.inviteCode,
          memberName: inviteData.name,
          role: inviteData.role
        })
      );

      // Record Audit Log
      const auditId = `aud_${Date.now()}_join`;
      await setDoc(doc(db, "audit_logs", auditId), removeUndefinedFields({
        id: auditId,
        userId: targetUid,
        userName: `${finalDisplayName} (${getRoleLabel(finalRole)})`,
        familyId: targetFamilyId,
        action: `進入「${targetFamilyName}」：使用專屬邀請碼「${invite.inviteCode}」自動啟用 ${getRoleLabel(finalRole)} 權限並同步生命週期生日設定`,
        targetId: targetFamilyId,
        targetName: targetFamilyName,
        createdAt: new Date().toISOString(),
      }));

      if (isLocalGuest) {
        localStorage.setItem("local_guest_profile", JSON.stringify(updatedProfile));
        const mockUser = {
          uid: targetUid,
          email: targetEmail,
          displayName: finalDisplayName,
          isAnonymous: true,
          photoURL: finalPhotoURL
        } as any;
        setUser(mockUser);
      }

      setCurrentUserProfile(updatedProfile);
      setFoundInvite(null);
      setGoogleMatchInvite(null);
      setJoinFamilyId("");
      setJoinInviteCode("");
      setActivePage("home");
      setOnboardingChoice("none");

      console.log("Join Success");
      toast.success(`🎉 歡迎！您已成功進駐家庭「${targetFamilyName}」，系統已為您配置「${getRoleLabel(finalRole)}」角色權限！`);
    } catch (error: any) {
      console.error("Join Family Error");
      console.error(error);
      if (error) {
        console.error(error.code);
        console.error(error.message);
      }
      toast.error("❌ 接受邀請失敗：" + error.message);
    } finally {
      setIsOnboardingBusy(false);
    }
  };

  const processInviteAccept = confirmJoinFamily;
  const handleConfirmInviteJoin = confirmJoinFamily;

  const handleLogout = async () => {
    try {
      localStorage.removeItem("local_guest_profile");
      localStorage.removeItem("local_guest_uid");
      localStorage.removeItem("familyCode");
      localStorage.removeItem("inviteCode");
      localStorage.removeItem("memberId");
      localStorage.removeItem("familyLogin");
      setUser(null);
      setCurrentUserProfile(null);
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  // Onboarding action: Create Family
  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentUserProfile || !newFamilyName.trim() || isOnboardingBusy) return;
    
    // Whitelist check
    if (!isWhitelistedCreator && user.email !== "juwen616@gmail.com") {
      toast.error("❌ 您尚未獲得家庭創立白名單授權！請加入既有家庭或申請開通白名單。");
      return;
    }

    setIsOnboardingBusy(true);

    try {
      const familyId = `fam_${Math.random().toString(36).substr(2, 9)}`;
      const inviteCode = Math.random().toString(36).substr(2, 6).toUpperCase(); // short code

      // 1. Write family profile
      const familyDocRef = doc(db, "families", familyId);
      const newFamily = {
        id: familyId,
        name: newFamilyName.trim(),
        adminUid: user.uid,
        inviteCode: inviteCode,
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

      // 3. Update current user profile to Owner (Upgraded owner role)
      const userDocRef = doc(db, "users", user.uid);
      const updatedProfile: UserProfile = {
        ...currentUserProfile,
        familyId,
        role: UserRole.OWNER,
      };
      await updateDoc(userDocRef, {
        familyId,
        role: UserRole.OWNER,
      });

      // 4. Create family_members link
      const memberId = `${familyId}_${user.uid}`;
      await setDoc(doc(db, "family_members", memberId), {
        id: memberId,
        familyId,
        userId: user.uid,
        displayName: currentUserProfile.displayName,
        role: UserRole.OWNER,
        stars: 0,
        createdAt: serverTimestamp(),
      });

      // 5. Audit Log
      await setDoc(doc(db, "audit_logs", `aud_${Date.now()}_init`), {
        id: `aud_${Date.now()}_init`,
        userId: user.uid,
        userName: `${currentUserProfile.displayName} (${UserRole.OWNER})`,
        familyId,
        action: `建立新家庭「${newFamilyName.trim()}」與邀請碼「${inviteCode}」`,
        targetId: familyId,
        targetName: newFamilyName.trim(),
        createdAt: new Date().toISOString(),
      });

      setCurrentUserProfile(updatedProfile);
      setActivePage("home");
      toast.success("🎉 家庭群組建立成功、系統已開通！邀請碼：" + inviteCode);
    } catch (err: any) {
      console.error(err);
      toast.error("❌ 家庭建立失敗，請稍後再試：" + err.message);
    } finally {
      setIsOnboardingBusy(false);
    }
  };

  // Approve a pending join request
  const handleApproveJoinRequest = async (req: any) => {
    if (!user || !currentUserProfile) return;
    try {
      // 1. Mark request as approved
      await updateDoc(doc(db, "join_requests", req.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
      });

      // 2. Update the target user's general status in nested users table
      await updateDoc(doc(db, "users", req.userId), {
        familyId: req.familyId,
        role: req.role,
        displayName: req.userName,
      });

      // 3. Insert family_members link
      const memberId = `${req.familyId}_${req.userId}`;
      await setDoc(doc(db, "family_members", memberId), {
        id: memberId,
        familyId: req.familyId,
        userId: req.userId,
        displayName: req.userName,
        role: req.role,
        stars: 0,
        createdAt: serverTimestamp(),
      });

      // 4. Record Audit Log detailing who approved who with what role
      await setDoc(doc(db, "audit_logs", `aud_${Date.now()}_appr`), {
        id: `aud_${Date.now()}_appr`,
        userId: user.uid,
        userName: `${currentUserProfile.displayName} (${currentUserProfile.role})`,
        familyId: req.familyId,
        action: `核准成員「${req.userName}」以「${req.role}」角色加入家庭`,
        targetId: req.userId,
        targetName: req.userName,
        createdAt: new Date().toISOString(),
      });

      toast.success(`✓ 已核准 ${req.userName} 加入您的家庭群組！`);
    } catch (err: any) {
      console.error(err);
      toast.error("❌ 核准失敗：" + err.message);
    }
  };

  // Reject a pending join request
  const handleRejectJoinRequest = async (req: any) => {
    if (!user || !currentUserProfile) return;
    try {
      // We delete it so they can resubmit if there was an error
      await deleteDoc(doc(db, "join_requests", req.id));

      // Record Audit Log
      await setDoc(doc(db, "audit_logs", `aud_${Date.now()}_rej`), {
        id: `aud_${Date.now()}_rej`,
        userId: user.uid,
        userName: `${currentUserProfile.displayName} (${currentUserProfile.role})`,
        familyId: req.familyId,
        action: `拒絕成員「${req.userName}」加入家庭的申請`,
        targetId: req.userId,
        targetName: req.userName,
        createdAt: new Date().toISOString(),
      });

      toast.success(`✓ 已婉拒 ${req.userName} 的加入申請。`);
    } catch (err: any) {
      console.error(err);
      toast.error("❌ 拒絕操作失敗：" + err.message);
    }
  };

  const createBirthdayEvent = async (memberId: string, birthday: string, familyId: string, memberName: string) => {
    if (!birthday) return;
    try {
      const cleanBday = birthday.replace(/\//g, "-");
      const parts = cleanBday.split("-");
      if (parts.length < 3) return;
      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);
      if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return;

      const yearsToGen = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
      for (const year of yearsToGen) {
        const age = year - birthYear;
        const eventDateStr = `${year}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
        const evtId = `birthday_${memberId}_${year}`;
        
        await setDoc(doc(db, "calendar_events", evtId), {
          id: evtId,
          familyId,
          title: `🎂 ${memberName} ${age}歲生日`,
          date: eventDateStr,
          time: "",
          isFixed: false,
          isPublic: true,
          note: `祝 ${memberName} 生日快樂！🎂🎉`,
          creatorUid: "system",
          creatorName: "系統",
          createdAt: serverTimestamp(),
          isBirthday: true,
          birthdayMemberUid: memberId,
          birthdayAge: age,
          birthdayMemberName: memberName,
          showAgeInCalendar: true
        });
      }
      console.log(`Successfully created physical birthday calendar events for ${memberName} (${memberId}) from 2025 to 2035.`);
    } catch (err) {
      console.error("Error creating birthday events:", err);
    }
  };

  const runAutoRepair = async (familyId: string) => {
    try {
      console.log("Running one-time birthday helper repair for family:", familyId);
      
      // 1. Get all members in families/{familyId}/members
      const membersSnap = await getDocs(collection(db, "families", familyId, "members"));
      const nestedMembersMap = new Map();
      membersSnap.forEach(docSnap => {
        nestedMembersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });

      // 2. Get all invites in families/{familyId}/invites
      const invitesSnap = await getDocs(collection(db, "families", familyId, "invites"));
      const invitesList: any[] = [];
      invitesSnap.forEach(docSnap => {
        invitesList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // 3. Get all active users in this family (from users collection)
      const usersSnap = await getDocs(query(collection(db, "users"), where("familyId", "==", familyId)));
      const usersList: any[] = [];
      usersSnap.forEach(docSnap => {
        usersList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // 4. Ensure each active user has a corresponding member document in families/{familyId}/members
      for (const u of usersList) {
        let nestedMember = nestedMembersMap.get(u.id);
        
        let shouldCreateOrUpdate = false;
        let updateData: any = {};

        if (!nestedMember) {
          // If no nested member document, create it!
          shouldCreateOrUpdate = true;
          nestedMember = {
            name: u.displayName || u.name || "家庭成員",
            role: u.role || "",
            birthday: u.birthday || null,
            showAge: u.showAge ?? u.showAgeInCalendar ?? true,
            avatar: u.photoURL || u.avatar || "",
            gender: u.gender || "",
            createdAt: serverTimestamp(),
            joinedAt: serverTimestamp()
          };
          updateData = { ...nestedMember };
        }

        // Now perform the specific repair comparison with invites if birthday is empty
        if (!nestedMember.birthday) {
          // Look up invite with same name/memberName
          const matchingInvite = invitesList.find(inv => 
            inv.memberName === nestedMember.name || 
            inv.name === nestedMember.name || 
            inv.memberName === u.displayName || 
            inv.name === u.displayName
          );

          if (matchingInvite && matchingInvite.birthday) {
            console.log("Found matching invite for empty birthday member:", nestedMember.name, matchingInvite.birthday);
            shouldCreateOrUpdate = true;
            updateData = {
              ...updateData,
              name: nestedMember.name || matchingInvite.name || matchingInvite.memberName,
              role: nestedMember.role || matchingInvite.role || matchingInvite.targetRole,
              birthday: matchingInvite.birthday,
              showAge: matchingInvite.showAge ?? true,
              avatar: matchingInvite.avatar || nestedMember.avatar || "",
              gender: matchingInvite.gender || nestedMember.gender || ""
            };
            
            // Sync it to the root user profile too to keep both in perfect sync
            await updateDoc(doc(db, "users", u.id), {
              birthday: matchingInvite.birthday,
              showAgeInCalendar: matchingInvite.showAge ?? true,
              gender: matchingInvite.gender || "",
              photoURL: matchingInvite.avatar || u.photoURL || ""
            });

            // Re-create the birthday event
            await createBirthdayEvent(u.id, matchingInvite.birthday, familyId, nestedMember.name || u.displayName);
          }
        }

        if (shouldCreateOrUpdate) {
          console.log("Writing nested member document for repair:", u.id, updateData);
          await setDoc(doc(db, "families", familyId, "members", u.id), updateData, { merge: true });
        }
      }

      console.log("Auto-repair completed successfully!");
    } catch (err) {
      console.error("Error during auto-repair:", err);
    }
  };

  // Onboarding action: Join Family (Transforms to request creation or direct automatic join if invite code matches!)
  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentUserProfile || !joinFamilyId.trim() || isOnboardingBusy) return;
    setIsOnboardingBusy(true);

    const inputCode = joinFamilyId.trim();

    try {
      // Find matching family or pre-determined invite code in invites collection
      // 1. Check if inputCode matches a pending predetermined invite in the invites collection
      const qInvite = query(
        collection(db, "invites"),
        where("inviteCode", "==", inputCode.toUpperCase()),
        where("status", "==", "pending")
      );
      const snapInvite = await getDocs(qInvite);

      if (!snapInvite.empty) {
        const inviteDoc = snapInvite.docs[0];
        const inviteData = inviteDoc.data();

        // Check if there is an email constraint
        if (inviteData.email && inviteData.email.toLowerCase() !== user.email?.toLowerCase()) {
          toast.error(`⚠️ 此邀請碼已被限定特定帳戶使用 (${inviteData.email})，與您目前的 Email (${user.email}) 不合！`);
          setIsOnboardingBusy(false);
          return;
        }

        const targetRole = inviteData.targetRole || UserRole.VIEWER;
        const targetFamilyId = inviteData.familyId;
        const targetFamilyName = inviteData.familyName || "我的家庭";

        // Upgraded Role processing (We directly enroll them!)
        // Fetch placeholder member profile if memberId exists to merge stars, name, themes
        let placeholderData: any = {};
        if (inviteData.memberId) {
          const mSnap = await getDoc(doc(db, "users", inviteData.memberId));
          if (mSnap.exists()) {
            placeholderData = mSnap.data();
            // Delete placeholder document to prevent duplication of members
            await deleteDoc(doc(db, "users", inviteData.memberId));
          }
          // Delete old family_members link for this placeholder
          const oldMemberLinkId = `${targetFamilyId}_${inviteData.memberId}`;
          await deleteDoc(doc(db, "family_members", oldMemberLinkId));
        }

        const finalDisplayName = inviteData.name || inviteData.memberName || placeholderData.displayName || joinDisplayName.trim() || currentUserProfile.displayName;
        const finalColor = placeholderData.color || currentUserProfile.color || "#B4C3B2";
        const finalPhotoURL = inviteData.avatar || placeholderData.photoURL || currentUserProfile.photoURL || "✿";
        const finalBirthday = inviteData.birthday || placeholderData.birthday || currentUserProfile.birthday || "";
        const finalGender = inviteData.gender || placeholderData.gender || currentUserProfile.gender || "";
        const finalShowAge = inviteData.showAge ?? true;
        const mergedStars = placeholderData.stars || 0;

        // Create the nested families/{familyId}/members/{userId} document
        const memberData = {
          name: finalDisplayName,
          role: inviteData.role || inviteData.targetRole || targetRole,
          birthday: finalBirthday || null,
          showAge: finalShowAge,
          avatar: finalPhotoURL,
          gender: finalGender,
          createdAt: serverTimestamp(),
          joinedAt: serverTimestamp()
        };

        await setDoc(doc(db, "families", targetFamilyId, "members", user.uid), memberData);

        console.log(
          "Member Created",
          memberData
        );

        // Auto Birthday Event
        if (memberData.birthday) {
          await createBirthdayEvent(user.uid, memberData.birthday, targetFamilyId, memberData.name);
        }

        // 1. Update the root user document
        await updateDoc(doc(db, "users", user.uid), {
          familyId: targetFamilyId,
          role: targetRole,
          displayName: finalDisplayName,
          color: finalColor,
          photoURL: finalPhotoURL,
          birthday: finalBirthday,
          showAgeInCalendar: finalShowAge,
          gender: finalGender,
          stars: mergedStars,
          updatedAt: new Date().toISOString()
        });

        // 2. Create family_members link (for legacy sync)
        const memberId = `${targetFamilyId}_${user.uid}`;
        await setDoc(doc(db, "family_members", memberId), {
          id: memberId,
          familyId: targetFamilyId,
          userId: user.uid,
          displayName: finalDisplayName,
          role: targetRole,
          stars: mergedStars,
          createdAt: serverTimestamp(),
        });

        // 3. Mark the invite as accepted and sync joined information
        await updateDoc(doc(db, "invites", inviteDoc.id), {
          status: "accepted",
          acceptedBy: user.uid,
          acceptedAt: new Date().toISOString(),
          joinedUserId: user.uid,
          joinedEmail: user.email || "",
          joinedTime: new Date().toISOString()
        });

        // 4. Audit Log
        const auditId = `aud_${Date.now()}_join`;
        await setDoc(doc(db, "audit_logs", auditId), {
          id: auditId,
          userId: user.uid,
          userName: `${finalDisplayName} (${targetRole})`,
          familyId: targetFamilyId,
          action: `進入「${targetFamilyName}」：使用專屬邀請碼「${inputCode.toUpperCase()}」自動啟用 ${targetRole} 權限並同步生日設定`,
          targetId: targetFamilyId,
          targetName: targetFamilyName,
          createdAt: new Date().toISOString(),
        });

        // Update local state
        const updatedProfile = {
          ...currentUserProfile,
          familyId: targetFamilyId,
          role: targetRole,
          displayName: finalDisplayName,
          color: finalColor,
          photoURL: finalPhotoURL,
          birthday: finalBirthday,
          showAgeInCalendar: finalShowAge,
          gender: finalGender
        };
        setCurrentUserProfile(updatedProfile);
        setActivePage("home");
        toast.success(`🎉 歡迎！您已使用專屬邀請碼成功進駐家庭「${targetFamilyName}」，並取得「${targetRole}」角色！`);
        setIsOnboardingBusy(false);
        return;
      }

      // If no MATCHING predetermined invite, proceed with direct standard validation/request setup
      let targetFamilyId = "";
      let targetFamilyName = "";

      // Check direct family ID matches or simple inviteCode on family node
      const directSnap = await getDoc(doc(db, "families", inputCode));
      if (directSnap.exists()) {
        targetFamilyId = directSnap.id;
        targetFamilyName = directSnap.data().name;
      } else {
        const qFam = query(collection(db, "families"), where("inviteCode", "==", inputCode.toUpperCase()));
        const snapFam = await getDocs(qFam);
        if (!snapFam.empty) {
          const docFam = snapFam.docs[0];
          targetFamilyId = docFam.id;
          targetFamilyName = docFam.data().name;
        }
      }

      if (!targetFamilyId) {
        toast.error("❌ 找不到此邀請碼或家庭，請向管理員重新索取最新產製的 6 碼對應代碼！");
        setIsOnboardingBusy(false);
        return;
      }

      // Check if user already has a pending request
      const qExisting = query(
        collection(db, "join_requests"),
        where("userId", "==", user.uid),
        where("familyId", "==", targetFamilyId),
        where("status", "==", "pending")
      );
      const snapExisting = await getDocs(qExisting);
      if (!snapExisting.empty) {
        toast.error("⚠️ 您已對此家庭發過審核申請，請耐心等待家長核准！");
        setIsOnboardingBusy(false);
        return;
      }

      // Create a pending join request document
      const requestId = `req_${Date.now()}_${user.uid.substr(0, 5)}`;
      await setDoc(doc(db, "join_requests", requestId), {
        id: requestId,
        userId: user.uid,
        userEmail: user.email || "",
        userName: joinDisplayName.trim() || currentUserProfile.displayName || "家庭成員",
        familyId: targetFamilyId,
        familyName: targetFamilyName,
        role: joinRole,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      toast.success(`🎉 申請已送出！請通知管理員媽媽（或家長）前往「家庭成員 ➡️ 邀請與加入審核」面板按下核准！`);
    } catch (err: any) {
      console.error(err);
      toast.error("❌ 送出申請失敗，請稍後重試：" + err.message);
    } finally {
      setIsOnboardingBusy(false);
    }
  };

  // Write announcement
  const handleAddAnnouncement = async (title: string, content: string) => {
    if (!effectiveUserProfile?.familyId) return;
    try {
      const annId = `ann_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "announcements", annId), {
        id: annId,
        familyId: effectiveUserProfile.familyId,
        title,
        content,
        creatorUid: user?.uid || "",
        creatorName: effectiveUserProfile.displayName,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "announcements");
    }
  };

  // Update announcement
  const handleUpdateAnnouncement = async (id: string, title: string, content: string) => {
    try {
      await updateDoc(doc(db, "announcements", id), {
        title,
        content,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `announcements/${id}`);
    }
  };

  // Delete announcement (妈妈 only)
  const handleDeleteAnnouncement = async (id: string) => {
    // Step 1
    console.log("Delete Start");
    
    // Step 2
    console.log("announcementId", id);
    console.log("familyId", effectiveUserProfile?.familyId);
    console.log("currentUser.uid", user?.uid);
    
    // Step 3
    console.log(`實際刪除路徑: announcements/${id}`);

    try {
      const docRef = doc(db, "announcements", id);
      await deleteDoc(docRef);
      console.log("公告刪除成功");
      
      // Update local state immediately for instant refresh without page reload
      setAnnouncements((prev) => prev.filter((item) => item.id !== id));
      toast.success("✓ 公告刪除成功！");
    } catch (err: any) {
      console.error("公告刪除失敗");
      console.error("Firebase Error Code:", err?.code || "N/A");
      console.error("Firebase Error Message:", err?.message || err?.toString());
      console.error(err);
      
      const errMsg = `Firebase Error [${err?.code || "UNKNOWN"}]: ${err?.message || "資料刪除失敗"}`;
      toast.error(`❌ ${errMsg}`);
      
      // Rethrow to let UI catch it and display it in the Admin Debug Info section of the specific card
      throw err;
    }
  };

  // Write family note
  const handleAddFamilyNote = async (title: string, content: string, date: string) => {
    if (!effectiveUserProfile?.familyId) return;
    try {
      const noteId = `note_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "family_notes", noteId), {
        id: noteId,
        familyId: effectiveUserProfile.familyId,
        title,
        content,
        date,
        creatorUid: user?.uid || "",
        creatorName: effectiveUserProfile.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success("🎉 家庭記事新增成功！");
    } catch (err: any) {
      toast.error("❌ 新增家庭記事失敗：" + err.message);
    }
  };

  // Update family note
  const handleUpdateFamilyNote = async (id: string, title: string, content: string, date: string) => {
    try {
      await updateDoc(doc(db, "family_notes", id), {
        title,
        content,
        date,
        updatedAt: serverTimestamp(),
      });
      toast.success("✓ 家庭記事修改成功！");
    } catch (err: any) {
      toast.error("❌ 修改家庭記事失敗：" + err.message);
    }
  };

  // Delete family note
  const handleDeleteFamilyNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, "family_notes", id));
      toast.success("✓ 已刪除該筆家庭記事");
    } catch (err: any) {
      toast.error("❌ 刪除家庭記事失敗：" + err.message);
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
      toast.success("禮物商品已刪除！");
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

  // 1. 撤銷兌換 (取消兌換 + 恢復星星)
  const handleCancelRedemption = async (redemptionId: string) => {
    try {
      const redRef = doc(db, "redemptions", redemptionId);
      const redSnap = await getDoc(redRef);
      if (!redSnap.exists()) {
        toast.error("❌ 找不到兌換請求記錄");
        return;
      }
      const redData = redSnap.data() as Redemption;

      // Restore child's stars if the redemption was approved
      if (redData.status === "approved") {
        const childProfileRef = doc(db, "users", redData.childUid);
        const childSnap = await getDoc(childProfileRef);
        if (childSnap.exists()) {
          const currentStars = childSnap.data().stars || 0;
          const newStars = currentStars + redData.starsRequired;

          // Update user profile stars
          await updateDoc(childProfileRef, { stars: newStars });

          // Update companion family_member link stars
          const memberId = `${currentUserProfile?.familyId}_${redData.childUid}`;
          try {
            await updateDoc(doc(db, "family_members", memberId), { stars: newStars });
          } catch (memErr) {
            console.warn("Family member synch skipped during cancellation:", memErr);
          }

          // Record star refund transaction
          const transactionId = `trans_${Math.random().toString(36).substr(2, 9)}`;
          const newTransaction = {
            id: transactionId,
            familyId: currentUserProfile?.familyId || "",
            childUid: redData.childUid,
            childName: redData.childName,
            amount: redData.starsRequired,
            type: "increase",
            reason: `💥 撤銷兌換【${redData.rewardTitle}】退回星星`,
            operatorUid: user?.uid || "",
            operatorName: currentUserProfile?.displayName || "家長",
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, "star_transactions", transactionId), newTransaction);
        }
      }

      // Set state to canceled
      await updateDoc(redRef, { status: "canceled" });
      logFirestoreOp("update", `redemptions/${redemptionId}`, "success", `撤銷兌換並恢復星星`);
      toast.success(`✅ 已成功撤銷該兌換，孩子星星已恢復！`);
    } catch (err: any) {
      logFirestoreOp("write", `redemptions/${redemptionId}`, "error", err.message);
      toast.error(`❌ 撤銷兌換失敗: ${err.message}`);
      handleFirestoreError(err, OperationType.WRITE, `redemptions/${redemptionId}`);
    }
  };

  // 2. 刪除兌換紀錄
  const handleDeleteRedemption = async (redemptionId: string) => {
    try {
      await deleteDoc(doc(db, "redemptions", redemptionId));
      logFirestoreOp("delete", `redemptions/${redemptionId}`, "success", "直接刪除兌換紀錄");
      toast.success("✅ 兌換歷史紀錄已刪除！");
    } catch (err: any) {
      logFirestoreOp("delete", `redemptions/${redemptionId}`, "error", err.message);
      toast.error(`❌ 刪除兌換紀錄失敗: ${err.message}`);
    }
  };

  // 3. 修改兌換紀錄內容
  const handleUpdateRedemption = async (redemptionId: string, updates: Partial<Redemption>) => {
    try {
      await updateDoc(doc(db, "redemptions", redemptionId), updates);
      logFirestoreOp("update", `redemptions/${redemptionId}`, "success", "修改兌換歷史紀錄");
      toast.success("✅ 兌換紀錄修改成功！");
    } catch (err: any) {
      logFirestoreOp("update", `redemptions/${redemptionId}`, "error", err.message);
      toast.error(`❌ 修改兌換紀錄失敗: ${err.message}`);
    }
  };

  // Helper for human-friendly Firestore permission error messages
  const getFriendlyErrorMessage = (err: any, fallbackStr: string = "操作失敗"): string => {
    const msg = err?.message || String(err);
    if (msg.includes("permission-denied") || msg.includes("permissions") || msg.includes("insufficient") || msg.includes("permission")) {
      return "❌ 目前登入身份不是管理員，請聯絡家庭管理者";
    }
    return `❌ ${fallbackStr}: ${msg}`;
  };

  // 4. 刪除星星流水帳
  const handleDeleteTransaction = async (transactionId: string, rollbackStars: boolean) => {
    try {
      const txRef = doc(db, "star_transactions", transactionId);
      const txSnap = await getDoc(txRef);
      if (!txSnap.exists()) {
        toast.error("❌ 找不到該星星紀錄");
        return;
      }
      const txData = txSnap.data();

      // Store in trash bin state before actual deletion for easy restoration
      setRecentlyDeletedTransactions((prev) => [
        {
          transaction: { id: transactionId, ...txData },
          rollbackStars,
          deletedAt: new Date(),
        },
        ...prev,
      ].slice(0, 15)); // Keep last 15 items in history

      if (rollbackStars && txData?.childUid) {
        // Reverse the original transaction amount from the child's stars
        const childProfileRef = doc(db, "users", txData.childUid);
        const childSnap = await getDoc(childProfileRef);
        if (childSnap.exists()) {
          const currentStars = childSnap.data().stars || 0;
          // subtract the original addition (if added, deduct it; if deducted, add it back)
          const newStars = Math.max(0, currentStars - (txData.amount || 0));

          await updateDoc(childProfileRef, { stars: newStars });

          const memberId = `${currentUserProfile?.familyId}_${txData.childUid}`;
          try {
            await updateDoc(doc(db, "family_members", memberId), { stars: newStars });
          } catch (memErr) {
            console.warn("Family member sync skipped:", memErr);
          }
        }
      }

      await deleteDoc(txRef);
      logFirestoreOp("delete", `star_transactions/${transactionId}`, "success", "刪除星星流水帳紀錄");
      toast.success(rollbackStars ? "✅ 紀錄已刪除，且已同步還原小孩星星！" : "✅ 紀錄已刪除！（未變動小孩星星）");
    } catch (err: any) {
      logFirestoreOp("delete", `star_transactions/${transactionId}`, "error", err.message);
      toast.error(getFriendlyErrorMessage(err, "刪除紀錄失敗"));
      handleFirestoreError(err, OperationType.DELETE, `star_transactions/${transactionId}`);
    }
  };

  // 5. 修改星星流水帳內容
  const handleUpdateTransaction = async (transactionId: string, updates: any) => {
    try {
      await updateDoc(doc(db, "star_transactions", transactionId), updates);
      logFirestoreOp("update", `star_transactions/${transactionId}`, "success", "修改星星流水帳內容");
      toast.success("✅ 星星紀錄修改成功！");
    } catch (err: any) {
      logFirestoreOp("update", `star_transactions/${transactionId}`, "error", err.message);
      toast.error(getFriendlyErrorMessage(err, "修改星星紀錄失敗"));
      handleFirestoreError(err, OperationType.UPDATE, `star_transactions/${transactionId}`);
    }
  };

  // 5b. 還原已刪除的星星對帳紀錄
  const handleRestoreTransaction = async (deletedItem: any) => {
    try {
      const { transaction, rollbackStars } = deletedItem;
      const txRef = doc(db, "star_transactions", transaction.id);

      // Recreate document in firestore
      await setDoc(txRef, {
        id: transaction.id || "",
        familyId: transaction.familyId || "",
        childUid: transaction.childUid || "",
        childName: transaction.childName || "",
        amount: transaction.amount || 0,
        type: transaction.type || "increase",
        reason: transaction.reason || "",
        operatorUid: transaction.operatorUid || "",
        operatorName: transaction.operatorName || "",
        createdAt: serverTimestamp() // Set fresh server timestamp
      });

      // If it was rolled back originally, reverse the rollback!
      if (rollbackStars && transaction.childUid) {
        const childProfileRef = doc(db, "users", transaction.childUid);
        const childSnap = await getDoc(childProfileRef);
        if (childSnap.exists()) {
          const currentStars = childSnap.data().stars || 0;
          // Reverse: if amount was originally deducted from child on delete, add it back now!
          const newStars = Math.max(0, currentStars + (transaction.amount || 0));

          await updateDoc(childProfileRef, { stars: newStars });

          const memberId = `${currentUserProfile?.familyId}_${transaction.childUid}`;
          try {
            await updateDoc(doc(db, "family_members", memberId), { stars: newStars });
          } catch (memErr) {
            console.warn("Family member sync skipped:", memErr);
          }
        }
      }

      // Remove from recentlyDeletedTransactions list
      setRecentlyDeletedTransactions(prev => prev.filter(item => item.transaction.id !== transaction.id));

      logFirestoreOp("create", `star_transactions/${transaction.id}`, "success", "還原誤刪的星星流水帳");
      toast.success("✅ 成功還原該筆星星紀錄，星星點數已同步恢復！");
    } catch (err: any) {
      logFirestoreOp("create", `star_transactions/${deletedItem.transaction.id}`, "error", err.message);
      toast.error(getFriendlyErrorMessage(err, "還原失敗"));
      handleFirestoreError(err, OperationType.CREATE, `star_transactions/${deletedItem.transaction.id}`);
    }
  };

  // 5c. 批次刪除多筆星星對帳紀錄
  const handleBatchDeleteTransactions = async (transactionIds: string[]) => {
    try {
      let deleteCount = 0;
      for (const id of transactionIds) {
        const txRef = doc(db, "star_transactions", id);
        const txSnap = await getDoc(txRef);
        if (txSnap.exists()) {
          const txData = txSnap.data();
          // Save in trash bin
          setRecentlyDeletedTransactions((prev) => [
            {
              transaction: { id, ...txData },
              rollbackStars: false,
              deletedAt: new Date(),
            },
            ...prev,
          ].slice(0, 15));

          await deleteDoc(txRef);
          deleteCount++;
          logFirestoreOp("delete", `star_transactions/${id}`, "success", "批次刪除對帳紀錄");
        }
      }
      toast.success(`✅ 已成功批次完成刪除寶貝的 ${deleteCount} 筆對帳明細！`);
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, "批次刪除失敗"));
      handleFirestoreError(err, OperationType.DELETE, `star_transactions/batch`);
    }
  };

  // 6. 重新設定 / 歸零小孩星星
  const handleResetUserStars = async (targetUid: string, targetStars: number) => {
    try {
      const childProfileRef = doc(db, "users", targetUid);
      const childSnap = await getDoc(childProfileRef);
      if (!childSnap.exists()) {
        toast.error("❌ 找不到該小孩成員");
        return;
      }
      const oldStars = childSnap.data().stars || 0;
      await updateDoc(childProfileRef, { stars: targetStars });

      const memberId = `${currentUserProfile?.familyId}_${targetUid}`;
      try {
        await updateDoc(doc(db, "family_members", memberId), { stars: targetStars });
      } catch (memErr) {
        console.warn("Family member sync skipped:", memErr);
      }

      const transactionId = `trans_${Math.random().toString(36).substr(2, 9)}`;
      const newTransaction = {
        id: transactionId,
        familyId: currentUserProfile?.familyId || "",
        childUid: targetUid,
        childName: childSnap.data().displayName || "小孩",
        amount: targetStars - oldStars,
        type: targetStars >= oldStars ? "increase" : "decrease",
        reason: `📦 媽媽強制重設星星 (原剩餘數: ${oldStars} ➡️ 已重設為: ${targetStars} 顆)`,
        operatorUid: user?.uid || "",
        operatorName: currentUserProfile?.displayName || "家長",
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "star_transactions", transactionId), newTransaction);

      toast.success(`✅ 已完成重設！小孩的星星已強制設定為 ${targetStars} 顆！`);
    } catch (err: any) {
      logFirestoreOp("write", `reset_stars/${targetUid}`, "error", err.message);
      toast.error(`❌ 重設星星失敗: ${err.message}`);
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

      // Create the nested families/{familyId}/members/{userId} document
      if (currentUserProfile.familyId) {
        const memberRef = doc(db, "families", currentUserProfile.familyId, "members", newUid);
        const nestedMemberData = {
          name: memberData.displayName,
          role: memberData.role,
          birthday: memberData.birthday || null,
          showAge: true,
          avatar: memberData.photoURL || "✿",
          gender: "",
          createdAt: serverTimestamp(),
          joinedAt: serverTimestamp()
        };
        await setDoc(memberRef, nestedMemberData);
        
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
        setTimeout(() => loadAppletData(true), 100);
      }
      return newUid;
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
      showAgeInCalendar?: boolean;
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
      if (updatedData.showAgeInCalendar !== undefined) updateObj.showAgeInCalendar = updatedData.showAgeInCalendar;
      
      await updateDoc(doc(db, "users", memberUid), updateObj);

      // Update nested families/{familyId}/members/{userId} document
      if (currentUserProfile?.familyId) {
        const nestedRef = doc(db, "families", currentUserProfile.familyId, "members", memberUid);
        const nestedUpdateObj: any = {
          name: updatedData.displayName,
          role: updatedData.role,
        };
        if (updatedData.birthday !== undefined) nestedUpdateObj.birthday = updatedData.birthday;
        if (updatedData.photoURL !== undefined) nestedUpdateObj.avatar = updatedData.photoURL;
        if (updatedData.showAgeInCalendar !== undefined) nestedUpdateObj.showAge = updatedData.showAgeInCalendar;

        await setDoc(nestedRef, nestedUpdateObj, { merge: true });

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
      // Unlink member from family instead of deleting their account
      await updateDoc(doc(db, "users", memberUid), {
        familyId: "",
        role: "",
        invitationId: "",
        inviteCode: "",
        inviteStatus: ""
      });

      // Revoke nested nested subcollection document as well
      if (currentUserProfile?.familyId) {
        await deleteDoc(doc(db, "families", currentUserProfile.familyId, "members", memberUid));
        const fmLinkId = `${currentUserProfile.familyId}_${memberUid}`;
        await deleteDoc(doc(db, "family_members", fmLinkId));
        clearCachedData(CACHE_KEY_MEMBERS(currentUserProfile.familyId));
        setTimeout(() => loadAppletData(true), 100);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${memberUid}`);
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
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-gray-800">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 font-bold select-none">家庭生活管理系統啟動中...</p>
        </div>
      </div>
    );
  }

  // 4. Render Google/Invite Login Portal (Landing screen)
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

          {/* Tab Navigation Pill */}
          <div className="flex bg-[#FAF8F5] border border-[#EFEAE2] p-1.5 rounded-2xl select-none">
            <button
              type="button"
              onClick={() => setLoginTab("google")}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                loginTab === "google"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-855"
              }`}
            >
              🔑 Google 快速登入
            </button>
            <button
              type="button"
              onClick={() => setLoginTab("invite")}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                loginTab === "invite"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-855"
              }`}
            >
              ✉️ 家庭邀請加入
            </button>
          </div>

          {loginTab === "google" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-left leading-relaxed text-amber-900 space-y-1.5">
                <span className="font-extrabold text-amber-850 flex items-center gap-1.5 select-none">
                  💡 安全與連接提醒：
                </span>
                <p>
                  本系統採用 <b>Google 快速認證安全登入</b>。初次登入會引導設定您在家庭的角色。若安全視窗被瀏覽器攔截，可點選右上角的「在新分頁打開」連結正常認證。
                </p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn || isOnboardingBusy}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:translate-y-0.5 text-white font-extrabold rounded-2xl shadow-md cursor-pointer transition flex items-center justify-center gap-2.5 tracking-wide text-sm disabled:opacity-50"
              >
                <Sparkles className="h-4.5 w-4.5 text-indigo-200" />
                {isLoggingIn ? "正在啟動 Google 登入..." : "使用 Google 快速登入"}
              </button>
            </div>
          )}

          {loginTab === "invite" && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              {!foundInvite ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-500 mb-1.5">
                      家庭代碼 (Family Code)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="請輸入家長設定的家庭代碼 (例如: fam_oqwzk5057)"
                      value={joinFamilyId}
                      onChange={(e) => setJoinFamilyId(e.target.value.trim())}
                      className="w-full text-sm border font-sans text-gray-700 border-gray-205 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#FAF8F5]/50 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-500 mb-1.5">
                      邀請碼 (Invite Code)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="請輸入 6 位專屬邀請碼 (例如: AB12CD)"
                      value={joinInviteCode}
                      onChange={(e) => setJoinInviteCode(e.target.value.trim().toUpperCase())}
                      className="w-full text-sm border font-mono font-black tracking-widest text-[#4A6076] border-gray-205 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#FAF8F5]/50 text-center uppercase"
                    />
                  </div>

                  {isSearchingInvite ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold select-none p-1 shrink-0 animate-pulse justify-center">
                      <div className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>正在驗證資訊...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleQueryInvite(joinFamilyId, joinInviteCode)}
                        className="w-full py-3 bg-[#4D6375] hover:bg-[#3d4f5e] text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        🔍 查詢邀請 (首次加入)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCodeLogin(joinFamilyId, joinInviteCode)}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        🔑 登入系統 (已加入成員)
                      </button>
                    </div>
                  )}

                  {searchInviteError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-xs font-semibold leading-relaxed">
                      ⚠️ {searchInviteError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FAF9F6] border-2 border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-sm text-left animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-center font-bold text-emerald-800 border-b border-gray-100 pb-3 flex items-center justify-center gap-1.5">
                    <span className="text-sm font-black">✉️ 找到您專屬的家庭邀請通知</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">🏡 受邀家庭</span>
                      <span className="font-black text-[#2D2926]">{foundInvite.familyName || "我的家庭"}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">👤 受邀者</span>
                      <span className="font-black text-rose-950 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{foundInvite.memberName || "新成員"}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">👑 角色關係</span>
                      <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-150/40 px-2 py-0.5 rounded">{getRoleLabel(foundInvite.targetRole)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">🔑 登入驗證</span>
                      <span className="font-bold text-gray-600">
                        {foundInvite.email ? `指定使用 Google 帳號 (${foundInvite.email})` : "無需帳號 (訪客免密碼直接加入)"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => confirmJoinFamily()}
                      disabled={isOnboardingBusy}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:translate-y-0.5 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-2 text-xs md:text-sm disabled:opacity-50"
                    >
                      {isOnboardingBusy ? (
                        <span>正在啟用並加入家庭...</span>
                      ) : foundInvite.email ? (
                        <span>🔑 使用指定 Google 登入並加入</span>
                      ) : (
                        <span>🚀 確認加入家庭</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFoundInvite(null);
                        setJoinFamilyId("");
                      }}
                      disabled={isOnboardingBusy}
                      className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 font-bold transition text-center bg-[#FAF8F5] hover:bg-gray-50 border border-gray-150 rounded-xl"
                    >
                      重新輸入 / 返回
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. Render Family Onboarding Selector (if user has no familyId linked)
  if (!currentUserProfile.familyId && currentUserProfile.email !== "juwen616@gmail.com") {
    // Check if we have an auto-matched invitation for this logged in email!
    if (googleMatchInvite) {
      return (
        <div className="min-h-screen bg-slate-50/60 flex items-center justify-center p-4 font-sans text-gray-800 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white border border-gray-150 rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-out duration-150">
            <div className="mx-auto h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl font-bold">
              ✉️
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                歡迎加入「{googleMatchInvite.familyName || "我的家庭"}」🏠
              </h1>
              <p className="text-sm text-gray-500 font-medium">您的家庭成員邀請已就緒！系統登入資訊：</p>
            </div>

            <div className="bg-[#FAF9F6] border border-gray-150 rounded-2xl p-4 text-left space-y-3 font-sans">
              <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                <span className="text-xs font-extrabold text-gray-500">👤 預設成員姓名</span>
                <span className="text-xs font-black text-rose-950 bg-rose-50 px-2 py-0.5 rounded border border-rose-105">{googleMatchInvite.name || googleMatchInvite.memberName}</span>
              </div>
              <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                <span className="text-xs font-extrabold text-gray-500">👑 角色身分</span>
                <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150/40 px-2 py-0.5 rounded">{getRoleLabel(googleMatchInvite.role || googleMatchInvite.targetRole)}</span>
              </div>
              <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                <span className="text-xs font-extrabold text-gray-500">📧 綁定 Google 帳號</span>
                <span className="text-xs font-bold text-gray-600 select-all font-mono">{googleMatchInvite.email}</span>
              </div>
            </div>

            <div className="text-xs text-[#4A6076] font-bold bg-[#FAF8F5] border border-gray-200 rounded-xl p-3 leading-relaxed text-left select-none">
              ℹ️ 按下「立即加入」後，系統會直接同步您的生日、年齡以及角色權限，並為您建立行事曆。
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={async () => {
                  setGoogleMatchInvite(null);
                  await handleLogout();
                }}
                disabled={isOnboardingBusy}
                className="flex-1 py-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition cursor-pointer"
              >
                取消 / 登出
              </button>
              <button
                type="button"
                onClick={() => processInviteAccept(googleMatchInvite)}
                disabled={isOnboardingBusy}
                className="flex-1 py-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                {isOnboardingBusy ? "加入中..." : "🚀 立即加入"}
              </button>
            </div>
          </div>
        </div>
      );
    }

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
                  if (!isWhitelistedCreator && currentUserProfile.email !== "juwen616@gmail.com") {
                    toast.error("🔒 只有列在白名單的 Email 且狀態啟用時才能創建新家庭！請向管理員索取加入邀請碼。");
                    return;
                  }
                  setOnboardingChoice("create");
                  setNewFamilyName(`${currentUserProfile.displayName}的幸福本家`);
                }}
                className={`p-6 border rounded-2xl text-left transition text-sm space-y-2 flex flex-col justify-between ${
                  isWhitelistedCreator || currentUserProfile.email === "juwen616@gmail.com"
                    ? "bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-300 border-gray-100"
                    : "bg-gray-50 opacity-60 cursor-not-allowed border-gray-200"
                }`}
              >
                <div className="w-full">
                  <span className="text-indigo-600 font-bold bg-white px-2.5 py-0.5 rounded-full text-xs box-border border">A 方案</span>
                  <h3 className="font-extrabold text-gray-800 text-sm mt-2">🏡 創建全新家庭</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    適合<b>管理員（媽媽）</b>發起本專案。建立後您將能指派週課表，指派任務賺星星。
                  </p>
                </div>
                {!isWhitelistedCreator && currentUserProfile.email !== "juwen616@gmail.com" && (
                  <div className="mt-2 text-[10px] text-amber-600 font-bold bg-amber-50/50 border border-amber-200 rounded px-2 py-1">
                    🔒 帳號未加入創立白名單，無法建立家庭。
                  </div>
                )}
              </button>

              <button
                onClick={() => {
                  setOnboardingChoice("join");
                  setJoinDisplayName(currentUserProfile.displayName);
                }}
                className="p-6 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 border border-gray-100 rounded-2xl text-left transition select-none text-sm space-y-2 flex flex-col justify-between"
              >
                <div>
                  <span className="text-emerald-700 font-bold bg-white px-2.5 py-0.5 rounded-full text-xs box-border border">B 方案</span>
                  <h3 className="font-extrabold text-gray-800 text-sm mt-2">🔑 加入既有家庭</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    適合<b>爸爸、小孩或其他家族成員</b>。輸入管理員媽媽產製的專屬進駐邀請代碼。
                  </p>
                </div>
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
                  className="w-full text-sm border border-gray-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              {!foundInvite ? (
                <div className="space-y-4">
                  <h3 className="font-extrabold text-gray-800 text-xs border-l-4 border-emerald-500 pl-2 select-none">
                    🔑 輸入邀請與家庭代碼 verify 驗證，免審批直接加入
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      家庭代碼 (Family Code / ID)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="請輸入家長設定的家庭代碼 (例如: fam_oqwzk5057)"
                      value={joinFamilyId}
                      onChange={(e) => setJoinFamilyId(e.target.value.trim())}
                      className="w-full text-sm border font-sans text-gray-700 border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#FAF8F5]/50 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      邀請碼 (Invite Code)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="請輸入 6 位專屬邀請碼 (例如: AB12CD)"
                      value={joinInviteCode}
                      onChange={(e) => setJoinInviteCode(e.target.value.trim().toUpperCase())}
                      className="w-full text-sm border font-mono font-black tracking-widest text-[#4A6076] border-gray-205 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#FAF8F5]/50 text-center uppercase"
                    />
                  </div>

                  {isSearchingInvite ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold select-none p-1 shrink-0 animate-pulse justify-center">
                      <div className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>正在驗證邀請資訊...</span>
                    </div>
                  ) : (
                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setOnboardingChoice("none")}
                        className="px-4 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 border rounded-xl transition"
                      >
                        返回
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQueryInvite(joinFamilyId, joinInviteCode)}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs"
                      >
                        🔍 查詢邀請
                      </button>
                    </div>
                  )}

                  {searchInviteError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-xs font-semibold leading-relaxed">
                      ⚠️ {searchInviteError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FAF9F6] border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs text-left animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-center font-bold text-emerald-800 border-b border-gray-100 pb-3 flex items-center justify-center gap-1.5">
                    <span className="text-xs font-black">✉️ 找到您專屬的家庭邀請通知</span>
                  </div>

                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">🏡 受邀家庭</span>
                      <span className="font-black text-[#2D2926]">{foundInvite.familyName || "我的家庭"}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                       <span className="font-extrabold text-gray-500">👤 受邀者</span>
                       <span className="font-black text-rose-950 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{foundInvite.name || foundInvite.memberName || "新成員"}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#EFEAE2] rounded-xl px-3.5 py-2">
                      <span className="font-extrabold text-gray-500">👑 角色關係</span>
                      <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-150/40 px-2 py-0.5 rounded">{getRoleLabel(foundInvite.targetRole || foundInvite.role)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => confirmJoinFamily()}
                      disabled={isOnboardingBusy}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:translate-y-0.5 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-2 text-xs"
                    >
                      {isOnboardingBusy ? "正在核實啟用中..." : "🚀 確認加入家庭"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFoundInvite(null);
                        setJoinFamilyId("");
                        setJoinInviteCode("");
                      }}
                      disabled={isOnboardingBusy}
                      className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-600 font-bold transition text-center bg-[#FAF8F5] hover:bg-gray-50 border border-gray-150 rounded-xl"
                    >
                      重新輸入 / 返回
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-50 pt-4 text-center">
            <button
               onClick={handleLogout}
               className="text-xs font-bold text-gray-400 hover:text-red-500 transition inline-flex items-center gap-1 cursor-pointer"
            >
               <LogOut className="h-3.5 w-3.5" /> 登出目前 Google 帳號
            </button>
          </div>
        </div>
      </div>
    );
  }



  const isSuperAdmin = currentUserProfile && (
    currentUserProfile.email === "juwen616@gmail.com" || 
    currentUserProfile.role === UserRole.SUPER_ADMIN || 
    (currentUserProfile as any).systemRole === "SUPER_ADMIN" ||
    (currentUserProfile as any).role === "SUPER_ADMIN"
  );

  // getRoleLabel has been hoisted to top level

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col text-gray-800">
      <Toaster position="top-right" />
      {/* Top Header Information panel */}
      <header
        id="applet-top-header"
        className="sticky top-0 bg-white border-b border-[#E5E1DA] z-40 shadow-sm font-sans flex flex-col"
      >
        {/* Mobile Header: 3 rows, high-density, native feel, respects mom-focused optimize */}
        <div className="block md:hidden px-4 py-1.5 border-b border-[#EFEAE2] bg-white text-[#2D2926] z-45 shadow-xs">
          {/* Row 1: App Title & Bell Alarm */}
          <div className="flex items-center justify-between h-7">
            <span className="font-extrabold text-[14.5px] tracking-tight text-[#2D2926]">🏡 小龜家生活大小事</span>
            <button className="p-1 text-gray-500 hover:text-amber-500 cursor-pointer relative" title="通知訊息">
              <Bell className="h-4.5 w-4.5 animate-pulse" />
              <span className="absolute top-1 right-1 h-1 w-1 bg-rose-500 rounded-full" />
            </button>
          </div>
          {/* Row 2: Clock Display */}
          <div className="text-gray-650 text-xs font-mono font-bold leading-tight h-5 flex items-center">
            <Clock isPlain={true} />
          </div>
          {/* Row 3: Simple identity status line */}
          <div className="text-gray-400 text-[11px] font-semibold mt-0.5 leading-none h-4">
            目前身份：{effectiveUserProfile ? (
              effectiveUserProfile.role === UserRole.ADMIN ? "管理員" :
              effectiveUserProfile.role === UserRole.PARENT ? "媽媽" :
              effectiveUserProfile.role === UserRole.KID ? `小孩 🌟 ${effectiveUserProfile.stars || 0}` : "成員"
            ) : "載入中"}
          </div>
        </div>

        {/* Upper Brand Row - Compressed height by 40%+ on mobile & desktop with direct horizontal layout */}
        <div className="hidden md:flex px-4 py-1.5 md:py-2.5 flex-row items-center justify-between gap-3 flex-wrap md:flex-nowrap border-b border-[#F5F2EB]/50 md:px-6">
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

            {effectiveUserProfile && (
              <button
                onClick={() => setShowIdentityModal(true)}
                className="p-1 px-2 text-[10px] font-bold text-[#EAA59E] hover:text-[#D1554A] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FEE2E0] rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="查看目前身份與權限資訊"
              >
                👤 目前身份資訊
              </button>
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
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "home"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                首頁
              </button>

              <button
                onClick={() => setActivePage("calendar")}
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "calendar"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                家庭行事曆
              </button>

              <button
                onClick={() => setActivePage("tasks")}
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "tasks"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                任務中心
              </button>

              <button
                onClick={() => setActivePage("rewards")}
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "rewards"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                禮物中心
              </button>

               {effectiveUserProfile && (
                effectiveUserProfile.role === UserRole.ADMIN || 
                effectiveUserProfile.role === UserRole.PARENT || 
                (effectiveUserProfile.role as any) === UserRole.CHILD || 
                (effectiveUserProfile.role as any) === "Child"
              ) && (
                <button
                  onClick={() => setActivePage("favorites")}
                  className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activePage === "favorites"
                      ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                      : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                  }`}
                >
                  <span>常用事項</span>
                  {((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child") && (
                    <span className="text-[9px] font-black text-[#D97706] bg-[#FFF1E6] px-1.5 py-0.5 rounded-full border border-amber-200/20 shadow-xs">👀 唯讀</span>
                  )}
                </button>
              )}

              <button
                onClick={() => setActivePage("special-periods")}
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activePage === "special-periods"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                <span>特別安排</span>
                {effectiveUserProfile && ((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child") && (
                  <span className="text-[9px] font-black text-[#D97706] bg-[#FFF1E6] px-1.5 py-0.5 rounded-full border border-amber-200/20 shadow-xs">👀 唯讀</span>
                )}
              </button>

              {effectiveUserProfile && (
                effectiveUserProfile.role === UserRole.ADMIN || 
                effectiveUserProfile.role === UserRole.PARENT || 
                (effectiveUserProfile.role as any) === UserRole.CHILD || 
                (effectiveUserProfile.role as any) === "Child"
              ) && (
                <button
                  onClick={() => setActivePage("members")}
                  className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activePage === "members"
                      ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                      : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                  }`}
                >
                  <span>家庭成員</span>
                  {((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child") && (
                    <span className="text-[9px] font-black text-[#D97706] bg-[#FFF1E6] px-1.5 py-0.5 rounded-full border border-amber-200/20 shadow-xs">👀 唯讀</span>
                  )}
                </button>
              )}

              <button
                onClick={() => setActivePage("notes")}
                className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-200 border cursor-pointer whitespace-nowrap ${
                  activePage === "notes"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-[#E7DCD5] shadow-sm font-extrabold"
                    : "bg-white text-[#666666] border-[#E5E1DA] hover:bg-gray-50/55"
                }`}
              >
                家庭記事
              </button>

              {(isSuperAdmin || (effectiveUserProfile && ((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child"))) && (
                <button
                  onClick={() => setActivePage("admin")}
                  className={`px-5 py-2.5 text-sm md:text-base font-black rounded-full transition-all duration-150 border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activePage === "admin"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm font-extrabold"
                      : "bg-white text-indigo-650 border-[#E5E1DA] hover:bg-indigo-50/25"
                  }`}
                >
                  <span>🛡️ 系統管理中心</span>
                  {((effectiveUserProfile?.role as any) === UserRole.CHILD || (effectiveUserProfile?.role as any) === "Child") && (
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-250/20 shadow-xs">👀 唯讀</span>
                  )}
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

      {/* Main Content Layout */}
      <div className="flex-grow max-w-7xl w-full mx-auto p-4 lg:p-6 pb-[120px] md:pb-6">
        
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
                  redemptions={redemptions}
                  onAddAnnouncement={handleAddAnnouncement}
                  onUpdateAnnouncement={handleUpdateAnnouncement}
                  onDeleteAnnouncement={handleDeleteAnnouncement}
                  onNavigateToEvent={handleNavigateToEvent}
                  onAddEvent={handleAddEvent}
                  activeModeConfig={activeModeConfig}
                  configuredModes={activeSetting?.configuredModes || []}
                  simulatedTodayDate={simulatedTodayDate}
                  onSetSimulatedTodayDate={setSimulatedTodayDate}
                  onSaveConfiguredMode={handleSaveConfiguredMode}
                  onDeleteConfiguredMode={handleDeleteConfiguredMode}
                  onChangePage={setActivePage}
                  dataLoaded={dataLoaded}
                  activeFamily={activeFamily}
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
                  redemptions={redemptions}
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
                  activeFamily={activeFamily}
                  onAddReward={handleAddReward}
                  onApproveWish={handleApproveWish}
                  onRedeemReward={handleRedeemReward}
                  onApproveRedemption={handleApproveRedemption}
                  onRejectRedemption={handleRejectRedemption}
                  onDeleteReward={handleDeleteReward}
                  onUpdateReward={handleUpdateReward}
                  onCancelRedemption={handleCancelRedemption}
                  onDeleteRedemption={handleDeleteRedemption}
                  onUpdateRedemption={handleUpdateRedemption}
                  onDeleteTransaction={handleDeleteTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onResetUserStars={handleResetUserStars}
                  recentlyDeletedTransactions={recentlyDeletedTransactions}
                  onRestoreTransaction={handleRestoreTransaction}
                  onBatchDeleteTransactions={handleBatchDeleteTransactions}
                  onClearTrashBin={() => setRecentlyDeletedTransactions([])}
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
                  pendingRequests={pendingRequests}
                  onApproveJoinRequest={handleApproveJoinRequest}
                  onRejectJoinRequest={handleRejectJoinRequest}
                  onBindGoogle={handleBindGoogle}
                />
              )}

              {activePage === "notes" && effectiveUserProfile && (
                <FamilyNotesView
                  currentUser={effectiveUserProfile}
                  notes={familyNotes}
                  onAddNote={handleAddFamilyNote}
                  onUpdateNote={handleUpdateFamilyNote}
                  onDeleteNote={handleDeleteFamilyNote}
                />
              )}

              {activePage === "admin" && (isSuperAdmin || (effectiveUserProfile && ((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child"))) && (
                <AdminCenter 
                  currentUser={effectiveUserProfile}
                  activeFamily={activeFamily}
                  familyMembers={familyMembers}
                  developerModeActive={developerModeActive}
                  setDeveloperModeActive={setDeveloperModeActive}
                  setShowDevPanel={setShowDevPanel}
                  loadTimeMs={loadTimeMs}
                  queryCount={queryCount}
                  listenerCount={listenerCount}
                  lagSimulated={lagSimulated}
                  setLagSimulated={setLagSimulated}
                  simulatedTodayDate={simulatedTodayDate}
                  onSetSimulatedTodayDate={setSimulatedTodayDate}
                  handleResetCounters={handleResetCounters}
                  simulatedFamilyId={simulatedFamilyId}
                  onSetSimulatedFamilyId={setSimulatedFamilyId}
                  simulatedRole={simulatedRole}
                  onSetSimulatedRole={setSimulatedRole}
                  simulatedMemberId={simulatedMemberId}
                  onSetSimulatedMemberId={setSimulatedMemberId}
                />
              )}
            </div>

            {/* MOBILE MODE VIEW (independent single-view Tab navigation layout) */}
            <div className="block md:hidden w-full pb-8">
              {effectiveUserProfile && (
                <>
                  {/* 首頁 */}
                  {activePage === "home" && (
                    <div id="mobile-view-home" className="animate-in fade-in duration-200">
                      <HomeDashboard
                        currentUser={effectiveUserProfile}
                        events={events}
                        announcements={announcements}
                        tasks={tasks}
                        familyMembers={familyMembers}
                        systemMode={currentModeValue}
                        rewards={rewards}
                        redemptions={redemptions}
                        onAddAnnouncement={handleAddAnnouncement}
                        onUpdateAnnouncement={handleUpdateAnnouncement}
                        onDeleteAnnouncement={handleDeleteAnnouncement}
                        onNavigateToEvent={(eventId, date) => {
                          setCalendarDeepLink({ eventId, date });
                          setActivePage("calendar");
                        }}
                        onAddEvent={handleAddEvent}
                        activeModeConfig={activeModeConfig}
                        configuredModes={activeSetting?.configuredModes || []}
                        simulatedTodayDate={simulatedTodayDate}
                        onSetSimulatedTodayDate={setSimulatedTodayDate}
                        onSaveConfiguredMode={handleSaveConfiguredMode}
                        onDeleteConfiguredMode={handleDeleteConfiguredMode}
                        onChangePage={setActivePage}
                        dataLoaded={dataLoaded}
                        activeFamily={activeFamily}
                      />
                    </div>
                  )}

                  {/* 家庭行事曆 */}
                  {activePage === "calendar" && (
                    <div id="mobile-view-calendar" className="animate-in fade-in duration-200">
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
                  )}

                  {/* 任務中心 */}
                  {activePage === "tasks" && (
                    <div id="mobile-view-tasks" className="animate-in fade-in duration-200">
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
                        redemptions={redemptions}
                      />
                    </div>
                  )}

                  {/* 禮物中心 */}
                  {activePage === "rewards" && (
                    <div id="mobile-view-rewards" className="animate-in fade-in duration-200">
                      <RewardCenter
                        currentUser={effectiveUserProfile}
                        rewards={rewards}
                        redemptions={redemptions}
                        familyMembers={familyMembers}
                        starTransactions={starTransactions}
                        onAdjustStars={handleAdjustStars}
                        activeFamily={activeFamily}
                        onAddReward={handleAddReward}
                        onApproveWish={handleApproveWish}
                        onRedeemReward={handleRedeemReward}
                        onApproveRedemption={handleApproveRedemption}
                        onRejectRedemption={handleRejectRedemption}
                        onDeleteReward={handleDeleteReward}
                        onUpdateReward={handleUpdateReward}
                        onCancelRedemption={handleCancelRedemption}
                        onDeleteRedemption={handleDeleteRedemption}
                        onUpdateRedemption={handleUpdateRedemption}
                        onDeleteTransaction={handleDeleteTransaction}
                        onUpdateTransaction={handleUpdateTransaction}
                        onResetUserStars={handleResetUserStars}
                        recentlyDeletedTransactions={recentlyDeletedTransactions}
                        onRestoreTransaction={handleRestoreTransaction}
                        onBatchDeleteTransactions={handleBatchDeleteTransactions}
                        onClearTrashBin={() => setRecentlyDeletedTransactions([])}
                      />
                    </div>
                  )}

                  {/* 常用事項 */}
                  {activePage === "favorites" && (
                    <div id="mobile-view-favorites" className="animate-in fade-in duration-200 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setActivePage("more")}
                          className="px-3 py-1.5 bg-white text-[#7C6354] border border-[#EFEAE2] rounded-full text-xs font-black cursor-pointer shadow-xs active:scale-95 transition"
                        >
                          ⬅ 返回更多功能
                        </button>
                      </div>
                      <FavoriteMgr
                        currentUser={effectiveUserProfile}
                        favoriteActivities={favoriteActivities}
                        onAddFavorite={handleAddFavorite}
                        onDeleteFavorite={handleDeleteFavorite}
                        onEditFavorite={handleEditFavorite}
                      />
                    </div>
                  )}

                  {/* 特別期間安排 */}
                  {activePage === "special-periods" && (
                    <div id="mobile-view-special-periods" className="animate-in fade-in duration-200 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setActivePage("more")}
                          className="px-3 py-1.5 bg-white text-[#7C6354] border border-[#EFEAE2] rounded-full text-xs font-black cursor-pointer shadow-xs active:scale-95 transition"
                        >
                          ⬅ 返回更多功能
                        </button>
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
                  )}

                  {/* 家庭成員 */}
                  {activePage === "members" && (
                    <div id="mobile-view-members" className="animate-in fade-in duration-200 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setActivePage("more")}
                          className="px-3 py-1.5 bg-white text-[#7C6354] border border-[#EFEAE2] rounded-full text-xs font-black cursor-pointer shadow-xs active:scale-95 transition"
                        >
                          ⬅ 返回更多功能
                        </button>
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
                        pendingRequests={pendingRequests}
                        onApproveJoinRequest={handleApproveJoinRequest}
                        onRejectJoinRequest={handleRejectJoinRequest}
                        onBindGoogle={handleBindGoogle}
                      />
                    </div>
                  )}

                  {/* 家庭記事 */}
                  {activePage === "notes" && (
                    <div id="mobile-view-notes" className="animate-in fade-in duration-200 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setActivePage("more")}
                          className="px-3 py-1.5 bg-white text-[#7C6354] border border-[#EFEAE2] rounded-full text-xs font-black cursor-pointer shadow-xs active:scale-95 transition"
                        >
                          ⬅ 返回更多功能
                        </button>
                      </div>
                      <FamilyNotesView
                        currentUser={effectiveUserProfile}
                        notes={familyNotes}
                        onAddNote={handleAddFamilyNote}
                        onUpdateNote={handleUpdateFamilyNote}
                        onDeleteNote={handleDeleteFamilyNote}
                      />
                    </div>
                  )}

                  {/* 系統管理 */}
                  {activePage === "admin" && (isSuperAdmin || (effectiveUserProfile && ((effectiveUserProfile.role as any) === UserRole.CHILD || (effectiveUserProfile.role as any) === "Child"))) && (
                    <div id="mobile-view-admin" className="animate-in fade-in duration-200 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setActivePage("more")}
                          className="px-3 py-1.5 bg-white text-[#7C6354] border border-[#EFEAE2] rounded-full text-xs font-black cursor-pointer shadow-xs active:scale-95 transition"
                        >
                          ⬅ 返回更多功能
                        </button>
                      </div>
                      <AdminCenter 
                        currentUser={effectiveUserProfile}
                        activeFamily={activeFamily}
                        familyMembers={familyMembers}
                        developerModeActive={developerModeActive}
                        setDeveloperModeActive={setDeveloperModeActive}
                        setShowDevPanel={setShowDevPanel}
                        loadTimeMs={loadTimeMs}
                        queryCount={queryCount}
                        listenerCount={listenerCount}
                        lagSimulated={lagSimulated}
                        setLagSimulated={setLagSimulated}
                        simulatedTodayDate={simulatedTodayDate}
                        onSetSimulatedTodayDate={setSimulatedTodayDate}
                        handleResetCounters={handleResetCounters}
                        simulatedFamilyId={simulatedFamilyId}
                        onSetSimulatedFamilyId={setSimulatedFamilyId}
                        simulatedRole={simulatedRole}
                        onSetSimulatedRole={setSimulatedRole}
                        simulatedMemberId={simulatedMemberId}
                        onSetSimulatedMemberId={setSimulatedMemberId}
                      />
                    </div>
                  )}

                  {/* 獨立更多功能頁面 (2x2 Grid) */}
                  {activePage === "more" && (() => {
                    const isKid = (effectiveUserProfile?.role as any) === UserRole.CHILD || (effectiveUserProfile?.role as any) === "Child";
                    return (
                      <div className="animate-in fade-in duration-200 space-y-4 text-[#3C332D]">
                        <div className="border-b border-[#F5F2EB] pb-2">
                          <h2 className="text-base font-black text-gray-700 flex items-center gap-1.5">
                            <span>⚙️</span> 更多功能
                          </h2>
                          <p className="text-xs text-gray-400 mt-0.5">家庭管理與備事清單</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {/* 1. 常用事項 */}
                          <button
                            onClick={() => setActivePage("favorites")}
                            className="p-3 bg-white border border-[#EFEAE2] rounded-2xl text-left flex flex-col justify-between min-h-[95px] shadow-xs active:scale-97 hover:border-amber-200 transition cursor-pointer relative"
                          >
                            <div className="h-7 w-7 bg-amber-50 rounded-lg flex items-center justify-center text-[#7C6354]">
                              <Sparkles className="h-4 w-4 text-amber-500" />
                            </div>
                            {isKid && (
                              <span className="absolute top-2 right-2 text-[8px] font-black tracking-wide text-[#D97706] bg-[#FFF9F1] border border-amber-200/50 px-1.5 py-0.5 rounded-full select-none shadow-[inset_0_1px_2px_rgba(230,190,120,0.1)]">
                                🔒 僅查看
                              </span>
                            )}
                            <div>
                              <h3 className="text-[12px] font-black mt-1.5">⚡ 常用事項</h3>
                              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">常用行程快速建檔</p>
                            </div>
                          </button>

                          {/* 2. 特別期間安排 */}
                          <button
                            onClick={() => setActivePage("special-periods")}
                            className="p-3 bg-white border border-[#EFEAE2] rounded-2xl text-left flex flex-col justify-between min-h-[95px] shadow-xs active:scale-97 hover:border-indigo-200 transition cursor-pointer relative"
                          >
                            <div className="h-7 w-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-650">
                              <CalendarDays className="h-4 w-4 text-[#7559AC]" />
                            </div>
                            {isKid && (
                              <span className="absolute top-2 right-2 text-[8px] font-black tracking-wide text-[#D97706] bg-[#FFF9F1] border border-amber-200/50 px-1.5 py-0.5 rounded-full select-none shadow-[inset_0_1px_2px_rgba(230,190,120,0.1)]">
                                🔒 僅查看
                              </span>
                            )}
                            <div>
                              <h3 className="text-[12px] font-black mt-1.5">🏕️ 特別安排</h3>
                              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">寒暑假與大假計畫</p>
                            </div>
                          </button>

                          {/* 3. 家庭成員 */}
                          <button
                            onClick={() => setActivePage("members")}
                            className="p-3 bg-white border border-[#EFEAE2] rounded-2xl text-left flex flex-col justify-between min-h-[95px] shadow-xs active:scale-97 hover:border-teal-200 transition cursor-pointer relative"
                          >
                            <div className="h-7 w-7 bg-[#EBF5EF] rounded-lg flex items-center justify-center text-[#4A6076]">
                              <Users className="h-4 w-4 text-[#4A6076]" />
                            </div>
                            {isKid && (
                              <span className="absolute top-2 right-2 text-[8px] font-black tracking-wide text-[#D97706] bg-[#FFF9F1] border border-amber-200/50 px-1.5 py-0.5 rounded-full select-none shadow-[inset_0_1px_2px_rgba(230,190,120,0.1)]">
                                🔒 僅查看
                              </span>
                            )}
                            <div>
                              <h3 className="text-[12px] font-black mt-1.5">👨‍👩‍👧‍👦 家庭成員</h3>
                              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">成員角色與權限</p>
                            </div>
                          </button>

                          {/* 4. 系統管理 */}
                          <button
                            onClick={() => setActivePage("admin")}
                            className="p-3 bg-white border border-[#EFEAE2] rounded-2xl text-left flex flex-col justify-between min-h-[95px] shadow-xs active:scale-97 hover:border-indigo-200 transition cursor-pointer relative"
                          >
                            <div className="h-7 w-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                              <Settings className="h-4 w-4 text-indigo-600" />
                            </div>
                            {isKid && (
                              <span className="absolute top-2 right-2 text-[8px] font-black tracking-wide text-[#D97706] bg-[#FFF9F1] border border-amber-200/50 px-1.5 py-0.5 rounded-full select-none shadow-[inset_0_1px_2px_rgba(230,190,120,0.1)]">
                                🔒 僅查看
                              </span>
                            )}
                            <div>
                              <h3 className="text-[12px] font-black mt-1.5">🛡️ 系統管理</h3>
                              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">模擬測試與重置</p>
                            </div>
                          </button>

                        {/* 5. 家庭記事 */}
                        <button
                          onClick={() => setActivePage("notes")}
                          className="p-3 bg-white border border-[#EFEAE2] rounded-2xl text-left flex flex-col justify-between min-h-[95px] shadow-xs active:scale-97 hover:border-rose-200 transition cursor-pointer col-span-2 sm:col-span-1"
                        >
                          <div className="h-7 w-7 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
                            <BookOpen className="h-4 w-4 text-rose-500" />
                          </div>
                          <div>
                            <h3 className="text-[12px] font-black mt-1.5">📜 家庭記事</h3>
                            <p className="text-[9px] text-gray-400 leading-tight mt-0.5">保留家庭重要大事記與美好回憶</p>
                          </div>
                        </button>
                      </div>

                      {/* Member Badge Summary card strictly within the view */}
                      <div className="bg-[#FAF9F6] border border-[#EFEAE2] p-2.5 rounded-2xl flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <div
                            style={{ backgroundColor: effectiveUserProfile?.color || "#B4C3B2" }}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs text-[#2D2926] border border-[#EFEAE2] select-none font-extrabold"
                          >
                            {(!effectiveUserProfile?.photoURL || effectiveUserProfile?.photoURL.startsWith("http")) 
                              ? (effectiveUserProfile?.displayName ? effectiveUserProfile.displayName.charAt(0) : "✿") 
                              : effectiveUserProfile?.photoURL}
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#2D2926]">{effectiveUserProfile?.displayName}</div>
                            <div className="text-[10px] text-[#7C6354] font-bold mt-0.5">目前身份：{effectiveUserProfile?.role === UserRole.PARENT ? "媽媽" : "成員"}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setShowIdentityModal(true)}
                            className="bg-white border border-[#EFEAE2] hover:bg-gray-50 text-[#7C6354] font-semibold px-2 px-2.5 py-1 rounded-full text-[10px] cursor-pointer"
                          >
                            權限
                          </button>
                          <button
                            onClick={handleLogout}
                            className="bg-red-50 text-red-600 border border-red-100 px-2 px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer"
                          >
                            登出
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>
              )}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* MOBILE BOTTOM FIXED QUICK BAR */}
      <div 
        id="mobile-bottom-quickbar" 
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EFEAE2] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] md:hidden flex items-center justify-around z-50 select-none px-2"
        style={{ 
          height: "calc(80px + env(safe-area-inset-bottom, 0px))", 
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
          paddingTop: "6px"
        }}
      >
        <button
          onClick={() => {
            setActivePage("home");
          }}
          style={{ minWidth: "72px", minHeight: "72px" }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[16px] transition-all duration-150 cursor-pointer ${
            activePage === "home"
              ? "bg-[#FFF7E8] text-[#8B6B56] font-bold"
              : "text-gray-400 font-semibold hover:text-[#7C6354]"
          }`}
        >
          <Home className={`h-7 w-7 ${activePage === "home" ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
          <span className="text-[14px] mt-0.5 font-semibold">首頁</span>
        </button>

        <button
          onClick={() => {
            setActivePage("calendar");
          }}
          style={{ minWidth: "72px", minHeight: "72px" }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[16px] transition-all duration-150 cursor-pointer ${
            activePage === "calendar"
              ? "bg-[#FFF7E8] text-[#8B6B56] font-bold"
              : "text-gray-400 font-semibold hover:text-[#7C6354]"
          }`}
        >
          <CalendarDays className={`h-7 w-7 ${activePage === "calendar" ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
          <span className="text-[14px] mt-0.5 font-semibold">行事曆</span>
        </button>

        <button
          onClick={() => {
            setActivePage("tasks");
          }}
          style={{ minWidth: "72px", minHeight: "72px" }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[16px] transition-all duration-150 cursor-pointer ${
            activePage === "tasks"
              ? "bg-[#FFF7E8] text-[#8B6B56] font-bold"
              : "text-gray-400 font-semibold hover:text-[#7C6354]"
          }`}
        >
          <ClipboardList className={`h-7 w-7 ${activePage === "tasks" ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
          <span className="text-[14px] mt-0.5 font-semibold">任務</span>
        </button>

        <button
          onClick={() => {
            setActivePage("rewards");
          }}
          style={{ minWidth: "72px", minHeight: "72px" }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[16px] transition-all duration-150 cursor-pointer ${
            activePage === "rewards"
              ? "bg-[#FFF7E8] text-[#8B6B56] font-bold"
              : "text-gray-400 font-semibold hover:text-[#7C6354]"
          }`}
        >
          <Gift className={`h-7 w-7 ${activePage === "rewards" ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
          <span className="text-[14px] mt-0.5 font-semibold">禮物</span>
        </button>

        <button
          onClick={() => {
            setActivePage("more");
          }}
          style={{ minWidth: "72px", minHeight: "72px" }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[16px] transition-all duration-150 cursor-pointer ${
            ["more", "favorites", "special-periods", "members", "admin"].includes(activePage)
              ? "bg-[#FFF7E8] text-[#8B6B56] font-bold"
              : "text-gray-400 font-semibold hover:text-[#7C6354]"
          }`}
        >
          <MoreHorizontal className={`h-7 w-7 ${["more", "favorites", "special-periods", "members", "admin"].includes(activePage) ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
          <span className="text-[14px] mt-0.5 font-semibold">更多</span>
        </button>
      </div>

      <footer className="bg-white border-t border-gray-100 text-center text-[13px] font-normal text-[#9CA3AF] select-none whitespace-nowrap overflow-x-auto flex items-center justify-center" style={{ paddingTop: "24px", paddingBottom: "24px" }}>
        <span>© 2026 麻菲麻 MurphyMa All Rights Reserved.｜用愛陪伴每個家的日常</span>
      </footer>

      {isSuperAdmin && developerModeActive && currentUserProfile && (
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
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-2xl w-full relative font-sans shadow-xl flex flex-col max-h-[90vh]">
            <button
              onClick={() => setShowDevPanel(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-[#3C332D] mb-1.5 flex items-center gap-2">
              ⚙️ 系統開發者工具主控台 (Developer Console)
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-4 leading-relaxed">
              專屬於 SUPER_ADMIN 的最高權限制圖，包含視野模擬、性能監控、慢速網路、時間旅行與即時 Firestore 流。
            </p>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-[#EFEAE2] mb-5 text-xs font-bold gap-1 overflow-x-auto scrollbar-none pb-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setDevModalTab("roles")}
                className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap cursor-pointer ${
                  devModalTab === "roles"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-t-2 border-[#7C6354] font-extrabold"
                    : "text-gray-500 hover:text-[#3C332D]"
                }`}
              >
                🎭 視野與角色模擬
              </button>
              <button
                type="button"
                onClick={() => setDevModalTab("metrics")}
                className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap cursor-pointer ${
                  devModalTab === "metrics"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-t-2 border-[#7C6354] font-extrabold"
                    : "text-gray-500 hover:text-[#3C332D]"
                }`}
              >
                📊 效能指標與模擬 (Mocks & Travel)
              </button>
              <button
                type="button"
                onClick={() => setDevModalTab("logs")}
                className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap cursor-pointer ${
                  devModalTab === "logs"
                    ? "bg-[#F5EBE6] text-[#7C6354] border-t-2 border-[#7C6354] font-extrabold"
                    : "text-gray-500 hover:text-[#3C332D]"
                }`}
              >
                📝 資料庫整合日誌 ({firestoreLogs.length})
              </button>
            </div>

            {/* Tab contents wrapper */}
            <div className="flex-grow overflow-y-auto pr-1 min-h-[320px]">
              {/* TAB 1: ROLES & MEMBERS */}
              {devModalTab === "roles" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
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
                  <div className="border border-[#EFEAE2] rounded-2xl p-4 bg-[#FAF8F5] space-y-3 font-sans h-full">
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
              )}

              {/* TAB 2: METRICS, TRAVEL & SIMULATORS */}
              {devModalTab === "metrics" && (
                <div className="space-y-4 text-left animate-in fade-in duration-200">
                  {/* Master Developer Switch */}
                  <div className="flex justify-between items-center bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EFEAE2]">
                    <div>
                      <span className="font-extrabold text-gray-800 text-xs block">⚙️ 啟用開發者除錯小面板 (Developer Mode)</span>
                      <span className="text-[10px] text-gray-400 leading-relaxed block">啟用後，右下角將浮現實時『效能診斷與開發』小面板，協助更精確的性能追踪。</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={developerModeActive}
                        onChange={(e) => setDeveloperModeActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650 animate-all"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left inner col: Performance metrics */}
                    <div className="p-4 border border-[#EFEAE2] rounded-xl space-y-3 bg-[#FCFBF9]">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block border-b border-gray-100 pb-1">⚡ 效能指標監控 (Metrics)</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-white p-2 rounded-lg border border-[#EFEAE2]/60 flex flex-col justify-between">
                          <span className="text-gray-400 font-sans text-[10px]">首頁載入</span>
                          <span className="font-extrabold text-indigo-700 mt-1">
                            {loadTimeMs > 0 ? `${loadTimeMs} ms` : "計算中..."}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-[#EFEAE2]/60 flex flex-col justify-between">
                          <span className="text-gray-400 font-sans text-[10px]">即時監聽數</span>
                          <span className="font-extrabold text-[#7C6354] mt-1">
                            📡 {listenerCount} 個
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-[#EFEAE2]/60 flex flex-col justify-between">
                          <span className="text-gray-400 font-sans text-[10px]">快取命中</span>
                          <span className="font-extrabold text-pink-600 mt-1">
                            💾 {cacheRequests > 0 ? Math.round((cacheHits / cacheRequests) * 100) : 0}%
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-[#EFEAE2]/60 flex flex-col justify-between">
                          <span className="text-gray-400 font-sans text-[10px]">累積 Queries</span>
                          <span className="font-extrabold text-amber-600 mt-1">
                            ⚡ {queryCount} 次
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleResetCounters}
                          className="w-full bg-white hover:bg-gray-50 border border-[#EFEAE2] text-[#5B7283] font-bold py-1 px-2 rounded-lg text-[10px] transition cursor-pointer"
                        >
                          🔄 重置計數
                        </button>
                      </div>
                    </div>

                    {/* Right inner col: Network slowdown lag sim & Time traveling dates */}
                    <div className="p-4 border border-[#EFEAE2] rounded-xl space-y-3 bg-[#FCFBF9]">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block border-b border-gray-100 pb-1">🧪 Mocks / Network & Time</span>
                      
                      {/* Network Delay Mock */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold block">1. 網路延遲模擬 (Network Mock)</span>
                        <button
                          onClick={() => setLagSimulated(!lagSimulated)}
                          className={`w-full py-1.5 px-2 rounded-lg transition text-[10px] font-bold border cursor-pointer ${
                            lagSimulated 
                              ? "bg-rose-50 text-rose-700 border-rose-200" 
                              : "bg-white hover:bg-gray-50 text-gray-650 border-[#EFEAE2]"
                          }`}
                        >
                          🌐 {lagSimulated ? "🔴 模擬慢速網路 (1.5s 延遲已啟用)" : "🟢 正常高速網路 (無延遲)"}
                        </button>
                      </div>

                      {/* Time Travel Date simulator */}
                      <div className="space-y-1.5 pt-0.5">
                        <span className="text-[10px] text-gray-500 font-bold block">2. 時間旅行測試 (Time Travel)</span>
                        <div className="flex gap-1.5">
                          <input
                            type="date"
                            value={simulatedTodayDate || ""}
                            onChange={(e) => setSimulatedTodayDate(e.target.value)}
                            className="flex-grow bg-white border border-[#EFEAE2] rounded-lg px-2 py-1 text-gray-800 text-xs font-bold font-sans focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const today = new Date();
                              const y = today.getFullYear();
                              const m = String(today.getMonth() + 1).padStart(2, "0");
                              const d = String(today.getDate()).padStart(2, "0");
                              setSimulatedTodayDate(`${y}-${m}-${d}`);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-[#EFEAE2] hover:bg-[#E2D9CE] text-[#3C332D] rounded-lg transition cursor-pointer"
                          >
                            重設今天
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FIRESTORE LOGS */}
              {devModalTab === "logs" && (
                <div className="space-y-4 font-mono text-[11px] text-left animate-in fade-in duration-200">
                  <div className="flex justify-between items-center bg-[#FCFBF9] p-3 rounded-xl border border-[#EFEAE2]">
                    <div>
                      <span className="font-bold text-gray-800 text-xs block">📂 Firestore 實時數據庫日誌</span>
                      <span className="text-[10px] text-gray-400 font-medium">記錄與 Firebase Cloud Firestore 即時通道對接的所有主動查詢、寫入或訂閱數據流。</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFirestoreLogs([])}
                      className="p-1 px-3.5 bg-slate-100 hover:bg-slate-200 text-gray-650 rounded-lg text-[10px] font-bold border border-slate-200 transition cursor-pointer"
                    >
                      清除日誌
                    </button>
                  </div>
                  
                  <div className="bg-[#1E293B] text-slate-100 p-4 rounded-xl space-y-1.5 h-[2700px] max-h-[250px] overflow-y-auto scrollbar-thin">
                    {!firestoreLogs || firestoreLogs.length === 0 ? (
                      <span className="text-[10.5px] text-slate-400 block text-center py-12 font-sans font-medium">
                        尚無 API 數據流操作紀錄。
                      </span>
                    ) : (
                      firestoreLogs.map((log) => (
                        <div key={log.id} className="text-[10.5px] border-b border-slate-800 pb-1.5 flex flex-col gap-0.5 whitespace-pre-wrap leading-relaxed">
                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span>{log.time}</span>
                            <span className={`px-1 rounded uppercase text-[8px] font-extrabold ${
                              log.status === "success" 
                                ? "bg-emerald-950/65 text-emerald-300 border border-emerald-800" 
                                : "bg-rose-950/65 text-rose-300 border border-rose-800"
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-100">
                            <span className="text-amber-400 font-bold">[{String(log.type).toUpperCase()}]</span> {log.path}
                          </div>
                          {log.details && (
                            <div className="text-[9.5px] text-slate-400 font-sans italic pt-0.5">{log.details}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions footer */}
            <div className="flex justify-between items-center pt-5 mt-5 border-t border-[#F7F3EB] shrink-0">
              <span className="text-[10.5px] text-gray-400 font-bold">
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

      {/* Identity Detail Modal Popover */}
      {showIdentityModal && effectiveUserProfile && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-md w-full relative font-sans shadow-xl text-left">
            <button
              onClick={() => setShowIdentityModal(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-black text-[#2D2926] mb-4 flex items-center gap-2 border-b border-[#FAF6EE] pb-2">
              👤 目前身份資訊 (Identity Spec)
            </h3>

            <div className="space-y-4 text-xs font-sans">
              <div className="space-y-2.5">
                <div className="bg-[#FAF9F5]/80 p-3 rounded-xl border border-[#FAF6EE] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-500">Email:</span>
                    <span className="font-extrabold text-gray-800">{user?.email || "無"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-500">System Role:</span>
                    <span className="font-extrabold text-[#7C6354] bg-[#F5EBE6] px-2 py-0.5 rounded text-[10px]">
                      {isSuperAdmin ? "SUPER_ADMIN" : "USER"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-500">Family Role:</span>
                    <span className="font-extrabold text-[#385170] bg-[#ECEFF4] px-2 py-0.5 rounded text-[10px]">
                      {(effectiveUserProfile.role || "MEMBER").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-500">Family ID:</span>
                    <span className="font-extrabold text-[#4A6076] font-mono select-all">
                      {effectiveUserProfile.familyId || "無"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-500">Owner Status (Owner):</span>
                    <span className={`font-extrabold px-2 py-0.5 rounded text-[10px] ${
                      effectiveUserProfile.role === UserRole.OWNER 
                        ? "text-emerald-700 bg-emerald-50" 
                        : "text-gray-400 bg-gray-50"
                    }`}>
                      {effectiveUserProfile.role === UserRole.OWNER ? "true" : "false"}
                    </span>
                  </div>
                </div>

                <div className="border border-amber-100 bg-amber-50/10 p-3.5 rounded-xl space-y-2">
                  <h4 className="font-bold text-[#8C6D58] text-[11px] flex items-center gap-1.5 pb-1 border-b border-[#F5EBE6]">
                    🎯 目前所有權限 (Currently Held Permissions)
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {[
                      {
                        key: "canManageFamily",
                        label: "家庭設定/模式管理",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageFamily || isSuperAdmin
                      },
                      {
                        key: "canManageMembers",
                        label: "成員管理與邀請碼產出",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageMembers || isSuperAdmin
                      },
                      {
                        key: "canManageRoles",
                        label: "權限管理與角色指派",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageRoles || isSuperAdmin
                      },
                      {
                        key: "canManageInvites",
                        label: "成員邀請管理",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageInvites || isSuperAdmin
                      },
                      {
                        key: "canManageTasks",
                        label: "新增與指派/審核任務",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageTasks || isSuperAdmin
                      },
                      {
                        key: "canManageEvents",
                        label: "新增修刪日曆行程",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageEvents || isSuperAdmin
                      },
                      {
                        key: "canManageAnnouncements",
                        label: "發佈與修改公告",
                        allowed: getPermissionsByRole(effectiveUserProfile.role).canManageAnnouncements || isSuperAdmin
                      }
                    ].map((p) => (
                      <div key={p.key} className="flex justify-between items-center py-0.5">
                        <span className="font-mono text-[10px] text-gray-500">{p.key}</span>
                        <span className={`text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 shrink-0 ${
                          p.allowed ? "text-emerald-600" : "text-gray-300"
                        }`}>
                          {p.allowed ? "✓ 有權限" : "✗ 無權限"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-[#FAF6EE]">
              <button
                type="button"
                onClick={() => setShowIdentityModal(false)}
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-xl transition cursor-pointer"
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
