import React, { useState, useMemo, useEffect } from "react";
import { Reward, RewardStatus, UserProfile, UserRole, Redemption } from "../types";
import { Sparkles, Plus, Gift, Trash2, X, ShoppingBag, Check, Ban, Clock, Edit } from "lucide-react";
import toast from "react-hot-toast";
import { canManageFamily } from "../utils/permissionUtils";

interface RewardCenterProps {
  currentUser: UserProfile;
  rewards: Reward[];
  redemptions: Redemption[];
  familyMembers?: UserProfile[]; // Add familyMembers for choosing kids
  starTransactions?: any[]; // Add ledger transactions list
  activeFamily?: any;
  onAddReward: (rewardData: Omit<Reward, "id" | "creatorUid" | "creatorName" | "createdAt" | "status"> & { description?: string, imageUrl?: string, note?: string, sortOrder?: number, status: RewardStatus }) => Promise<void>;
  onApproveWish: (rewardId: string) => Promise<void>;
  onRedeemReward: (reward: Reward) => Promise<void>; // creates pending redemption
  onApproveRedemption: (redemptionId: string) => Promise<void>; // parent approves & deducts stars
  onRejectRedemption: (redemptionId: string) => Promise<void>; // parent rejects
  onDeleteReward: (rewardId: string) => Promise<void>;
  onUpdateReward: (rewardId: string, updates: Partial<Reward>) => Promise<void>;
  onAdjustStars?: (targetUid: string, amount: number, reason: string, type: "increase" | "decrease") => Promise<void>; // callback to adjust stars
  
  // NEW PROPS FOR MOM ADMINISTRATIVE CAPABILITIES (媽媽管理修正模組)
  onCancelRedemption?: (redemptionId: string) => Promise<void>;
  onDeleteRedemption?: (redemptionId: string) => Promise<void>;
  onUpdateRedemption?: (redemptionId: string, updates: Partial<Redemption>) => Promise<void>;
  onDeleteTransaction?: (transactionId: string, rollbackStars: boolean) => Promise<void>;
  onUpdateTransaction?: (transactionId: string, updates: any) => Promise<void>;
  onResetUserStars?: (targetUid: string, targetStars: number) => Promise<void>;
  recentlyDeletedTransactions?: any[];
  onRestoreTransaction?: (deletedItem: any) => Promise<void>;
  onBatchDeleteTransactions?: (transactionIds: string[]) => Promise<void>;
  onClearTrashBin?: () => void;
}

