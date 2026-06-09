import React, { useState, useMemo } from "react";
import { CommonTemplate, UserProfile, UserRole, getLocalToday } from "../types";
import { Sparkles, Plus, Trash2, X, Star, Edit3, Settings2, Heart, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface FavoriteMgrProps {
  currentUser: UserProfile;
  favoriteActivities: CommonTemplate[];
  onAddFavorite: (activityData: Omit<CommonTemplate, "id" | "creatorUid" | "createdAt"> & { startDate?: string }) => Promise<void>;
  onDeleteFavorite: (activityId: string, deleteFutureEvents?: boolean) => Promise<void>;
  onEditFavorite?: (activityId: string, updatedData: Partial<CommonTemplate> & { startDate?: string }) => Promise<void>;
  onAddEvent?: (eventData: any) => Promise<void>;
  onAddTask?: (taskData: any) => Promise<void>;
  familyMembers?: UserProfile[];
}

export default function FavoriteMgr({
  currentUser,
  favoriteActivities,
  onAddFavorite,
  onDeleteFavorite,
  onEditFavorite,
  onAddEvent,
  onAddTask,
  familyMembers = [],
}: FavoriteMgrProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CommonTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<CommonTemplate | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [usageType, setUsageType] = useState<"calendar" | "task" | "both">("both");
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(getLocalToday());
  const [hasDefaultTime, setHasDefaultTime] = useState(false);
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultEndTime, setDefaultEndTime] = useState("");

  // 秒速導入 States
  const [applyingTemplate, setApplyingTemplate] = useState<CommonTemplate | null>(null);
  const [applyDate, setApplyDate] = useState(getLocalToday());
  const [applyAssignee, setApplyAssignee] = useState("");
  const [applyStars, setApplyStars] = useState(10);
  const [applyAsType, setApplyAsType] = useState<"calendar" | "task">("calendar");

  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;

  const TIME_CHOICES = useMemo(() => {
    const list = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      for (let m = 0; m < 60; m += 15) {
        const mm = String(m).padStart(2, "0");
        list.push(`${hh}:${mm}`);
      }
    }
    return list;
  }, []);

  const WEEKDAYS_LIST = [
    { label: "週日", value: 0 },
    { label: "週一", value: 1 },
    { label: "週二", value: 2 },
    { label: "週三", value: 3 },
    { label: "週四", value: 4 },
    { label: "週五", value: 5 },
    { label: "週六", value: 6 },
  ];

  const getWeekdaysString = (wds?: number[]) => {
    if (!wds || wds.length === 0) return "";
    const labels = wds
      .map((w) => WEEKDAYS_LIST.find((item) => item.value === w)?.label || "")
      .filter(Boolean);
    return labels.join("、");
  };

  const toggleWeekday = (val: number) => {
    if (repeatDays.includes(val)) {
      setRepeatDays(repeatDays.filter((w) => w !== val));
    } else {
      setRepeatDays([...repeatDays, val]);
    }
  };

  const handleOpenAddForm = () => {
    setEditingActivity(null);
    setTitle("");
    setUsageType("both");
    setIsRecurring(false);
    setRepeatDays([]);
    setStartDate(getLocalToday());
    setHasDefaultTime(false);
    setDefaultStartTime("");
    setDefaultEndTime("");
    setShowAddForm(true);
  };

  const handleOpenEditForm = (act: CommonTemplate) => {
    setEditingActivity(act);
    setTitle(act.title);
    setUsageType(act.usageType || act.type || "both");
    setIsRecurring(act.isRecurring || false);
    setRepeatDays(act.repeatDays || []);
    setStartDate(act.startDate || getLocalToday());
    setHasDefaultTime(act.hasDefaultTime || !!act.defaultStartTime);
    setDefaultStartTime(act.defaultStartTime || "");
    setDefaultEndTime(act.defaultEndTime || "");
    setShowAddForm(true);
  };

  const handleApplyQuick = (act: CommonTemplate) => {
    setApplyingTemplate(act);
    setApplyDate(getLocalToday());
    setApplyAsType((act.usageType || act.type) === "task" ? "task" : "calendar");
    setApplyAssignee("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        familyId: currentUser.familyId || "",
        title: title.trim(),
        type: usageType,
        usageType: usageType,
        isRecurring,
        repeatDays: isRecurring ? repeatDays : [],
        hasDefaultTime,
        defaultStartTime: hasDefaultTime ? defaultStartTime : "",
        defaultEndTime: hasDefaultTime ? defaultEndTime : "",
        startDate: isRecurring ? startDate : "",
      };

      if (editingActivity) {
        if (onEditFavorite) {
          await onEditFavorite(editingActivity.id, payload);
        }
      } else {
        await onAddFavorite(payload);
      }
      
      setTitle("");
      setIsRecurring(false);
      setRepeatDays([]);
      setStartDate(getLocalToday());
      setHasDefaultTime(false);
      setDefaultStartTime("");
      setDefaultEndTime("");
      setShowAddForm(false);
      setEditingActivity(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="favorite-activities-module" className="bg-[#FCFAF2] rounded-2xl md:rounded-[24px] border-0 md:border md:border-[#EFEAE2] p-3 md:p-6 lg:p-8 md:soft-journal-shadow space-y-4 md:space-y-6">
      {/* Header bar - Compressing height & padding to 40~60px / 12~16px */}
      <div className="flex justify-between items-center border-b border-[#F4EFE6] pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 md:h-10 md:w-10 bg-[#FFFBF0] text-[#EAA59E] rounded-xl border border-[#EDD091]/30 flex items-center justify-center shrink-0">
            <Heart className="h-4.5 w-4.5 fill-[#EAA59E]" />
          </div>
          <div>
            <h2 className="text-sm md:text-xl font-extrabold text-[#3C332D] font-sans">常用事項</h2>
            <p className="hidden md:block text-xs text-gray-400 mt-0.5 font-medium">預先建立常用事物，一鍵秒速導入</p>
          </div>
        </div>

        {isParent && (
          <button
            onClick={handleOpenAddForm}
            className="flex items-center gap-1 text-xs font-black text-white bg-[#5B7283] hover:bg-[#4E6170] px-3 py-2 rounded-full transition cursor-pointer shadow-xs max-h-[38px]"
          >
            <Plus className="h-3.5 w-3.5" /> <span>新增</span>
          </button>
        )}
      </div>

      {favoriteActivities.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#EFEAE2] rounded-2xl bg-white">
          <Heart className="h-10 w-10 text-[#EAA59E]/40 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-sans font-bold">目前還沒有任何常用事項唷</p>
          <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto leading-relaxed px-5">
            在這裡加入像是「自學畫畫課」、「牙醫回診」、「遛狗清砂盆」等常用項目，後續建立整月行程或指派任務時能秒速導入！
          </p>
        </div>
      ) : (
        <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 lg:gap-6 overflow-visible">
          {favoriteActivities.map((act) => {
            const displayDefaultTime = act.hasDefaultTime && act.defaultStartTime
              ? `${act.defaultStartTime} ~ ${act.defaultEndTime || ""}`
              : "無預設時間";

            const typeLabel = (act.usageType || act.type) === "calendar" 
              ? "行事曆" 
              : (act.usageType || act.type) === "task" 
              ? "任務" 
              : "行事曆＋任務";

            const repeatLabel = act.isRecurring && act.repeatDays && act.repeatDays.length > 0
              ? `每週${getWeekdaysString(act.repeatDays)}`
              : "";

            return (
              <div
                key={act.id}
                className="flex md:flex-col justify-between items-center md:items-start p-3 md:p-5 bg-white border border-[#E9E2DB] rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 min-h-[76px] md:min-h-[190px]"
              >
                {/* Information Area */}
                <div className="flex-1 min-w-0 pr-3 md:pr-0 md:space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs md:text-base font-black text-[#3C332D] truncate block">
                      {act.title}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] md:text-xs text-gray-400 font-bold mt-0.5 md:mt-1">
                    <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-150">
                      {typeLabel}
                    </span>
                    <span className="font-mono text-gray-500">
                      {displayDefaultTime} {repeatLabel && `(${repeatLabel})`}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-1 md:mt-4 md:w-full md:border-t md:border-gray-100 md:pt-3 shrink-0">
                  <button
                    onClick={() => handleApplyQuick(act)}
                    className="px-2.5 py-1.5 text-[11px] font-black text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition shadow-none cursor-pointer"
                  >
                    加入
                  </button>
                  {isParent && (
                    <>
                      <button
                        onClick={() => handleOpenEditForm(act)}
                        className="px-2 py-1.5 text-[11px] font-bold text-gray-600 bg-[#F7F3EB] hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => setDeletingTemplate(act)}
                        className="px-2 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-100/50 transition cursor-pointer"
                      >
                        刪除
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ⚡ 快速套用常用事項 Dialog */}
      {applyingTemplate && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-[#EFEAE2] p-5 max-w-xs w-full soft-journal-shadow space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">
                ⚡ 秒速導入：{applyingTemplate.title}
              </span>
              <h3 className="text-xs font-black text-[#3C332D] mt-1">
                選擇套用日期與細節
              </h3>
            </div>

            <div className="space-y-3">
              {(applyingTemplate.usageType || applyingTemplate.type) === "both" && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">導入至哪裡？</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setApplyAsType("calendar")}
                      className={`py-2 px-2 border rounded-xl transition ${
                        applyAsType === "calendar"
                          ? "bg-amber-50 border-amber-500 text-amber-900"
                          : "bg-white border-gray-200 text-gray-500"
                      }`}
                    >
                      📅 行事曆
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyAsType("task")}
                      className={`py-2 px-2 border rounded-xl transition ${
                        applyAsType === "task"
                          ? "bg-amber-50 border-amber-500 text-amber-900"
                          : "bg-white border-gray-200 text-gray-500"
                      }`}
                    >
                      ⭐ 任務
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">日期</label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={(e) => setApplyDate(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-2 focus:outline-none"
                />
              </div>

              {applyAsType === "task" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">指派給家族成員</label>
                    <select
                      value={applyAssignee}
                      onChange={(e) => setApplyAssignee(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none"
                    >
                      <option value="">（不指定，全體孩子）</option>
                      {familyMembers?.filter(m => (m.role as string) === "Child" || (m.role as string) === "KID")?.map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 flex justify-between">
                      <span>獎勵星星點數</span>
                      <span className="text-amber-600 font-extrabold">{applyStars} 🌟</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={applyStars}
                      onChange={(e) => setApplyStars(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setApplyingTemplate(null)}
                className="flex-1 py-2 text-xs font-bold text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-xl transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    if (applyAsType === "calendar" && onAddEvent) {
                      await onAddEvent({
                        title: applyingTemplate.title,
                        date: applyDate,
                        time: applyingTemplate.defaultStartTime || "",
                        isFixed: applyingTemplate.isRecurring || false,
                        weekdays: applyingTemplate.isRecurring ? applyingTemplate.repeatDays : [],
                        startDate: applyingTemplate.isRecurring ? applyDate : "",
                        isPublic: true,
                        note: "",
                      });
                    } else if (applyAsType === "task" && onAddTask) {
                      await onAddTask({
                        title: applyingTemplate.title,
                        dueDate: applyDate,
                        rewardStars: applyStars,
                        assignedTo: applyAssignee || "all",
                        description: `由常用事項秒速導入的學習任務：${applyingTemplate.title}`,
                        status: "PENDING",
                      });
                    }
                    toast.success("✓ 成功套用此常用項目！");
                    setApplyingTemplate(null);
                  } catch (err) {
                    console.error("Apply template failed:", err);
                    toast.error("套用失敗");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="flex-1 py-2 text-xs font-black text-white bg-amber-653 hover:bg-amber-700 bg-amber-600 rounded-xl shadow-xs transition"
              >
                {isSubmitting ? "導入中" : "確認"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog box */}
      {deletingTemplate && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-6 max-w-sm w-full soft-journal-shadow relative">
            <h3 className="text-lg font-black text-[#3C332D] mb-4 flex items-center gap-2">
              ⚠️ 確認刪除常用事項
            </h3>
            
            <p className="text-sm text-gray-500 mb-6 font-semibold leading-relaxed">
              確定要刪除常用事項：<b className="text-[#EAA59E] font-black text-base block my-2">「 {deletingTemplate.title} 」</b>
              刪除後將無法復原，請選擇您希望進行的刪除方式：
            </p>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    await onDeleteFavorite(deletingTemplate.id, false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setDeletingTemplate(null);
                  }
                }}
                className="w-full text-left p-4 text-sm font-bold text-[#5B7283] bg-[#FFFBF0] hover:bg-[#FDF6E2] border border-[#EDD091]/40 rounded-2xl transition cursor-pointer"
              >
                <div>【只刪常用事項】</div>
                <div className="text-xs text-gray-400 font-medium mt-1">僅將常用清單中的此項目刪除，保留已產生在行事曆的月曆活動。</div>
              </button>
              
              <button
                onClick={async () => {
                  try {
                    await onDeleteFavorite(deletingTemplate.id, true);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setDeletingTemplate(null);
                  }
                }}
                className="w-full text-left p-4 text-sm font-extrabold text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-2xl transition cursor-pointer soft-journal-shadow"
              >
                <div>【全部刪除】</div>
                <div className="text-xs text-rose-100 font-medium mt-1">同時刪除此常用事項，以及行事曆上所有未來與之關聯的每日日程。</div>
              </button>

              <button
                onClick={() => setDeletingTemplate(null)}
                className="w-full text-center py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer mt-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Favorite Modal popup */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full soft-journal-shadow relative animate-in fade-in duration-150 font-sans">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-black text-[#3C332D] mb-6 flex items-center gap-2">
              <Settings2 className="h-6 w-6 text-[#5B7283]" />
              {editingActivity ? "編輯常用事項" : "建立常用事項"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#5B7283] mb-2">名稱（必填）</label>
                <input
                  type="text"
                  required
                  placeholder="例如：畫畫課、游泳課、牙醫回診..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-md border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#5B7283]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#5B7283] mb-2">用途功能（三選一）</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "行事曆", value: "calendar" },
                    { label: "任務", value: "task" },
                    { label: "行事曆＋任務", value: "both" }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition ${
                        usageType === option.value
                          ? "bg-[#5B7283]/10 border-[#5B7283] text-[#3C332D]"
                          : "bg-white border-[#EFEAE2] text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="usageType"
                        value={option.value}
                        checked={usageType === option.value}
                        onChange={() => setUsageType(option.value as any)}
                        className="sr-only"
                      />
                      <span className="text-sm font-extrabold">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Is Fixed Activity check box */}
              <div className="flex items-center gap-2.5 py-1 select-none">
                <input
                  type="checkbox"
                  id="isFixedFav"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-5 w-5 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded-lg cursor-pointer"
                />
                <label htmlFor="isFixedFav" className="text-md font-bold text-[#3C332D] cursor-pointer">
                  固定活動 / 固定課程 (週課表)
                </label>
              </div>

              {isRecurring && (
                <div className="space-y-4 bg-[#FFFDF8] p-4 rounded-2xl border border-[#EFEAE2] animate-in slide-in-from-top-2 duration-150">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#5B7283]">重複星期幾 (可複選)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS_LIST.map((wd) => {
                        const isActive = repeatDays.includes(wd.value);
                        return (
                          <button
                            type="button"
                            key={wd.value}
                            onClick={() => toggleWeekday(wd.value)}
                            className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition ${
                              isActive
                                ? "bg-[#5B7283] text-white border-[#5B7283]"
                                : "bg-white text-gray-500 border-[#EFEAE2] hover:bg-gray-50"
                            } cursor-pointer`}
                          >
                            {wd.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5B7283] mb-1">開始日期</label>
                    <input
                      type="date"
                      required={isRecurring}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs border border-[#EFEAE2] rounded-lg px-3 py-2 bg-white focus:outline-none font-mono"
                    />
                  </div>

                  {/* Time fields inside the expanded fixed settings removed from here and made standalone/optional */}
                </div>
              )}

              {/* Standalone optional default time configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 py-1 select-none">
                  <input
                    type="checkbox"
                    id="hasDefaultTime"
                    checked={hasDefaultTime}
                    onChange={(e) => setHasDefaultTime(e.target.checked)}
                    className="h-5 w-5 bg-[#FFFDF8] border-[#EFEAE2] text-[#5B7283] rounded-lg cursor-pointer"
                  />
                  <label htmlFor="hasDefaultTime" className="text-md font-bold text-[#353535] cursor-pointer">
                    🕒 設定預設時間（選填，無預設時可維持空白）
                  </label>
                </div>

                {hasDefaultTime && (
                  <div className="grid grid-cols-2 gap-3.5 bg-[#FFFDF8] p-4 rounded-2xl border border-[#EFEAE2] animate-in slide-in-from-top-2 duration-150">
                    <div>
                      <label className="block text-xs font-bold text-[#5B7283] mb-1.5">預設開始時間</label>
                      <select
                        value={defaultStartTime}
                        onChange={(e) => setDefaultStartTime(e.target.value)}
                        className="w-full text-xs border border-[#EFEAE2] rounded-lg px-2.5 py-2 bg-white focus:outline-none font-mono cursor-pointer"
                      >
                        <option value="">（無時間）</option>
                        {TIME_CHOICES.map((tc) => (
                          <option key={tc} value={tc}>
                            {tc}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5B7283] mb-1.5">預設結束時間</label>
                      <select
                        value={defaultEndTime}
                        onChange={(e) => setDefaultEndTime(e.target.value)}
                        className="w-full text-xs border border-[#EFEAE2] rounded-lg px-2.5 py-2 bg-white focus:outline-none font-mono cursor-pointer"
                      >
                        <option value="">（無時間）</option>
                        {TIME_CHOICES.map((tc) => (
                          <option key={tc} value={tc}>
                            {tc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-black text-white bg-[#5B7283] hover:bg-[#4E6170] rounded-full transition disabled:opacity-50 cursor-pointer soft-journal-shadow"
                >
                  {isSubmitting ? "儲存中..." : editingActivity ? "儲存修改" : "建立項目"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
