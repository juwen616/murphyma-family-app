import React, { useState, useMemo } from "react";
import { CommonTemplate, UserProfile, UserRole, getLocalToday } from "../types";
import { Sparkles, Plus, Trash2, X, Star, Edit3, Settings2, Heart, Clock } from "lucide-react";

interface FavoriteMgrProps {
  currentUser: UserProfile;
  favoriteActivities: CommonTemplate[];
  onAddFavorite: (activityData: Omit<CommonTemplate, "id" | "creatorUid" | "createdAt"> & { startDate?: string }) => Promise<void>;
  onDeleteFavorite: (activityId: string, deleteFutureEvents?: boolean) => Promise<void>;
  onEditFavorite?: (activityId: string, updatedData: Partial<CommonTemplate> & { startDate?: string }) => Promise<void>;
}

export default function FavoriteMgr({
  currentUser,
  favoriteActivities,
  onAddFavorite,
  onDeleteFavorite,
  onEditFavorite,
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
    <div id="favorite-activities-module" className="bg-[#FCFAF2] rounded-[24px] border border-[#EFEAE2] p-6 lg:p-8 soft-journal-shadow space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#F4EFE6] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFFBF0] text-[#EAA59E] rounded-2xl border border-[#EDD091]/30">
            <Heart className="h-6 w-6 fill-[#EAA59E]" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#3C332D] font-sans">常用事項 / 任務</h2>
            <p className="text-base text-gray-400 mt-1 font-medium">預先建立常用事物，建立日常行程、指派學習任務時一鍵秒速導入</p>
          </div>
        </div>

        {isParent && (
          <button
            onClick={handleOpenAddForm}
            className="flex items-center gap-2 text-md font-black text-white bg-[#5B7283] hover:bg-[#4E6170] px-5 py-3 rounded-full transition cursor-pointer soft-journal-shadow transform hover:scale-102 active:scale-98"
          >
            <Plus className="h-5 w-5" /> <span>新增常用事項</span>
          </button>
        )}
      </div>

      {favoriteActivities.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#EFEAE2] rounded-[24px] bg-white">
          <Heart className="h-12 w-12 text-[#EAA59E]/40 mx-auto mb-3" />
          <p className="text-lg text-gray-500 font-sans font-bold">目前還沒有任何常用事項唷</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
            在這裡加入像是「自學畫畫課」、「牙醫回診」、「遛狗清砂盆」等常用項目，後續建立整月行程或指派任務時能秒速導入，節省重複打字的時間！
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-visible">
          {favoriteActivities.map((act) => {
            const displayDefaultTime = act.hasDefaultTime && act.defaultStartTime
              ? `${act.defaultStartTime} ~ ${act.defaultEndTime || ""}`
              : "無";

            return (
              <div
                key={act.id}
                style={{
                  border: "1px solid #E9E2DB",
                  borderRadius: "24px",
                  background: "#FFFFFF",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                }}
                className="p-6 relative flex flex-col justify-between h-auto min-h-[220px] overflow-visible transition duration-200 hover:-translate-y-0.5"
              >
                {/* Upper right action buttons */}
                {isParent && (
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 select-none z-10">
                    <button
                      onClick={() => handleOpenEditForm(act)}
                      className="flex items-center gap-1 text-xs font-bold text-[#5B7283] hover:text-[#415362] bg-[#F7F3EB] hover:bg-[#EFEAE2] px-2 py-1 rounded-lg transition cursor-pointer"
                      title="編輯此事項"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>編輯</span>
                    </button>
                    <button
                      onClick={() => setDeletingTemplate(act)}
                      className="flex items-center gap-1 text-xs font-bold text-[#EAA59E] hover:text-red-700 bg-rose-50/50 hover:bg-rose-100/50 px-2 py-1 rounded-lg transition cursor-pointer"
                      title="刪除"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>刪除</span>
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Title */}
                  <h4 className="font-extrabold text-[#3C332D] text-lg pr-20 leading-snug">{act.title}</h4>

                  {/* Type Capsule Tag */}
                  <div className="flex flex-wrap gap-1">
                    {(act.usageType || act.type) === "calendar" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#5B7283] bg-[#EAF0EB] rounded-full">
                        📅 行事曆
                      </span>
                    ) : (act.usageType || act.type) === "task" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#EAA59E] bg-rose-50 rounded-full">
                        ⭐ 任務
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#7C6354] bg-[#F5EBE6] rounded-full">
                        📅⭐ 行事曆＋任務
                      </span>
                    )}
                  </div>

                  {/* Body content info block */}
                  <div className="space-y-2 text-xs font-semibold text-gray-500">
                    <p>
                      預設時間：
                      <span className="text-[#3C332D] font-bold font-mono">
                        {displayDefaultTime}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-[#F7F3EB] text-xs">
                  {act.isRecurring ? (
                    <span className="flex flex-col gap-0.5 text-[#EAA59E] bg-rose-50/30 px-3 py-1.5 rounded-xl font-sans font-bold border border-rose-100/35">
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-[#EAA59E] stroke-[#EAA59E]" />
                        固定活動 / 週課表
                      </span>
                      {act.repeatDays && act.repeatDays.length > 0 && (
                        <span className="text-xs text-[#3C332D] font-semibold mt-0.5">
                          ({getWeekdaysString(act.repeatDays)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[#5B7283] font-sans font-bold bg-[#FAF8F4] border border-[#EFEAE2] px-3 py-1.5 rounded-xl inline-block">
                      可快速加入行事曆
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog box */}
      {deletingTemplate && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-md w-full soft-journal-shadow relative">
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
