import React, { useState, useMemo } from "react";
import { Reward, RewardStatus, UserProfile, UserRole, Redemption } from "../types";
import { Sparkles, Plus, Gift, Trash2, X, ShoppingBag, Check, Ban, Clock, Edit } from "lucide-react";

interface RewardCenterProps {
  currentUser: UserProfile;
  rewards: Reward[];
  redemptions: Redemption[];
  familyMembers?: UserProfile[]; // Add familyMembers for choosing kids
  starTransactions?: any[]; // Add ledger transactions list
  onAddReward: (rewardData: Omit<Reward, "id" | "creatorUid" | "creatorName" | "createdAt" | "status"> & { description?: string, imageUrl?: string, note?: string, sortOrder?: number, status: RewardStatus }) => Promise<void>;
  onApproveWish: (rewardId: string) => Promise<void>;
  onRedeemReward: (reward: Reward) => Promise<void>; // creates pending redemption
  onApproveRedemption: (redemptionId: string) => Promise<void>; // parent approves & deducts stars
  onRejectRedemption: (redemptionId: string) => Promise<void>; // parent rejects
  onDeleteReward: (rewardId: string) => Promise<void>;
  onUpdateReward: (rewardId: string, updates: Partial<Reward>) => Promise<void>;
  onAdjustStars?: (targetUid: string, amount: number, reason: string, type: "increase" | "decrease") => Promise<void>; // callback to adjust stars
}