export default function RewardCenter({
  currentUser,
  rewards,
  redemptions,
  familyMembers = [],
  starTransactions = [],
  activeFamily,
  onAddReward,
  onApproveWish,
  onRedeemReward,
  onApproveRedemption,
  onRejectRedemption,
  onDeleteReward,
  onUpdateReward,
  onAdjustStars,
  onCancelRedemption,
  onDeleteRedemption,
  onUpdateRedemption,
  onDeleteTransaction,
  onUpdateTransaction,
  onResetUserStars,
  recentlyDeletedTransactions = [],
  onRestoreTransaction,
  onBatchDeleteTransactions,
  onClearTrashBin,
}: RewardCenterProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [rewardTitle, setRewardTitle] = useState("");
  const [starsCost, setStarsCost] = useState<number>(15);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Star Adjustment Center States
  const [adjustType, setAdjustType] = useState<"increase" | "decrease" | null>(null);
  const [selectedKidUid, setSelectedKidUid] = useState<string>("");
  const [adjustStarsAmount, setAdjustStarsAmount] = useState<number>(1);
  const [adjustReasonText, setAdjustReasonText] = useState<string>("");

  // Target Status Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'paused' | 'archived'>('all');

  // Editing state for Shop Items
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStarsCost, setEditStarsCost] = useState<number>(15);
  const [editDescription, setEditDescription] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCreatorName, setEditCreatorName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<RewardStatus>(RewardStatus.AVAILABLE);

  // --- NEW: SELECTED CHILD TRANSITION LOGIC FOR REAL-TIME DISPLAY ---
  const kidsOfFamily = useMemo(() => {
    return (familyMembers || []).filter(m => (m.role as string) === UserRole.KID || (m.role as string) === UserRole.CHILD);
  }, [familyMembers]);

  const [selectedChildUid, setSelectedChildUid] = useState<string>("");

  // Initialize focused kid
  useEffect(() => {
    if (!selectedChildUid && kidsOfFamily.length > 0) {
      const isKid = (currentUser.role as string) === UserRole.KID || (currentUser.role as string) === UserRole.CHILD;
      const matchingKid = isKid ? kidsOfFamily.find(k => k.uid === currentUser.uid) : null;
      setSelectedChildUid(matchingKid?.uid || kidsOfFamily[0].uid);
    }
  }, [kidsOfFamily, currentUser, selectedChildUid]);

  const selectedKidObj = useMemo(() => {
    return kidsOfFamily.find(k => k.uid === selectedChildUid) || ((currentUser.role as string) === UserRole.KID ? currentUser : kidsOfFamily[0] || currentUser);
  }, [kidsOfFamily, selectedChildUid, currentUser]);

  const currentStars = selectedKidObj?.stars || 0;

  // List of redemptions
  const pendingRedemptions = useMemo(() => {
    return redemptions.filter((red) => red.status === "pending");
  }, [redemptions]);

  const approvedRedemptions = useMemo(() => {
    return redemptions.filter((red) => red.status === "approved");
  }, [redemptions]);

  // Compute pending allocations cost for focused kid
  const currentKidPendingCost = useMemo(() => {
    if (!selectedKidObj) return 0;
    return pendingRedemptions
      .filter(r => r.childUid === selectedKidObj.uid)
      .reduce((sum, item) => sum + item.starsRequired, 0);
  }, [pendingRedemptions, selectedKidObj]);

  // --- NEW: MOM ADMINISTRATIVE CONTROL MODE ---
  const isParent = canManageFamily(currentUser, activeFamily);
  const [momAdminMode, setMomAdminMode] = useState<boolean>(false);

  // Correction variables
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTxAmount, setEditTxAmount] = useState<number>(0);
  const [editTxReason, setEditTxReason] = useState<string>( "");
  const [editTxDate, setEditTxDate] = useState<string>("");

  const [editingRedemptionObj, setEditingRedemptionObj] = useState<any>(null);
  const [editRedTitle, setEditRedTitle] = useState<string>("");
  const [editRedStars, setEditRedStars] = useState<number>(0);
  const [editRedChildName, setEditRedChildName] = useState<string>("");
  const [editRedStatus, setEditRedStatus] = useState<string>("approved");

  const [showResetStarsForm, setShowResetStarsForm] = useState<boolean>(false);
  const [resetStarsValue, setResetStarsValue] = useState<number>(0);

  // Custom modal/dialog confirmation states for deleting gifts & clearing trash bin to bypass iframe restrictions
  const [showClearTrashConfirm, setShowClearTrashConfirm] = useState<boolean>(false);
  const [pendingDeleteRewardId, setPendingDeleteRewardId] = useState<string | null>(null);
  const [pendingDeleteRewardTitle, setPendingDeleteRewardTitle] = useState<string | null>(null);

  const handleClearTrashBinClick = () => {
    console.log("開始清空已刪除紀錄");
    if (!isParent) {
      toast.error("❌ 只有家庭管理者可清空回收桶");
      return;
    }
    setShowClearTrashConfirm(true);
  };

  const handleClearTrashBinConfirm = () => {
    if (!isParent) {
      toast.error("❌ 只有家庭管理者可清空回收桶");
      setShowClearTrashConfirm(false);
      return;
    }
    if (onClearTrashBin) {
      onClearTrashBin();
    }
    setShowClearTrashConfirm(false);
    toast.success("✅ 已永久清除所有已刪除對帳紀錄！");
  };

  const handleDeleteRewardClick = (item: Reward) => {
    console.log("刪除禮物", item.id);
    const role = (currentUser?.role as any) || "";
    const familyRole = (activeFamily as any)?.role || "";
    const isAdmin = role === "admin" || role === "Parent" || isParent;
    const isOwner = role === "Owner" || role === (UserRole.OWNER as any);
    console.log({
      role,
      familyRole,
      isAdmin,
      isOwner
    });

    if (!isParent) {
      toast.error("❌ 只有家庭管理者可刪除此禮物");
      return;
    }

    setPendingDeleteRewardId(item.id);
    setPendingDeleteRewardTitle(item.title);
  };

  const handleDeleteRewardConfirm = async () => {
    if (!pendingDeleteRewardId) return;
    try {
      if (!isParent) {
        toast.error("❌ 只有家庭管理者可刪除此禮物");
        setPendingDeleteRewardId(null);
        setPendingDeleteRewardTitle(null);
        return;
      }
      await onDeleteReward(pendingDeleteRewardId);
    } catch (err: any) {
      toast.error(`❌ 刪除禮物失敗: ${err.message}`);
    } finally {
      setPendingDeleteRewardId(null);
      setPendingDeleteRewardTitle(null);
    }
  };

  // Filter rewards based on role and statusFilter
  const filteredStoreItems = useMemo(() => {
    const rawItems = rewards.filter((r) => {
      if (isParent) {
        return r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.PAUSED || r.status === RewardStatus.ARCHIVED;
      } else {
        return r.status === RewardStatus.AVAILABLE;
      }
    });

    let items = rawItems;
    if (isParent) {
      if (statusFilter === "available") {
        items = rawItems.filter(r => r.status === RewardStatus.AVAILABLE);
      } else if (statusFilter === "paused") {
        items = rawItems.filter(r => r.status === RewardStatus.PAUSED);
      } else if (statusFilter === "archived") {
        items = rawItems.filter(r => r.status === RewardStatus.ARCHIVED);
      }
    }

    return [...items].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 9999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 9999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [rewards, isParent, statusFilter]);

  const wishListItems = useMemo(() => {
    return rewards.filter((r) => r.status === RewardStatus.WISHED);
  }, [rewards]);

  // Filter transactions based on selection
  const filteredTransactions = useMemo(() => {
    if (!selectedChildUid) return starTransactions;
    return starTransactions.filter(tx => tx.childUid === selectedChildUid);
  }, [starTransactions, selectedChildUid]);

  const handleOpenAdjustModal = (type: "increase" | "decrease") => {
    setAdjustType(type);
    const kids = kidsOfFamily;
    if (kids.length > 0) {
      // Default to focused child
      const matchesSelected = kids.find(k => k.uid === selectedChildUid);
      setSelectedKidUid(matchesSelected?.uid || kids[0].uid);
    } else {
      setSelectedKidUid("");
    }
    setAdjustStarsAmount(1);
    setAdjustReasonText("");
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKidUid) {
      alert("請選擇調整對象！");
      return;
    }
    if (adjustStarsAmount <= 0) {
      alert("請填寫大於 0 的星星點數喔！");
      return;
    }
    if (!adjustReasonText.trim()) {
      alert("請填寫點數調整原因！");
      return;
    }
    
    if (onAdjustStars && adjustType) {
      try {
        await onAdjustStars(selectedKidUid, adjustStarsAmount, adjustReasonText.trim(), adjustType);
        setAdjustType(null); // Close modal
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim() || starsCost <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddReward({
        familyId: currentUser.familyId || "",
        title: rewardTitle.trim(),
        starsCost,
        stock: 999999,
        status: isParent ? RewardStatus.AVAILABLE : RewardStatus.WISHED,
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        note: "",
        sortOrder: 10,
      });
      setRewardTitle("");
      setStarsCost(15);
      setDescription("");
      setImageUrl("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (item: Reward) => {
    setEditingReward(item);
    setEditTitle(item.title);
    setEditStarsCost(item.starsCost);
    setEditDescription(item.description || "");
    setEditNote(item.note || "");
    setEditCreatorName(item.creatorName || "");
    setEditSortOrder(item.sortOrder !== undefined ? item.sortOrder : 10);
    setEditStatus(item.status);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward) return;
    setIsSubmitting(true);
    try {
      await onUpdateReward(editingReward.id, {
        title: editTitle.trim(),
        starsCost: editStarsCost,
        description: editDescription.trim(),
        note: editNote.trim(),
        creatorName: editCreatorName.trim(),
        sortOrder: editSortOrder,
        status: editStatus,
      });
      setEditingReward(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedeemClick = async (item: Reward) => {
    const isKid = (currentUser.role as string) === UserRole.KID || (currentUser.role as string) === UserRole.CHILD;
    if (!isKid) {
      alert("只有小朋友才可以進行禮物兌換唷！🌟");
      return;
    }
    const myStars = currentUser.stars || 0;
    if (myStars < item.starsCost) {
      alert("作戰星數不足唷！快去通關每日指派任務獲取星星吧！💪");
      return;
    }
    
    const hasPending = redemptions.some(r => r.rewardId === item.id && r.childUid === currentUser.uid && r.status === "pending");
    if (hasPending) {
      alert("您已經有此禮物的兌換申請在審核中了，請等待爸媽同意唷！❤️");
      return;
    }

    if (confirm(`確定要向爸媽送出兌換「${item.title}」（需要 ${item.starsCost} 顆星星）的申請嗎？`)) {
      try {
        await onRedeemReward(item);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Submit hand corrections
  const handleSaveTransactionCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    try {
      if (onUpdateTransaction) {
        // Compose date seconds if possible
        const parsedDate = new Date(editTxDate);
        const updates: any = {
          amount: editTxAmount,
          reason: editTxReason.trim(),
        };
        if (!isNaN(parsedDate.getTime())) {
          updates.createdAt = parsedDate;
        }
        await onUpdateTransaction(editingTransaction.id, updates);
      }
      setEditingTransaction(null);
    } catch(err) {
      console.error(err);
    }
  };

  const handleSaveRedemptionCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRedemptionObj) return;
    try {
      if (onUpdateRedemption) {
        await onUpdateRedemption(editingRedemptionObj.id, {
          rewardTitle: editRedTitle.trim(),
          starsRequired: editRedStars,
          childName: editRedChildName.trim(),
          status: editRedStatus as any,
        });
      }
      setEditingRedemptionObj(null);
    } catch(err) {
      console.error(err);
    }
  };

  const handleResetStarsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKidObj) return;
    try {
      if (onResetUserStars) {
        await onResetUserStars(selectedKidObj.uid, resetStarsValue);
      }
      setShowResetStarsForm(false);
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div id="reward-center-module" className="bg-[#FFFDF8] rounded-2xl md:rounded-[24px] border border-[#EFEAE2] p-4 md:p-6 lg:p-8 md:soft-journal-shadow space-y-5 md:space-y-6">
      
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-[#F7F3EB] pb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 md:h-11 md:w-11 bg-pink-50 text-[#EAA59E] rounded-xl border border-pink-100 flex items-center justify-center shrink-0">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base md:text-xl font-extrabold text-[#3C332D]">願望與禮物中心</h2>
            <p className="hidden md:block text-xs text-gray-400 mt-0.5 font-medium">累計星星、兌換心願大獎！</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] px-4 py-2.5 rounded-full transition cursor-pointer shadow-xs max-h-[38px] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>{isParent ? "新增商品" : "提出許願"}</span>
        </button>
      </div>

      {/* 👦 孩子星星小卡橫向滑動列表 (Horizontal scrolling kid cards) */}
      {kidsOfFamily.length > 0 && (
        <div className="w-full space-y-2 border-b border-[#F7F3EB] pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 bg-amber-50 px-3 py-1 rounded-full flex items-center gap-1 border border-amber-200/50">
              👦 多孩星星面板 (點擊卡片切換歷史與進度)
            </span>
            <span className="text-[10px] text-gray-400 font-bold hidden sm:inline">⬅ 支援左右橫甩滑動 ➡</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-amber-200 scrollbar-track-transparent flex-nowrap shrink-0 snap-x">
            {kidsOfFamily.map((k) => {
              const kidPendingCost = pendingRedemptions
                .filter(r => r.childUid === k.uid)
                .reduce((sum, item) => sum + item.starsRequired, 0);
              const availableStars = Math.max(0, (k.stars || 0) - kidPendingCost);
              const isSelected = selectedChildUid === k.uid;

              return (
                <div
                  key={k.uid}
                  onClick={() => setSelectedChildUid(k.uid)}
                  className={`min-w-[190px] max-w-[220px] p-3 rounded-xl border-2 transition-all cursor-pointer snap-start flex items-center gap-3 select-none shrink-0 ${
                    isSelected
                      ? "bg-[#FCFBF4] border-amber-400 shadow-xs ring-1 ring-amber-300"
                      : "bg-white border-[#EFEAE2] hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  {/* Avatar design */}
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0 font-bold ${
                    isSelected ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                  }`}>
                    {k.gender === "female" ? "👧" : "👦"}
                  </div>

                  {/* Name, Stars, Balance */}
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-extrabold text-xs text-[#3C332D] flex items-center gap-1 truncate">
                      <span>{k.displayName}</span>
                      {currentUser.uid === k.uid && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded-md font-black shrink-0">我</span>}
                    </p>
                    <p className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-0.5 truncate">
                      <span>目前星碼：</span>
                      <span className="font-mono text-amber-600 font-black shrink-0">{k.stars || 0} ⭐</span>
                    </p>
                    <p className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-0.5 truncate">
                      <span>可用餘額：</span>
                      <span className="font-mono text-emerald-600 font-black shrink-0">{availableStars} 顆</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgraded Star Balance Card */}
      <div id="stars-balance-card" className="flex flex-col font-sans bg-[#FAF8F5]/50 border border-amber-200/20 rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-7 gap-4 select-none shadow-3xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-amber-100/50 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">⭐</span>
            <h3 className="text-xs md:text-sm font-black text-amber-900 leading-none">
              {selectedKidObj?.displayName || "孩子"} 的作戰星星與餘額
            </h3>
          </div>
          
          {/* Quick Add/Deduct Buttons (Parent / Admin only) */}
          {isParent && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-quick-add-stars"
                onClick={() => handleOpenAdjustModal("increase")}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition active:scale-95"
              >
                <span>➕ 加點</span>
              </button>
              <button
                type="button"
                id="btn-quick-deduct-stars"
                onClick={() => handleOpenAdjustModal("decrease")}
                className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition active:scale-95"
              >
                <span>➖ 扣點</span>
              </button>
              
              {/* Mommy correction checkpoint toggler */}
              <label className="inline-flex items-center gap-1.5 cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={momAdminMode}
                  onChange={(e) => setMomAdminMode(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 h-3.5 w-3.5"
                />
                <span className="text-[10px] font-extrabold text-[#7C6354] bg-[#F5EBE6] px-2 py-1 rounded-md border border-[#E7DCD5]">
                  🔐 媽媽管理模式
                </span>
              </label>

              {momAdminMode && (
                <button
                  type="button"
                  onClick={() => {
                    setResetStarsValue(currentStars);
                    setShowResetStarsForm(true);
                  }}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-[10px] px-2.5 py-1 rounded border border-amber-300 cursor-pointer transition"
                >
                  📦 歸零/重置
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Big Number Section (Left column, width = 5) */}
          <div className="md:col-span-4 bg-white p-5 rounded-2xl border border-amber-100/75 flex flex-col items-center justify-center text-center relative shadow-3xs">
            {/* Pulsing Star Accent Row */}
            <div className="flex gap-1.5 mb-2 text-md">
              <span className="animate-pulse">⭐</span>
              <span className="animate-pulse text-amber-400">⭐</span>
              <span className="animate-pulse">⭐</span>
            </div>
            
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{selectedKidObj?.displayName || "小孩"} 目前星星</p>
            <div className="text-5xl md:text-6xl font-sans font-black text-amber-500 font-mono tracking-tight my-1.5">
              {currentStars}
            </div>
            
            <div className="mt-1 text-[11px] font-bold text-gray-500 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/30">
              <span>可用餘額：</span>
              <span className="font-mono text-emerald-600 font-extrabold">
                {Math.max(0, currentStars - currentKidPendingCost)} ★
              </span>
            </div>
            {currentKidPendingCost > 0 && (
              <span className="text-[9px] font-black text-rose-500 mt-1">
                （扣除待核准：{currentKidPendingCost} 顆星）
              </span>
            )}
          </div>

          {/* Goal Motivational Progress Grid (Right column, width = 8) */}
          <div className="md:col-span-8 bg-white p-5 rounded-2xl border border-amber-100 flex flex-col justify-between shadow-3xs">
            <div>
              <h4 className="text-xs font-black text-amber-900 mb-2 flex items-center gap-1">
                <span>🎯</span> 距離距離最近禮物目標進度
              </h4>
              
              {/* Calculate dynamic distances to next rewards */}
              {(() => {
                const availableGifts = (rewards || []).filter(r => r.status === "available" || r.status === "wished");
                
                const lockedGifts = availableGifts
                  .filter(r => r.starsCost > currentStars)
                  .map(r => ({
                    ...r,
                    diff: r.starsCost - currentStars
                  }))
                  .sort((a, b) => a.diff - b.diff);
                
                if (lockedGifts.length === 0) {
                  return (
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/30 p-4 rounded-xl text-center">
                      🎉 太棒了！家庭禮物中心的全部目標你都達成了，快向爸媽兌領吧！
                    </div>
                  );
                }
                
                const closest = lockedGifts[0];
                const closestPct = Math.min(100, Math.round((currentStars / closest.starsCost) * 100));
                
                return (
                  <div className="space-y-3">
                    {/* Nearest Gift Header Indicator */}
                    <div className="bg-amber-50/20 border border-amber-100 p-2.5 rounded-lg flex items-center justify-between">
                      <span className="text-[10px] font-black text-amber-950 truncate">近期目標：🎁 {closest.title}</span>
                      <span className="text-xs font-black text-rose-600 shrink-0">
                        還差 <span className="text-sm font-mono font-black">{closest.diff}</span> 顆星 ({closestPct}%)
                      </span>
                    </div>
                    
                    {/* Progress slider bar mock */}
                    <div className="w-full bg-gray-150 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${closestPct}%` }}></div>
                    </div>
                    
                    {/* Other Lock Target List */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">我的夢想願望里程碑：</p>
                      {lockedGifts.slice(0, 2).map((gift) => (
                        <div key={gift.id} className="flex justify-between items-center text-[11px] font-bold py-1 border-b border-gray-100 last:border-0 last:pb-0">
                          <span className="text-gray-700 flex items-center gap-1 truncate max-w-[70%]">
                            <span>🎁</span> {gift.title}
                          </span>
                          <span className="text-gray-400 font-extrabold flex items-center gap-1 shrink-0 font-mono text-[10px]">
                            需要: {gift.starsCost} ★ | 還差 <span className="text-rose-500 font-bold">{gift.diff}</span> 顆
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 🧾 星星異動流水帳 (Star Points ledger entry feed) */}
      <div id="star-transactions-ledger" className="bg-[#FFFDF8] rounded-2xl border border-[#EFEAE2] p-4 md:p-5 shadow-3xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 animate-in fade-in">
            <span className="text-lg">🧾</span>
            <h3 className="text-xs md:text-sm font-black text-amber-900">
              {selectedKidObj?.displayName || "孩子"} 專屬星星異動紀錄
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isParent && momAdminMode && filteredTransactions.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`⚠️【重要警告】您即將「直接批次刪除」目前顯示的全部共 ${filteredTransactions.length} 筆星星流水帳對帳明細！\n\n👉 這將在資料庫中徹底清除這些紀錄（不會同步扣回小孩目前現有的星星點數）。\n\n您確認要執行此批次清除嗎？`)) {
                    if (onBatchDeleteTransactions) {
                      await onBatchDeleteTransactions(filteredTransactions.map(tx => tx.id));
                    }
                  }
                }}
                className="text-[9.5px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full hover:bg-rose-100 transition cursor-pointer active:scale-95"
              >
                💥 批次刪除全部
              </button>
            )}
            <span className="text-[10px] font-bold text-gray-400">目前累計：{filteredTransactions.length} 筆細項</span>
          </div>
        </div>

        {filteredTransactions && filteredTransactions.length > 0 ? (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {filteredTransactions.map((tx, idx) => {
              let dateStr = "2026/06/10";
              if (tx.createdAt) {
                const d = tx.createdAt.seconds ? new Date(tx.createdAt.seconds * 1000) : (tx.createdAt instanceof Date ? tx.createdAt : new Date());
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const r = String(d.getDate()).padStart(2, "0");
                dateStr = `${y}/${m}/${r}`;
              }
              
              const isPlus = tx.amount > 0 || tx.type === "increase";
              const absAmount = Math.abs(tx.amount);
              
              return (
                <div key={tx.id || idx} className="flex flex-col text-xs font-sans border-b border-[#F7F3EB] pb-2.5 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 font-bold tracking-wider">{dateStr}</span>
                    <span className={`font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 ${isPlus ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-rose-700 bg-rose-50 border border-rose-100"}`}>
                      {isPlus ? `➕ +${absAmount}星` : `➖ -${absAmount}星`}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5 pl-1 flex-1">
                    <p className="text-gray-700 font-bold text-[11.5px]">
                      <span className="text-gray-400 font-extrabold mr-1">[事由]</span>
                      {tx.reason}
                    </p>
                    <p className="text-gray-400 text-[10px] font-bold">
                      <span className="text-gray-450 mr-1">[主辦]</span>
                      {tx.operatorName} | <span className="text-gray-400">對象：{tx.childName || "未定"}</span>
                    </p>
                  </div>

                  {/* Corrections on transactions if momAdminMode is active */}
                  {isParent && momAdminMode && (
                    <div className="flex items-center gap-2 border-t border-dashed border-amber-100 pt-2 mt-2 select-none">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTransaction(tx);
                          setEditTxAmount(tx.amount || 0);
                          setEditTxReason(tx.reason || "");
                          let curr = "2026-06-10";
                          if (tx.createdAt) {
                            const d = tx.createdAt.seconds ? new Date(tx.createdAt.seconds * 1000) : (tx.createdAt instanceof Date ? tx.createdAt : new Date());
                            curr = d.toISOString().split("T")[0];
                          }
                          setEditTxDate(curr);
                        }}
                        className="text-[9.5px] font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded hover:bg-sky-100 border border-sky-300 transition shrink-0 active:scale-95 cursor-pointer"
                      >
                        ✏️ 修正內容
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const rollback = confirm(
                            `【媽媽強制控制】即將完全刪除「${tx.reason}」此星星紀錄！\n\n是否要同步【回滾/扣減孩子帳戶中的星星】？\n\n👉 [確定]: 連同小孩星星點數同步扣回還原（星星數變動）\n👉 [取消]: 僅直接刪除此筆對帳單紀錄（小孩星星保持不變）`
                          );
                          if (onDeleteTransaction) {
                            onDeleteTransaction(tx.id, rollback);
                          }
                        }}
                        className="text-[9.5px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded hover:bg-rose-105 border border-rose-300 transition shrink-0 active:scale-95 cursor-pointer"
                      >
                        🗑️ 徹底刪除紀錄
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-400 font-bold italic bg-white border border-dashed border-gray-150 rounded-xl">
            此寶貝目前還沒有星星異動歷史對帳紀錄喔！🌱
          </div>
        )}

        {/* --- NEW SECTION: 🗑️ Recently Deleted Records (Trash bin) --- */}
        {isParent && momAdminMode && recentlyDeletedTransactions && recentlyDeletedTransactions.length > 0 && (
          <div className="mt-4 p-4 bg-[#F9F7F5] border border-dashed border-[#E3DCD5] rounded-xl space-y-2.5">
            <div className="flex justify-between items-center pb-1.5 border-b border-[#EBE3DC]">
              <span className="text-[11px] font-black text-[#5C4D43] flex items-center gap-1">
                🗑️ 近期被刪除的星星紀錄（可點擊立刻還原 ↩️）
              </span>
              <button
                type="button"
                onClick={handleClearTrashBinClick}
                className="text-[9.5px] font-black text-[#5C4D43] hover:text-[#CA4D3B] transition px-2 py-0.5 rounded bg-white hover:bg-rose-50 border border-[#E3DCD5] hover:border-rose-200 cursor-pointer shadow-3xs"
              >
                清空列表
              </button>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {recentlyDeletedTransactions.map((item: any, i: number) => {
                const tx = item.transaction;
                const isPlus = tx.amount > 0 || tx.type === "increase";
                const absAmount = Math.abs(tx.amount);
                return (
                  <div key={tx.id || i} className="flex justify-between items-center text-xs py-2 px-3 bg-white rounded-lg border border-[#EDE8E0] shadow-3xs">
                    <div className="truncate pr-2 space-y-0.5 max-w-[70%]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-gray-800 shrink-0">{tx.childName || "孩子"}:</span>
                        <span className="text-gray-500 font-medium truncate">{tx.reason}</span>
                      </div>
                      <div className="text-[9.5px] text-gray-400 font-bold">
                        {isPlus ? `原為 +${absAmount} 星` : `原為 -${absAmount} 星`} {item.rollbackStars ? "(已同步加扣回帳戶)" : "(未變動帳戶)"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (onRestoreTransaction) {
                          await onRestoreTransaction(item);
                        }
                      }}
                      className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md hover:bg-emerald-100 transition cursor-pointer active:scale-95"
                    >
                      ↩️ 還原
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Parent Approval Notification Box */}
      {isParent && pendingRedemptions.length > 0 && (
        <div className="bg-[#FFFBF2] border-2 border-dashed border-[#EDD091] rounded-2xl p-5 space-y-3.5">
          <h3 className="text-md font-extrabold text-[#3C332D] flex items-center gap-1.5">
            🔔 待核發之孩子兌禮申請 ({pendingRedemptions.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRedemptions.map((red) => (
              <div
                key={red.id}
                className="p-4 bg-white rounded-xl border border-[#FFF59D] flex flex-col justify-between shadow-3xs"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      👧 申請寶貝: {red.childName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-0.5">
                      <Clock className="h-3 w-3 animate-pulse" /> 家長待審中
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-[#3C332D] mt-2.5 break-all">
                    🎁 {red.rewardTitle}
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    扣除星數：<span className="text-[#EAA59E] font-black">{red.starsRequired} 🌟</span>
                  </p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => onApproveRedemption(red.id)}
                    className="flex-1 py-1.5 bg-[#9BB096] hover:bg-[#8CA287] text-white font-extrabold text-xs rounded-lg cursor-pointer transition flex items-center justify-center gap-1 shadow-3xs active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" /> 核發禮物
                  </button>
                  <button
                    onClick={() => onRejectRedemption(red.id)}
                    className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-500 font-bold text-xs rounded-lg cursor-pointer transition active:scale-95 border border-rose-200/50"
                  >
                    駁回
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Store Rewards vs Wishlist Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Available Reward Store - Takes 2 Columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
            <h3 className="text-md font-extrabold text-[#3C332D] tracking-wide flex items-center gap-1.5 border-l-4 border-[#5B7283] pl-2">
               現貨大禮上架中心
            </h3>

            {/* Parent only Status Filter */}
            {isParent && (
              <div className="flex flex-wrap gap-1 bg-[#F2EDE5]/40 border border-[#EFEAE2] p-0.5 rounded-lg text-[10px] font-black select-none">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2 py-1 rounded transition ${statusFilter === "all" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  全部
                </button>
                <button
                  onClick={() => setStatusFilter("available")}
                  className={`px-2 py-1 rounded transition ${statusFilter === "available" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  上架中
                </button>
                <button
                  onClick={() => setStatusFilter("paused")}
                  className={`px-2 py-1 rounded transition ${statusFilter === "paused" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  暫停中
                </button>
                <button
                  onClick={() => setStatusFilter("archived")}
                  className={`px-2 py-1 rounded transition ${statusFilter === "archived" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  已下架
                </button>
              </div>
            )}
          </div>

          {filteredStoreItems.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[#EFEAE2] rounded-2xl bg-white p-4">
              <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-450 font-bold">目前看來沒有此分類的商品項目喔</p>
              {isParent ? (
                <p className="text-[10.5px] text-gray-400 mt-0.5">請點選右上角按鈕為孩子寫下第一個精美禮品目標吧！</p>
              ) : (
                <p className="text-[10.5px] text-gray-400 mt-0.5">點選右上方按鈕跟爸媽「點餐許願」，同意後就上架囉！</p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop view (grid of 2-columns) */}
              <div className="hidden md:grid grid-cols-2 gap-5">
                {filteredStoreItems.map((item) => {
                  const kidStars = selectedKidObj?.stars || 0;
                  const pct = Math.min(100, Math.round((kidStars / item.starsCost) * 100));
                  const deficit = Math.max(0, item.starsCost - kidStars);
                  const isKid = (currentUser.role as string) === UserRole.KID || (currentUser.role as string) === UserRole.CHILD;
                  const canAfford = isKid && kidStars >= item.starsCost;
                  const isRequested = redemptions.some(r => r.rewardId === item.id && r.childUid === currentUser.uid && r.status === "pending");

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #E9E2DB",
                        borderRadius: "16px",
                        background: item.status === RewardStatus.PAUSED ? "#FCFBF3" : item.status === RewardStatus.ARCHIVED ? "#F2F2F2" : "#FFFFFF",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
                      }}
                      className={`p-4 relative flex flex-col justify-between min-h-[210px] hover:-translate-y-0.5 transition ${item.status === RewardStatus.ARCHIVED ? "opacity-75" : ""}`}
                    >
                      {/* Parent controls */}
                      {isParent && (
                        <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="text-gray-400 hover:text-sky-600 p-1 bg-gray-50 border border-gray-200 rounded cursor-pointer transition shadow-3xs"
                            title="編輯"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteRewardClick(item)}
                            className="text-gray-400 hover:text-red-500 p-1 bg-gray-50 border border-gray-200 rounded cursor-pointer transition shadow-3xs"
                            title="刪除"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1 leading-none">
                          {item.status === RewardStatus.PAUSED ? (
                            <span className="text-[8px] font-black bg-amber-50 text-amber-800 border border-amber-250 rounded px-1.5 py-0.5">
                              ⏸ 暫停中
                            </span>
                          ) : item.status === RewardStatus.ARCHIVED ? (
                            <span className="text-[8px] font-black bg-gray-100 text-gray-650 border border-gray-250 rounded px-1.5 py-0.5">
                              📦 已下架
                            </span>
                          ) : (
                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5">
                              🟢 上架中
                            </span>
                          )}
                          {item.sortOrder !== undefined && (
                            <span className="text-[8px] font-bold bg-sky-50 text-sky-800 border border-sky-100 rounded px-1.5 py-0.5">
                              排序: {item.sortOrder}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-extrabold text-[#2C231E] text-base leading-snug break-all tracking-tight flex items-center gap-1.5">
                            🧸 {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-[11px] text-gray-500 font-medium mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {item.note && (
                          <div className="bg-[#FAF9F5] border-l-2 border-amber-405 p-2 rounded-r-lg text-[10px] font-bold text-gray-650">
                            <span className="text-amber-900 block text-[9px] uppercase font-black">爸媽備註 / 額外任務規定：</span>
                            <p className="italic mt-0.5 whitespace-pre-wrap">{item.note}</p>
                          </div>
                        )}

                        {/* Progress slider bar */}
                        <div className="space-y-1.5 border-t border-gray-100/70 pt-3 font-sans select-none">
                          <div className="flex justify-between items-center text-[10px] font-bold text-gray-450">
                            <span className="text-amber-800 bg-[#FFF5DC] border border-[#F5DEAB] px-2.5 py-1 rounded-full font-black text-[10px] shadow-3xs flex items-center gap-1">
                              ⭐ 價格: <span className="text-amber-900 text-xs font-mono font-black">{item.starsCost}</span> 顆星
                            </span>
                            <span>
                              {deficit === 0 ? (
                                <span className="text-emerald-600 font-extrabold">🎉 已達標可兌換</span>
                              ) : (
                                <span>差 <span className="text-rose-500 font-black font-mono">{deficit}</span> 顆星</span>
                              )}
                            </span>
                          </div>
                          <div className="w-full bg-[#FAF5EF] border border-[#E9E2DB]/40 rounded-full h-2.5 relative overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${deficit === 0 ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-[#FBCFE8] to-[#F472B6]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 pt-2 border-t border-[#F7F3EB] flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 font-bold">
                          建立者：{item.creatorName || "全家官網"}
                        </span>

                        {isKid && item.status === RewardStatus.AVAILABLE && (
                          <button
                            onClick={() => handleRedeemClick(item)}
                            disabled={isRequested}
                            className={`text-[10px] font-black px-3.5 py-1.5 rounded-full transition cursor-pointer select-none ${
                              isRequested
                                ? "bg-amber-100 text-amber-600 border border-amber-200"
                                : !canAfford
                                ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                                : "bg-[#EAA59E] hover:bg-[#df938c] text-white font-black"
                            }`}
                          >
                            {isRequested ? "審核中..." : !canAfford ? "差星" : "發送兌領"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile list view */}
              <div className="block md:hidden space-y-2">
                {filteredStoreItems.map((item) => {
                  const kidStars = selectedKidObj?.stars || 0;
                  const pct = Math.min(100, Math.round((kidStars / item.starsCost) * 100));
                  const deficit = Math.max(0, item.starsCost - kidStars);
                  const isKid = (currentUser.role as string) === UserRole.KID || (currentUser.role as string) === UserRole.CHILD;
                  const canAfford = isKid && kidStars >= item.starsCost;
                  const isRequested = redemptions.some(r => r.rewardId === item.id && r.childUid === currentUser.uid && r.status === "pending");

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #E9E2DB",
                        borderRadius: "14px",
                        background: item.status === RewardStatus.PAUSED ? "#FCFBF3" : item.status === RewardStatus.ARCHIVED ? "#F6F6F6" : "#FFFFFF"
                      }}
                      className="p-2.5 flex items-center justify-between gap-3 relative"
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="font-extrabold text-[#2C231E] text-xs leading-snug truncate flex items-center gap-1">
                            🧸 {item.title}
                          </h4>
                          <p className="text-[10px] text-[#A27B5C] mt-0.5 font-bold flex items-center gap-0.5">
                            🌟 需要：<span className="bg-[#FFF5DC] border border-[#F5DEAB] px-1.5 py-0.2 rounded-full text-amber-950 font-mono font-black text-[10px]">{item.starsCost} ★</span>
                          </p>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-1.5 font-sans">
                          <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-0.5">
                            {deficit === 0 ? (
                              <span className="text-emerald-600 font-extrabold">🎉 已達標可兌換</span>
                            ) : (
                              <span>進度:{pct}% | 差 {deficit}★</span>
                            )}
                          </div>
                          <div className="w-full bg-[#FAF5EF] border border-[#E9E2DB]/40 rounded-full h-1.5 relative overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${deficit === 0 ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-[#FBCFE8] to-[#F472B6]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right controls */}
                      <div className="shrink-0 flex items-center gap-1 pl-2.5 border-l border-dashed border-gray-150">
                        {isParent ? (
                          <div className="flex flex-col gap-1 items-center">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="text-gray-500 hover:text-sky-600 p-1 bg-gray-50 border border-gray-200 rounded transition"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteRewardClick(item)}
                              className="text-gray-500 hover:text-red-500 p-1 bg-gray-50 border border-gray-200 rounded transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          isKid && item.status === RewardStatus.AVAILABLE && (
                            <button
                              onClick={() => handleRedeemClick(item)}
                              disabled={isRequested}
                              className={`text-[9.5px] font-black px-2.5 py-1.5 rounded-lg transition select-none ${
                                isRequested
                                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                                  : !canAfford
                                  ? "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                                  : "bg-[#EAA59E] hover:bg-[#df938c] text-white"
                              }`}
                            >
                              {isRequested ? "審理中" : !canAfford ? "差星" : "兌領"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Wishpool Column */}
        <div className="space-y-4">
          <h3 className="text-md font-extrabold text-[#3C332D] tracking-wide flex items-center gap-1.5 border-l-4 border-[#EAA59E] pl-2">
             寶貝許願池 (審核新增)
          </h3>

          {wishListItems.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-[#EFEAE2] rounded-2xl bg-white p-4">
              <Sparkles className="h-8 w-8 text-pink-300 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-gray-450 leading-relaxed font-semibold">
                目前許願池空空如也！<br />點擊右上角「提出許願」新增寶貝的大目標吧
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wishListItems.map((wish) => (
                <div
                  key={wish.id}
                  className="p-4 rounded-xl border border-gray-200 bg-white relative shadow-3xs"
                >
                  {isParent && (
                    <button
                      onClick={() => handleDeleteRewardClick(wish)}
                      className="absolute right-2 top-2 text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                      title="駁回許願"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div className="space-y-2">
                    <span className="inline-block text-[9px] font-sans font-bold bg-[#FAF8F4] text-amber-800 px-2 py-0.5 rounded-full border border-amber-200/40">
                      📍 寶貝夢想心願
                    </span>
                    <h4 className="font-extrabold text-[#3C332D] text-xs pr-6 break-all">💭 {wish.title}</h4>
                    {wish.description && (
                      <p className="text-[10.5px] text-gray-400 font-semibold line-clamp-2">
                        {wish.description}
                      </p>
                    )}
                    <span className="inline-block text-[10px] font-sans font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                      單價: {wish.starsCost} ★
                    </span>
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-[#F7F3EB] flex items-center justify-between">
                    <span className="text-[10px] text-[#A6A6A6] font-extrabold leading-none">
                      許願孩子：{wish.creatorName}
                    </span>

                    {isParent && (
                      <button
                        onClick={() => onApproveWish(wish.id)}
                        className="text-[10px] font-black text-white bg-[#EAA59E] hover:bg-[#df938c] px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition active:scale-95"
                      >
                        准予上架
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Redemption Logs */}
          <div className="pt-2 font-sans select-none">
            <h3 className="text-xs font-extrabold text-[#3C332D] mb-2 flex items-center gap-1 pl-2 border-l-4 border-emerald-500">
               🌸 幸福兌領歷史紀錄 ({approvedRedemptions.length})
            </h3>
            {approvedRedemptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic pl-2 font-semibold">目前還沒有成功核發的禮物兌換紀錄喔</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {approvedRedemptions.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-[#EAF5EA] border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-extrabold flex items-center justify-between">
                      <span>🎉 {log.rewardTitle}</span>
                      <span className="text-[9px] bg-white/70 px-1.5 rounded font-mono font-black border border-emerald-300">已兌領</span>
                    </p>
                    <p className="text-gray-500 text-[10px] font-semibold">
                      由 {log.childName} 扣除 {log.starsRequired} ★ 兌換成功
                    </p>

                    {/* Undo option under Mom Admin mode */}
                    {isParent && momAdminMode && (
                      <div className="flex items-center gap-2 border-t border-emerald-200/50 pt-2 mt-2 select-none">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`【強制倒回兌領】確定要復原 ${log.childName} 兌換【${log.rewardTitle}】的歷史紀錄，並強制恢復退還 ${log.starsRequired} 顆星星給他嗎？`)) {
                              if (onCancelRedemption) onCancelRedemption(log.id);
                            }
                          }}
                          className="text-[8.5px] font-black bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                        >
                          ↩️ 撤銷退回星星
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRedemptionObj(log);
                            setEditRedTitle(log.rewardTitle || "");
                            setEditRedStars(log.starsRequired || 0);
                            setEditRedChildName(log.childName || "");
                            setEditRedStatus(log.status || "approved");
                          }}
                          className="text-[8.5px] font-black bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                        >
                          ✏️ 修正
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`【徹底刪除】確定要徹底刪除此筆與 ${log.childName} 兌領商品之歷史紀錄嗎？（不退還星星）`)) {
                              if (onDeleteRedemption) onDeleteRedemption(log.id);
                            }
                          }}
                          className="text-[8.5px] font-black bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                        >
                          🗑️ 徹底刪
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Reward popup */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full shadow-lg relative font-sans">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-lg font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <Gift className="h-5 w-5 text-[#EAA59E]" />
              {isParent ? "新增商品獎勵" : "提出心愛許願"}
            </h3>

            <form onSubmit={handleCreateReward} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">商品名稱</label>
                <input
                  type="text"
                  required
                  placeholder={isParent ? "請輸入新增上架的實體獎勵..." : "請輸入你許願想要的禮物..."}
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">需要星星數</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={starsCost}
                  onChange={(e) => setStarsCost(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">規格說明 (說明備註)</label>
                <textarea
                  rows={2}
                  placeholder="可寫下禮包備註，例如：週末去遊樂園，或者一杯特別飲料..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none resize-none font-bold text-gray-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition disabled:opacity-50 font-black cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "上傳中..." : isParent ? "新增上架" : "送出許願"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Reward popup */}
      {editingReward && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full shadow-lg relative font-sans">
            <button
              onClick={() => setEditingReward(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-lg font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <Gift className="h-5 w-5 text-[#EAA59E]" />
              編輯獎勵商品項目 (修正)
            </h3>

            <form onSubmit={handleSaveUpdate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">獎勵商品名稱</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">需要星星單價</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editStarsCost}
                  onChange={(e) => setEditStarsCost(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">商品詳情說明</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none resize-none font-semibold text-gray-655"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">爸媽叮嚀備註</label>
                <textarea
                  rows={2}
                  placeholder="寫下規範或獎勵期限..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none resize-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">建立/簽章名</label>
                <input
                  type="text"
                  required
                  value={editCreatorName}
                  onChange={(e) => setEditCreatorName(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">排序權重 (越低排在越前面)</label>
                <input
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1">商品上架狀態</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as RewardStatus)}
                  className="w-full text-xs border border-[#EFEAE2] bg-[#FFFDF8] rounded-xl px-3 py-2.5 focus:outline-none font-bold"
                >
                  <option value={RewardStatus.AVAILABLE}>上架中 (Available)</option>
                  <option value={RewardStatus.PAUSED}>已暫停出貨 (Paused)</option>
                  <option value={RewardStatus.ARCHIVED}>已下架庫存 (Archived)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setEditingReward(null)}
                  className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "保存中..." : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Star Adjustment Center Modal */}
      {adjustType && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-md w-full shadow-lg relative font-sans">
            <button
              onClick={() => setAdjustType(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition text-lg"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-md md:text-lg font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <span>{adjustType === "increase" ? "⭐⭐ 快速加點星星 ⭐⭐" : "⚠️⚠️ 快速扣點星星 ⚠️⚠️"}</span>
            </h3>

            {kidsOfFamily.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 font-bold italic">
                ⚠️ 目前家庭成員內無「小孩 (Kid)」成員，請至成員中心新增孩子喔！
              </div>
            ) : (
              <form onSubmit={handleAdjustSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1">調整對象小孩</label>
                  <div className="grid grid-cols-2 gap-2">
                    {kidsOfFamily.map((k) => (
                      <label
                        key={k.uid}
                        className={`border-2 rounded-xl p-2.5 flex items-center gap-1.5 cursor-pointer transition select-none ${selectedKidUid === k.uid ? "bg-amber-50/20 border-amber-400" : "bg-[#FFFDF8] border-[#EFEAE2] hover:border-gray-350"}`}
                      >
                        <input
                          type="radio"
                          name="adjust-target-kid"
                          value={k.uid}
                          checked={selectedKidUid === k.uid}
                          onChange={() => setSelectedKidUid(k.uid)}
                          className="text-amber-500 focus:ring-amber-400 h-4 w-4"
                        />
                        <span className="text-xs font-black text-gray-750">{k.displayName} ({k.stars || 0}🌟)</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1">
                    {adjustType === "increase" ? "星星加點數量" : "星星扣點數量"}
                  </label>
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {adjustType === "increase" ? (
                      [1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAdjustStarsAmount(num)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${adjustStarsAmount === num ? "bg-emerald-500 text-white shadow-3xs" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
                        >
                          +{num}
                        </button>
                      ))
                    ) : (
                      [1, 2, 3, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAdjustStarsAmount(num)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${adjustStarsAmount === num ? "bg-rose-500 text-white shadow-3xs" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
                        >
                          -{num}
                        </button>
                      ))
                    )}
                  </div>

                  <input
                    type="number"
                    min={1}
                    required
                    value={adjustStarsAmount}
                    onChange={(e) => setAdjustStarsAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1 mr-1">異動原因</label>
                  <p className="text-[9px] text-gray-400 font-extrabold mb-1">快捷選擇事由：</p>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {adjustType === "increase" ? (
                      ["🍙 今天吃飯吃光光", "🛀 自己洗澡", "📚 主動閱讀書本", "🧹 幫忙整理房間", "🚗 出門表現優異"].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => setAdjustReasonText(phrase)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                        >
                          {phrase}
                        </button>
                      ))
                    ) : (
                      ["😢 沒遵守生活常規", "📱 超時遊玩手機", "⚠️ 頂嘴沒禮貌", "🚫 未完成指定約定"].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => setAdjustReasonText(phrase)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 transition cursor-pointer"
                        >
                          {phrase}
                        </button>
                      ))
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="請輸入其他異動原因..."
                    value={adjustReasonText}
                    onChange={(e) => setAdjustReasonText(e.target.value)}
                    className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                  <button
                    type="button"
                    onClick={() => setAdjustType(null)}
                    className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-xs font-black text-white rounded-full transition shadow-3xs cursor-pointer ${adjustType === "increase" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"}`}
                  >
                    {adjustType === "increase" ? "確認手動加星" : "確認手動扣星"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- NEW MODAL 4: Edit Transaction Line popup (媽媽強制修正) --- */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full shadow-lg relative font-sans">
            <button
              onClick={() => setEditingTransaction(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-md font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <span>👩‍🏫 強制修正：星星對帳單明細</span>
            </h3>

            <form onSubmit={handleSaveTransactionCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">流失/增加星星點數</label>
                <input
                  type="number"
                  required
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">異動原因</label>
                <input
                  type="text"
                  required
                  value={editTxReason}
                  onChange={(e) => setEditTxReason(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">計入日期 (YYYY/MM/DD)</label>
                <input
                  type="date"
                  required
                  value={editTxDate}
                  onChange={(e) => setEditTxDate(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition shadow-xs"
                >
                  確認強制儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NEW MODAL 5: Edit Redemption History Item popup (媽媽強制修正) --- */}
      {editingRedemptionObj && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full shadow-lg relative font-sans">
            <button
              onClick={() => setEditingRedemptionObj(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-md font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <span>👩‍🏫 強制修正：禮物兌換明細</span>
            </h3>

            <form onSubmit={handleSaveRedemptionCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">兌換大禮名稱</label>
                <input
                  type="text"
                  required
                  value={editRedTitle}
                  onChange={(e) => setEditRedTitle(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">扣減星星數量</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editRedStars}
                  onChange={(e) => setEditRedStars(parseInt(e.target.value) || 1)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">申請人展示名</label>
                <input
                  type="text"
                  required
                  value={editRedChildName}
                  onChange={(e) => setEditRedChildName(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">審定狀態</label>
                <select
                  value={editRedStatus}
                  onChange={(e) => setEditRedStatus(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] bg-[#FFFDF8] rounded-xl px-3 py-2.5 focus:outline-none font-bold"
                >
                  <option value="pending">家長待審核 (pending)</option>
                  <option value="approved">核准同意兌換 (approved)</option>
                  <option value="rejected">駁回婉拒兌換 (rejected)</option>
                  <option value="canceled">撤銷取消兌換 (canceled)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setEditingRedemptionObj(null)}
                  className="px-4 py-2 text-xs font-black text-gray-505 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition shadow-xs"
                >
                  確認強制儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NEW MODAL 6: RESET/归零 focused kid stars popup --- */}
      {showResetStarsForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full shadow-lg relative font-sans">
            <button
              onClick={() => setShowResetStarsForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-md font-black text-[#3C332D] mb-4 flex items-center gap-1.5">
              <span>📦 媽媽修正：強制設定/重設小孩星星</span>
            </h3>

            <p className="text-xs text-amber-900 bg-amber-50 rounded-lg p-3 font-semibold mb-4 leading-normal">
              ⚠️ 注意：此操作將會強制將 <b>{selectedKidObj?.displayName}</b> 的星星調整為下方輸入的值，並自動在流水帳中建立一筆說明紀錄，避免對不攏。
            </p>

            <form onSubmit={handleResetStarsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1">目標設定星星數</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={resetStarsValue}
                  onChange={(e) => setResetStarsValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-3 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setShowResetStarsForm(false)}
                  className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-full transition shadow-xs cursor-pointer"
                >
                  確認強制設定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ Clear Trash Confirmation Dialog Modal */}
      {showClearTrashConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-[#E5E1DA] rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-sm font-black text-gray-900 leading-normal">
                確定要永久清除所有已刪除紀錄嗎？
              </h3>
              <p className="text-[11px] text-rose-600 font-extrabold bg-rose-50 border border-rose-100 rounded-lg p-2.5">
                此動作無法復原。
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearTrashConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleClearTrashBinConfirm}
                className="flex-1 px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm cursor-pointer"
              >
                永久清除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎁 Delete Gift Confirmation Dialog Modal */}
      {pendingDeleteRewardId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-[#E5E1DA] rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2.5">
              <div className="mx-auto w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                <Trash2 className="h-5 w-5 text-rose-500" />
              </div>
              <h3 className="text-sm font-black text-gray-900">
                ⚠️ 確定刪除禮物？
              </h3>
              <div className="bg-[#FAF8F5] border border-gray-150 rounded-xl p-3 text-left">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase block mb-0.5">禮物名稱</span>
                <span className="text-xs font-bold text-gray-800 break-all">
                  {pendingDeleteRewardTitle}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteRewardId(null);
                  setPendingDeleteRewardTitle(null);
                }}
                className="flex-1 px-4 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteRewardConfirm}
                className="flex-1 px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