export default function RewardCenter({
  currentUser,
  rewards,
  redemptions,
  familyMembers = [],
  starTransactions = [],
  onAddReward,
  onApproveWish,
  onRedeemReward,
  onApproveRedemption,
  onRejectRedemption,
  onDeleteReward,
  onUpdateReward,
  onAdjustStars,
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

  const handleOpenAdjustModal = (type: "increase" | "decrease") => {
    setAdjustType(type);
    const kids = (familyMembers || []).filter(m => m.role === UserRole.KID);
    if (kids.length > 0) {
      setSelectedKidUid(kids[0].uid);
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

  // Parent status filter: 'all' | 'available' | 'paused' | 'archived'
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'paused' | 'archived'>('all');

  // Editing state
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStarsCost, setEditStarsCost] = useState<number>(15);
  const [editDescription, setEditDescription] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCreatorName, setEditCreatorName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<RewardStatus>(RewardStatus.AVAILABLE);

  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;

  // Filter rewards based on role and statusFilter
  const filteredStoreItems = useMemo(() => {
    // Basic role filter: kids only see available items, parents see all manageable items
    const rawItems = rewards.filter((r) => {
      if (isParent) {
        return r.status === RewardStatus.AVAILABLE || r.status === RewardStatus.PAUSED || r.status === RewardStatus.ARCHIVED;
      } else {
        return r.status === RewardStatus.AVAILABLE;
      }
    });

    // Parent filter tabs
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

    // Sort: lowest sortOrder first, then newest createdAt first
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

  // List of redemptions
  const pendingRedemptions = useMemo(() => {
    return redemptions.filter((red) => red.status === "pending");
  }, [redemptions]);

  const approvedRedemptions = useMemo(() => {
    return redemptions.filter((red) => red.status === "approved");
  }, [redemptions]);

  // Compute pending allocations cost for current kid
  const currentKidPendingCost = useMemo(() => {
    if (currentUser.role !== UserRole.KID) return 0;
    return pendingRedemptions
      .filter(r => r.childUid === currentUser.uid)
      .reduce((sum, item) => sum + item.starsRequired, 0);
  }, [pendingRedemptions, currentUser]);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim() || starsCost <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddReward({
        familyId: currentUser.familyId || "",
        title: rewardTitle.trim(),
        starsCost,
        stock: 999999, // placeholder stock
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
    if (currentUser.role !== UserRole.KID) {
      alert("只有小朋友才可以進行禮物兌換唷！🌟");
      return;
    }
    if (currentUser.stars < item.starsCost) {
      alert("作戰星數不足唷！快去通關每日指派任務獲取星星吧！💪");
      return;
    }
    
    // Check if there is already a pending redemption request of the same item
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

  return (
    <div id="reward-center-module" className="bg-[#FFFDF8] rounded-2xl md:rounded-[24px] border-0 md:border border-[#EFEAE2] p-3.5 md:p-6 lg:p-8 md:soft-journal-shadow space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-[#F7F3EB] pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 md:h-11 md:w-11 bg-pink-50 text-[#EAA59E] rounded-xl border border-pink-100 flex items-center justify-center shrink-0">
            <Gift className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm md:text-xl font-extrabold text-[#3C332D]">願望與禮物中心</h2>
            <p className="hidden md:block text-xs text-gray-400 mt-0.5 font-medium">激勵小朋友累計星星、兌換暖心小禮物！</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] px-3 py-2 rounded-full transition cursor-pointer shadow-xs max-h-[38px]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isParent ? "新增" : "許願"}</span>
        </button>
      </div>

      {/* Upgraded Star Balance Card */}
      <div id="stars-balance-card" className="flex flex-col font-sans bg-[#FAF8F5]/80 border border-amber-200/40 rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 gap-4 select-none shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-amber-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h3 className="text-sm font-black text-amber-900 leading-none">我的星星與餘額</h3>
          </div>
          
          {/* Quick Add/Deduct Buttons (Parent / Admin only) */}
          {isParent && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-quick-add-stars"
                onClick={() => handleOpenAdjustModal("increase")}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-full shadow-sm cursor-pointer transition transform hover:scale-102 active:scale-98"
              >
                <span>➕ 加點</span>
              </button>
              <button
                type="button"
                id="btn-quick-deduct-stars"
                onClick={() => handleOpenAdjustModal("decrease")}
                className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-4 py-2 rounded-full shadow-sm cursor-pointer transition transform hover:scale-102 active:scale-98"
              >
                <span>➖ 扣點</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Big Number Section (Left column, width = 5) */}
          <div className="md:col-span-5 bg-white p-6 rounded-2xl border border-amber-100/75 flex flex-col items-center justify-center text-center relative shadow-xs">
            {/* Pulsing Star Accent Row */}
            <div className="flex gap-1.5 mb-3 text-lg">
              <span className="animate-pulse">⭐</span>
              <span className="animate-pulse">⭐</span>
              <span className="animate-pulse">⭐</span>
            </div>
            
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">目前星星</p>
            <div className="text-6xl lg:text-7xl font-sans font-black text-amber-500 font-mono tracking-tight my-2">
              {currentUser.stars || 0}
            </div>
            
            <div className="mt-2 text-xs font-bold text-gray-500 flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100/50">
              <span>可用餘額：</span>
              <span className="font-mono text-emerald-600 font-extrabold">
                {Math.max(0, (currentUser.stars || 0) - currentKidPendingCost)} ★
              </span>
            </div>
            {currentKidPendingCost > 0 && (
              <span className="text-[9px] font-black text-rose-500 mt-1">
                （扣除待核准：{currentKidPendingCost} 顆星）
              </span>
            )}
          </div>

          {/* Goal Motivational Progress Grid (Right column, width = 7) */}
          <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-amber-100 flex flex-col justify-between shadow-xs">
            <div>
              <h4 className="text-xs font-black text-amber-900 mb-3 flex items-center gap-1">
                <span>🎯</span> 距離最近禮物目標進度
              </h4>
              
              {/* Calculate dynamic distances to next rewards */}
              {(() => {
                const availableGifts = (rewards || []).filter(r => r.status === "available" || r.status === "wished");
                const currentStars = currentUser.stars || 0;
                
                const lockedGifts = availableGifts
                  .filter(r => r.starsCost > currentStars)
                  .map(r => ({
                    ...r,
                    diff: r.starsCost - currentStars
                  }))
                  .sort((a, b) => a.diff - b.diff); // closest distance first
                
                if (lockedGifts.length === 0) {
                  return (
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 p-4 rounded-xl text-center">
                      🎉 太棒了！所有的禮物目標你都達成了，快向爸媽兌換吧！
                    </div>
                  );
                }
                
                const closest = lockedGifts[0];
                
                return (
                  <div className="space-y-4">
                    {/* Nearest Gift Header Indicator */}
                    <div className="bg-amber-50/40 border border-amber-100/50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-950">距離最近禮物</span>
                      <span className="text-xs font-black text-rose-600">
                        還差 <span className="text-base font-mono font-black">{closest.diff}</span> 顆星
                      </span>
                    </div>
                    
                    {/* Other Lock Target List */}
                    <div className="space-y-2 mt-1">
                      <p className="text-[9px] text-gray-450 font-black uppercase tracking-wider">目標里程碑大禮：</p>
                      {lockedGifts.slice(0, 3).map((gift) => (
                        <div key={gift.id} className="flex justify-between items-center text-xs font-bold py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-gray-700 flex items-center gap-1">
                            <span>🎁</span> {gift.title}
                          </span>
                          <span className="text-gray-400 text-[11px] font-extrabold flex items-center gap-1">
                            還差 <span className="text-rose-500 font-mono font-bold">{gift.diff}</span> 顆星
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
      <div id="star-transactions-ledger" className="bg-[#FFFDF8] rounded-[24px] border border-[#EFEAE2] p-5 lg:p-6 soft-journal-shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <span className="text-lg">🧾</span>
          <h3 className="text-sm font-black text-amber-900">星星異動紀錄 (流水帳)</h3>
        </div>

        {starTransactions && starTransactions.length > 0 ? (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {starTransactions.map((tx, idx) => {
              // Format date: convert seconds to string YYYY/MM/DD
              let dateStr = "2026/06/09";
              if (tx.createdAt) {
                const d = tx.createdAt.seconds ? new Date(tx.createdAt.seconds * 1000) : new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const r = String(d.getDate()).padStart(2, "0");
                dateStr = `${y}/${m}/${r}`;
              }
              
              const isPlus = tx.amount > 0 || tx.type === "increase";
              const absAmount = Math.abs(tx.amount);
              
              return (
                <div key={tx.id || idx} className="flex flex-col text-xs font-sans border-b border-[#F7F3EB] pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 font-bold tracking-wider">{dateStr}</span>
                    <span className={`font-black text-xs px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs ${isPlus ? "text-emerald-700 bg-emerald-50 border border-emerald-100/55" : "text-rose-700 bg-rose-50 border border-rose-100/55"}`}>
                      {isPlus ? `➕ +${absAmount}星` : `➖ -${absAmount}星`}
                    </span>
                  </div>
                  
                  <div className="space-y-1 pl-1">
                    <p className="text-gray-700 font-bold">
                      <span className="text-gray-450 text-[11px] mr-1">原因：</span>
                      {tx.reason}
                    </p>
                    <p className="text-gray-400 text-[10.5px] font-bold">
                      <span className="text-gray-450 mr-1">家長：</span>
                      {tx.operatorName} {tx.childName && `(對象: ${tx.childName})`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-405 font-bold italic">
            目前尚無星星加減流水帳紀錄唷！🌱
          </div>
        )}
      </div>

      {/* Parent Approval Notification Box */}
      {isParent && pendingRedemptions.length > 0 && (
        <div className="bg-[#FFFBF0] border-2 border-dashed border-[#EDD091] rounded-[24px] p-6 space-y-4">
          <h3 className="text-lg font-extrabold text-[#3C332D] flex items-center gap-2">
            🔔 孩子許願與兌換待確認 ({pendingRedemptions.length})
          </h3>
          <p className="text-sm text-gray-400 font-medium">小朋友送出了兌換申請，同意後將自動扣除他的累積星星數：</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRedemptions.map((red) => (
              <div
                key={red.id}
                className="p-5 bg-white rounded-2xl border border-[#FFF59D] soft-journal-shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      申請人: {red.childName}
                    </span>
                    <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 等待家長確認
                    </span>
                  </div>
                  <h4 className="font-extrabold text-md text-[#3C332D] mt-3 break-all flex items-center gap-1.5">
                    🎁 {red.rewardTitle}
                  </h4>
                  <p className="text-sm text-gray-400 font-medium mt-1">
                    需要星數：<span className="text-[#EAA59E] font-black">{red.starsRequired} 🌟</span>
                  </p>
                </div>

                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => onApproveRedemption(red.id)}
                    className="flex-1 py-2 bg-[#9BB096] hover:bg-[#8CA287] text-white font-extrabold text-sm rounded-xl cursor-pointer transition flex items-center justify-center gap-1"
                  >
                    <Check className="h-4 w-4" /> 同意兌換
                  </button>
                  <button
                    onClick={() => onRejectRedemption(red.id)}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-500 font-bold text-sm rounded-xl cursor-pointer transition"
                    title="婉拒"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Store Rewards vs Wishlist Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Available Reward Store - Takes 2 Columns */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
            <h3 className="text-xl font-extrabold text-[#3C332D] tracking-wide flex items-center gap-2 border-l-4 border-[#5B7283] pl-3">
               家庭禮物中心
            </h3>

            {/* Parent only Status Switch Controls */}
            {isParent && (
              <div className="flex flex-wrap gap-1 bg-[#F2EDE5]/40 border border-[#EFEAE2] p-1 rounded-xl text-[11px] font-black select-none">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === "all" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  全部
                </button>
                <button
                  onClick={() => setStatusFilter("available")}
                  className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === "available" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  上架中
                </button>
                <button
                  onClick={() => setStatusFilter("paused")}
                  className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === "paused" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  暫停中
                </button>
                <button
                  onClick={() => setStatusFilter("archived")}
                  className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === "archived" ? "bg-[#3C332D] text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  已下架
                </button>
              </div>
            )}
          </div>

          {filteredStoreItems.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-[#EFEAE2] rounded-[24px] bg-white">
              <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg text-gray-400 font-bold">目前看來沒有此分類的禮物獎勵唷</p>
              {isParent ? (
                <p className="text-sm text-gray-400 mt-1">請點擊右上方按鈕為孩子新增第一個獎勵大禮吧！</p>
              ) : (
                <p className="text-sm text-gray-400 mt-1">小朋友可以前往右方進行「許願」，爸媽同意後就可加入商城囉！</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:gap-6">
              {filteredStoreItems.map((item) => {
                const kidStars = currentUser.stars || 0;
                const pct = Math.min(100, Math.round((kidStars / item.starsCost) * 100));
                const deficit = Math.max(0, item.starsCost - kidStars);
                const canAfford = currentUser.role === UserRole.KID && kidStars >= item.starsCost;
                const isRequested = redemptions.some(r => r.rewardId === item.id && r.childUid === currentUser.uid && r.status === "pending");

                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #E9E2DB",
                      borderRadius: "16px",
                      background: item.status === RewardStatus.PAUSED ? "#FCFBF3" : item.status === RewardStatus.ARCHIVED ? "#F2F2F2" : "#FFFFFF",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                    }}
                    className={`p-3 md:p-5 relative flex flex-col justify-between min-h-[160px] md:min-h-[220px] hover:translate-y-[-2px] transition ${item.status === RewardStatus.ARCHIVED ? "opacity-75" : ""}`}
                  >
                    {/* Parent quick controls */}
                    {isParent && (
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="text-gray-400 hover:text-sky-600 p-1.5 bg-gray-50 border border-gray-150 rounded-lg cursor-pointer transition shadow-xs hover:bg-sky-50"
                          title="編輯細項"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定要完全刪除「${item.title}」此獎項嗎？`)) {
                              onDeleteReward(item.id);
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 p-1.5 bg-gray-50 border border-gray-150 rounded-lg cursor-pointer transition shadow-xs hover:bg-rose-50"
                          title="直接刪除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Badge Toggles */}
                      <div className="flex flex-wrap gap-1.5 leading-none">
                        {item.status === RewardStatus.PAUSED ? (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 rounded-md px-1.5 py-0.5 select-none">
                            ⏸ 暫停中
                          </span>
                        ) : item.status === RewardStatus.ARCHIVED ? (
                          <span className="text-[9px] font-black bg-gray-205 text-gray-700 border border-gray-300 rounded-md px-1.5 py-0.5 select-none">
                            📦 已下架
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-250/50 rounded-md px-1.5 py-0.5 select-none">
                            🟢 上架中
                          </span>
                        )}
                        {item.sortOrder !== undefined && (
                          <span className="text-[9px] font-bold bg-sky-50 text-sky-800 border border-sky-100 rounded-md px-1.5 py-0.5">
                            排序: {item.sortOrder}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-start pr-12">
                        <h4 className="font-extrabold text-[#3C332D] text-lg leading-tight break-all tracking-tight">
                          ✨ {item.title}
                        </h4>
                      </div>

                      {item.description && (
                        <p className="text-xs text-gray-400 font-semibold line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {/* Parent custom notes display */}
                      {item.note && (
                        <div className="bg-[#FAF9F5] border-l-2 border-amber-350 p-2 rounded-r-xl text-[11px] font-bold text-gray-600">
                          <span className="text-amber-800 block text-[10px] uppercase font-black">爸媽備註 / 叮嚀：</span>
                          <p className="italic mt-0.5 whitespace-pre-wrap">{item.note}</p>
                        </div>
                      )}

                      {/* Progress bar and numeric targets */}
                      <div className="space-y-1.5 border-t border-gray-100 pt-3 font-sans select-none">
                        <div className="flex justify-between items-center text-[10.5px] font-bold">
                          <span className="text-[#3C332D] bg-[#FFF8E8] border border-[#F4E2A8]/50 px-2.5 py-0.5 rounded-lg font-black">
                            需要: {item.starsCost} 顆星
                          </span>
                          <span>
                            {deficit === 0 ? (
                              <span className="text-emerald-600 font-extrabold">🎉 已達標可兌換 </span>
                            ) : (
                              <span className="text-gray-430">進度: {pct}% | 還差 <span className="text-rose-500 font-black">{deficit}</span> 顆星</span>
                            )}
                          </span>
                        </div>
                        {/* Progress Bar design */}
                        <div className="w-full bg-gray-100 rounded-full h-2 relative overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${deficit === 0 ? "bg-emerald-500" : "bg-[#EAA59E]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-[#F7F3EB] flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-semibold leading-none">
                        建立者：{item.creatorName || "全家管理員"}
                      </span>

                      {currentUser.role === UserRole.KID && item.status === RewardStatus.AVAILABLE && (
                        <button
                          onClick={() => handleRedeemClick(item)}
                          disabled={isRequested}
                          className={`text-xs font-black px-4 py-2 rounded-full transition cursor-pointer select-none ${
                            isRequested
                              ? "bg-amber-100 text-amber-600 border border-amber-200"
                              : !canAfford
                              ? "bg-[#F7F3EB] text-gray-400 border border-[#EFEAE2] cursor-not-allowed shadow-none"
                              : "bg-[#EAA59E] hover:bg-[#df938c] text-white soft-journal-shadow"
                          }`}
                        >
                          {isRequested ? "審核中..." : !canAfford ? "星星不夠唷" : "發送兌領"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wishpool Side column - Takes 1 Column */}
        <div className="space-y-5">
          <h3 className="text-xl font-extrabold text-[#3C332D] tracking-wide flex items-center gap-2 border-l-4 border-[#EAA59E] pl-3">
             小孩許願池 (待確認)
          </h3>

          {wishListItems.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[#EFEAE2] rounded-[24px] bg-white">
              <Sparkles className="h-10 w-10 text-pink-300 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                許願池目前亮晶晶！<br />在右上方點擊向爸媽許下想要的生日禮、探險行程吧
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {wishListItems.map((wish) => (
                <div
                  key={wish.id}
                  style={{
                    border: "1px solid #E9E2DB",
                    borderRadius: "24px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                  }}
                  className="p-5 relative"
                >
                  {isParent && (
                    <button
                      onClick={() => onDeleteReward(wish.id)}
                      className="absolute right-2 top-3 text-gray-400 hover:text-red-500 p-1"
                      title="刪除許願"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <div className="space-y-3">
                    <span className="inline-block text-[10px] font-sans font-bold bg-[#FAF8F4] text-amber-705 px-2 py-0.5 rounded-full border border-amber-200/40">
                      📍 夢想許願中
                    </span>
                    <h4 className="font-extrabold text-[#3C332D] text-sm pr-6 break-all">💭 {wish.title}</h4>
                    {wish.description && (
                      <p className="text-xs text-gray-400 font-semibold line-clamp-3 leading-relaxed">
                        {wish.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-sans">
                      <span
                        style={{
                          background: "#FFF8E8",
                          border: "1px solid #F4E2A8"
                        }}
                        className="text-[11px] font-extrabold text-amber-800 px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"
                      >
                        ⭐ {wish.starsCost} 顆星星
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F7F3EB] flex items-center justify-between">
                    <span className="text-xs text-[#A6A6A6] font-extrabold leading-none">
                      許願孩子：{wish.creatorName}
                    </span>

                    {isParent && (
                      <button
                        onClick={() => onApproveWish(wish.id)}
                        className="text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition shrink-0"
                      >
                        同意上架
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Redemption Logs */}
          <div className="pt-4 font-sans select-none">
            <h3 className="text-sm font-extrabold text-[#3C332D] mb-3 flex items-center gap-1.5 pl-3 border-l-4 border-emerald-500">
               🌸 幸福兌換紀錄 ({approvedRedemptions.length})
            </h3>
            {approvedRedemptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic pl-3 font-semibold">目前還沒有禮物成功的兌換紀錄唷</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {approvedRedemptions.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-[#EAF5EA] border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-extrabold flex items-center justify-between">
                      <span>🎉 {log.rewardTitle}</span>
                      <span className="text-[10px] bg-white/70 px-1.5 rounded font-mono font-black">已兌領</span>
                    </p>
                    <p className="text-gray-500 text-[10px] font-semibold">
                      由 {log.childName} 扣除 {log.starsRequired} ★ 兌換成功
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Reward / Wish Form popup */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full soft-journal-shadow relative font-sans">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-black text-[#3C332D] mb-6 flex items-center gap-2">
              <Gift className="h-6 w-6 text-[#EAA59E]" />
              {isParent ? "新增商品獎勵" : "提出心愛許願"}
            </h3>

            <form onSubmit={handleCreateReward} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">獎勵名稱</label>
                <input
                  type="text"
                  required
                  placeholder={isParent ? "請輸入新增上架的實體獎勵..." : "請輸入你許願想要的禮物..."}
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none placeholder-gray-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">需要星星數</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={starsCost}
                  onChange={(e) => setStarsCost(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">獎勵細節說明 (簡短敘述)</label>
                <textarea
                  rows={2}
                  placeholder="可輸入此獎勵的說明，例如：週末下午去動物園、看一場電影..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none resize-none placeholder-gray-300 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#F7F3EB]">
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
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition disabled:opacity-50 soft-journal-shadow cursor-pointer"
                >
                  {isSubmitting ? "上傳中..." : isParent ? "新增上架" : "送出許願"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reward Form popup (Parent only) */}
      {editingReward && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full soft-journal-shadow relative font-sans">
            <button
              onClick={() => setEditingReward(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-black text-[#3C332D] mb-6 flex items-center gap-2">
              <Gift className="h-6 w-6 text-[#EAA59E]" />
              編輯獎勵商品項目
            </h3>

            <form onSubmit={handleSaveUpdate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">獎勵名稱</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">需要星星數</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editStarsCost}
                  onChange={(e) => setEditStarsCost(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">獎勵說明</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none resize-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">爸媽備註 / 叮嚀</label>
                <textarea
                  rows={2}
                  placeholder="可寫下對孩子的鼓勵或規定，例如：需自理桌面、完成該月功課包等..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none resize-none font-semibold text-gray-655"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">建立者（署名）</label>
                <input
                  type="text"
                  required
                  value={editCreatorName}
                  onChange={(e) => setEditCreatorName(e.target.value)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">排序優先級 (數字越小越前面)</label>
                <input
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#5B7283] mb-1.5">商品狀態</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as RewardStatus)}
                  className="w-full text-sm border border-[#EFEAE2] bg-[#FFFDF8] rounded-xl px-4 py-3 focus:outline-none font-bold"
                >
                  <option value={RewardStatus.AVAILABLE}>上架中 / 啟用中 (Available)</option>
                  <option value={RewardStatus.PAUSED}>已暫停出貨 (Paused)</option>
                  <option value={RewardStatus.ARCHIVED}>下架 / 封存 (Archived)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#F7F3EB]">
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
                  className="px-5 py-2 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition disabled:opacity-50 soft-journal-shadow cursor-pointer"
                >
                  {isSubmitting ? "保存中..." : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 🌟 Stars Adjustment Center Modal (加減點調整中心) */}
      {adjustType && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 lg:p-8 max-w-md w-full soft-journal-shadow relative font-sans">
            <button
              onClick={() => setAdjustType(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-[#3C332D] cursor-pointer transition text-lg"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-lg lg:text-xl font-black text-[#3C332D] mb-5 flex items-center gap-2">
              <span>{adjustType === "increase" ? "⭐⭐ 快速加點星星 ⭐⭐" : "⚠️⚠️ 快速扣點星星 ⚠️⚠️"}</span>
            </h3>

            {(familyMembers || []).filter(m => m.role === UserRole.KID).length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 font-bold italic">
                ⚠️ 目前家庭成員內無「小孩 (Kid)」成員，請至成員中心新增孩子喔！
              </div>
            ) : (
              <form onSubmit={handleAdjustSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {/* Child Select (對象選擇) */}
                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1.5">調整對象小孩</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(familyMembers || []).filter(m => m.role === UserRole.KID).map((k) => (
                      <label
                        key={k.uid}
                        className={`border-2 rounded-xl p-3 flex items-center gap-2 cursor-pointer transition select-none ${selectedKidUid === k.uid ? "bg-amber-50/20 border-amber-400" : "bg-[#FFFDF8] border-[#EFEAE2] hover:border-gray-350"}`}
                      >
                        <input
                          type="radio"
                          name="adjust-target-kid"
                          value={k.uid}
                          checked={selectedKidUid === k.uid}
                          onChange={() => setSelectedKidUid(k.uid)}
                          className="text-amber-500 focus:ring-amber-400"
                        />
                        <span className="text-xs font-black text-gray-700">{k.displayName}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Stars select */}
                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1.5">
                    {adjustType === "increase" ? "星星加點數量" : "星星扣點數量"}
                  </label>
                  
                  {/* Preset Stars Quick Option row */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {adjustType === "increase" ? (
                      [1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAdjustStarsAmount(num)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${adjustStarsAmount === num ? "bg-emerald-500 text-white shadow-xs" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${adjustStarsAmount === num ? "bg-rose-500 text-white shadow-xs" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
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
                    className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-2.5 bg-[#FFFDF8] focus:outline-none font-mono font-black"
                  />
                </div>

                {/* Reason (原因說明) */}
                <div>
                  <label className="block text-xs font-black text-[#5B7283] mb-1.5">異動原因</label>
                  
                  {/* Preset Reasons Quick Option buttons */}
                  <p className="text-[10px] text-gray-400 font-extrabold mb-1">精選快捷原因：</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {adjustType === "increase" ? (
                      ["🍙 今天吃飯吃光光", "🛀 自己洗澡", "📚 主動閱讀", "🧹 幫忙整理房間", "🚗 出門表現很好"].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => setAdjustReasonText(phrase.replace(/[^\u4e00-\u9fa5ad-tsa-zA-Z0-9\s]/g, "").trim())}
                          className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/50 transition cursor-pointer"
                        >
                          {phrase}
                        </button>
                      ))
                    ) : (
                      ["😢 不聽話", "📱 偷玩手機", "⚠️ 頂嘴", "🚫 沒遵守約定"].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => setAdjustReasonText(phrase.replace(/[^\u4e00-\u9fa5ad-tsa-zA-Z0-9\s]/g, "").trim())}
                          className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200/50 transition cursor-pointer"
                        >
                          {phrase}
                        </button>
                      ))
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="請輸入異動原因..."
                    value={adjustReasonText}
                    onChange={(e) => setAdjustReasonText(e.target.value)}
                    className="w-full text-sm border border-[#EFEAE2] rounded-xl px-4 py-2.5 bg-[#FFFDF8] focus:outline-none font-bold placeholder-gray-300"
                  />
                </div>

                {/* Footer submit */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-[#F7F3EB]">
                  <button
                    type="button"
                    onClick={() => setAdjustType(null)}
                    className="px-4 py-2 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-xs font-black text-white rounded-full transition soft-journal-shadow cursor-pointer ${adjustType === "increase" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"}`}
                  >
                    {adjustType === "increase" ? "確認加點" : "確認扣點"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
