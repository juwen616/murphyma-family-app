import React, { useState, useMemo } from "react";
import {
  Task,
  TaskStatus,
  UserProfile,
  UserRole,
  SystemMode,
  CommonTemplate,
  getLocalToday,
} from "../types";
import {
  ClipboardList,
  CheckCircle,
  FileText,
  Clock,
  X,
  Plus,
  Compass,
  Trash2,
  Edit2,
  Calendar,
  UserCheck,
  Star,
  Check,
  AlertCircle,
  Heart,
  Smile,
  Award
} from "lucide-react";

interface TaskSystemProps {
  currentUser: UserProfile;
  tasks: Task[];
  familyMembers: UserProfile[];
  systemMode: SystemMode;
  favoriteActivities: CommonTemplate[];
  onAddTask: (taskData: Omit<Task, "id" | "status" | "createdAt">) => Promise<void>;
  onSubmitTask: (taskId: string, submissionNote: string, childMood?: string) => Promise<void>;
  onApproveTask: (taskId: string, kidUid: string, starsReward: number, approverName: string, parentEncouragement?: string) => Promise<void>;
  onRejectTask: (taskId: string, rejectionNote: string) => Promise<void>;
  onDeleteTask: (taskId: string, recycleStars?: boolean) => Promise<void>;
  onEditTask?: (taskId: string, updatedData: Partial<Task>) => Promise<void>;
  simulatedTodayDate?: string;
}

export default function TaskSystem({
  currentUser,
  tasks,
  familyMembers,
  systemMode,
  favoriteActivities = [],
  onAddTask,
  onSubmitTask,
  onApproveTask,
  onRejectTask,
  onDeleteTask,
  onEditTask,
  simulatedTodayDate,
}: TaskSystemProps) {
  const todayStr = simulatedTodayDate || getLocalToday();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"available" | "submitted" | "history">("available");

  // Form states
  const [taskTitle, setTaskTitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [starsReward, setStarsReward] = useState<number>(5);
  const [taskType, setTaskType] = useState<"single" | "daily" | "weekly" | "monthly" | "regular">("regular");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("2026-06-30");
  const [assignedUids, setAssignedUids] = useState<string[]>(["all"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kid submission form state
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [subNote, setSubNote] = useState("");
  const [selectedMood, setSelectedMood] = useState("😊 我完成了");

  // Reject reason dialog state
  const [selectedRejectTaskId, setSelectedRejectTaskId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Approve confirmation dialog state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [taskToApprove, setTaskToApprove] = useState<Task | null>(null);
  const [parentEncouragementInput, setParentEncouragementInput] = useState("");

  const isParent = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PARENT;
  const kids = useMemo(() => familyMembers.filter((m) => m.role === UserRole.KID), [familyMembers]);

  // Compute status helpers
  const getTaskStatusInfo = (task: Task) => {
    if (task.status === TaskStatus.APPROVED) {
      return { label: "已完成", colorBg: "bg-emerald-50 text-[#3F8C62] border-emerald-250", dot: "🟢" };
    }
    if (task.status === TaskStatus.SUBMITTED) {
      return { label: "等待家長確認", colorBg: "bg-amber-50 text-amber-700 border-amber-250", dot: "🟡" };
    }
    if (task.status === TaskStatus.REJECTED) {
      return { label: "需要重新努力", colorBg: "bg-rose-50 text-rose-700 border-rose-250", dot: "🔴" };
    }

    return { label: "進行中", colorBg: "bg-indigo-50 text-indigo-700 border-indigo-250", dot: "🔵" };
  };

  const getTaskTypeLabel = (type?: string) => {
    switch (type) {
      case "regular":
        return "⭐ 常態任務";
      case "daily":
        return "🔄 每日任務";
      case "weekly":
        return "📅 每週任務";
      case "monthly":
        return "📆 每月任務";
      case "single":
      default:
        return "📌 單次任務";
    }
  };

  const getAssignedNames = (assignedTo: string) => {
    if (assignedTo === "all" || !assignedTo) return "全體孩子";
    const uids = assignedTo.split(",");
    const names = uids
      .map((uid) => familyMembers.find((m) => m.uid === uid)?.displayName || uid)
      .filter(Boolean);
    return names.join("、");
  };

  // Filter tasks
  const availableTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (currentUser.role === UserRole.KID) {
        const assigns = t.assignedTo || "all";
        if (assigns !== "all" && !assigns.split(",").includes(currentUser.uid)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, currentUser]);

  const combatZoneTasks = useMemo(() => {
    return availableTasks.filter((t) => t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.SUBMITTED);
  }, [availableTasks]);

  const submittedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== TaskStatus.SUBMITTED) return false;
      if (currentUser.role === UserRole.KID) {
        return t.submitterUid === currentUser.uid || t.assignedTo === currentUser.uid;
      }
      return true;
    });
  }, [tasks, currentUser]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status !== TaskStatus.APPROVED) return false;
        if (currentUser.role === UserRole.KID) {
          return t.submitterUid === currentUser.uid || t.assignedTo?.split(",").includes(currentUser.uid);
        }
        return true;
      })
      .sort((a, b) => (b.approvedAt?.seconds || 0) - (a.approvedAt?.seconds || 0));
  }, [tasks, currentUser]);

  // Form setup methods
  const handleOpenAddForm = () => {
    setEditingTask(null);
    setTaskTitle("");
    setRequirement("");
    setStarsReward(5);
    setTaskType("regular");
    setStartDate(todayStr);
    setEndDate("2026-06-30");
    if (kids.length === 1) {
      setAssignedUids([kids[0].uid]);
    } else {
      setAssignedUids(["all"]);
    }
    setShowAddForm(true);
  };

  const handleOpenEditForm = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setRequirement(task.requirement);
    setStarsReward(task.starsReward);
    setTaskType(task.taskType || "regular");
    setStartDate(task.startDate || todayStr);
    setEndDate(task.endDate || "2026-06-30");

    if (task.assignedTo === "all" || !task.assignedTo) {
      setAssignedUids(["all"]);
    } else {
      setAssignedUids(task.assignedTo.split(","));
    }
    setShowAddForm(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !requirement.trim() || starsReward <= 0) return;
    setIsSubmitting(true);
    try {
      let targetStr = "all";
      if (kids.length === 1) {
        targetStr = kids[0].uid;
      } else {
        targetStr = assignedUids.includes("all") || assignedUids.length === 0
          ? "all"
          : assignedUids.filter((u) => u !== "all").join(",");
      }

      const payload = {
        title: taskTitle.trim(),
        requirement: requirement.trim(),
        starsReward,
        assignedTo: targetStr,
        taskType,
        startDate: taskType === "regular" ? "" : startDate,
        endDate: taskType === "regular" ? "" : endDate,
      };

      if (editingTask) {
        if (onEditTask) {
          await onEditTask(editingTask.id, payload);
        }
      } else {
        await onAddTask({
          ...payload,
          familyId: currentUser.familyId || "",
        } as any);
      }

      setTaskTitle("");
      setRequirement("");
      setStarsReward(5);
      setTaskType("regular");
      setStartDate(todayStr);
      setEndDate("2026-06-30");
      setAssignedUids(["all"]);
      setShowAddForm(false);
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSubmit = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSubNote("");
    setSelectedMood("😊 我完成了");
    setShowSubmitForm(true);
  };

  const handleSendSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    setIsSubmitting(true);
    try {
      await onSubmitTask(selectedTaskId, subNote.trim(), selectedMood);
      setShowSubmitForm(false);
      setSelectedTaskId("");
      setSubNote("");
      setSelectedMood("😊 我完成了");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApproveModal = (task: Task) => {
    setTaskToApprove(task);
    setParentEncouragementInput("");
    setShowApproveModal(true);
  };

  const handleConfirmApprove = async () => {
    if (!taskToApprove) return;
    const task = taskToApprove;
    const finalStars = systemMode === SystemMode.EXAM ? task.starsReward * 2 : task.starsReward;
    try {
      const targetUserUid = task.submitterUid || (task.assignedTo === "all" ? currentUser.uid : task.assignedTo.split(",")[0] || currentUser.uid);
      await onApproveTask(task.id, targetUserUid, finalStars, currentUser.displayName, parentEncouragementInput.trim());
      setShowApproveModal(false);
      setTaskToApprove(null);
      setParentEncouragementInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenReject = (taskId: string) => {
    setSelectedRejectTaskId(taskId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleSendRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRejectTaskId || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onRejectTask(selectedRejectTaskId, rejectReason.trim());
      setShowRejectModal(false);
      setSelectedRejectTaskId("");
      setRejectReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAssignee = (uid: string) => {
    if (uid === "all") {
      setAssignedUids(["all"]);
    } else {
      let filtered = assignedUids.filter((item) => item !== "all");
      if (filtered.includes(uid)) {
        filtered = filtered.filter((item) => item !== uid);
      } else {
        filtered.push(uid);
      }
      if (filtered.length === 0) {
        setAssignedUids(["all"]);
      } else {
        setAssignedUids(filtered);
      }
    }
  };

  return (
    <div id="task-system-module" className="bg-[#FAFDFB] rounded-[24px] border border-[#DEEFE5] p-6 lg:p-8 soft-journal-shadow space-y-6">
      {/* Module Title Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E8F5EE] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#EEF9F3] text-[#3F8C62] rounded-2xl border border-[#D0EDE0]">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#32453A] font-sans">日常學習與事項任務</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">指派日常任務、累積過關星星、與孩子完成約定吧</p>
          </div>
        </div>

        {isParent && (
          <button
            id="add-task-btn"
            onClick={handleOpenAddForm}
            className="flex items-center gap-2 text-md font-black text-white bg-[#47A875] hover:bg-[#3D9265] px-5 py-3 rounded-full transition cursor-pointer soft-journal-shadow transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" /> <span>新增任務事項</span>
          </button>
        )}
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-[#E8F5EE] gap-1 select-none font-sans">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-5 py-3 text-sm font-extrabold border-b-2 transition ${
            activeTab === "available"
              ? "border-[#47A875] text-[#3D9265]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          } cursor-pointer`}
        >
          任務作戰區 ({combatZoneTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("submitted")}
          className={`px-5 py-3 text-sm font-extrabold border-b-2 transition ${
            activeTab === "submitted"
              ? "border-[#47A875] text-[#3D9265]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          } cursor-pointer`}
        >
          孩子待確認任務 ({submittedTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3 text-sm font-extrabold border-b-2 transition ${
            activeTab === "history"
              ? "border-[#47A875] text-[#3D9265]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          } cursor-pointer`}
        >
          我的成長紀錄 ({completedTasks.length})
        </button>
      </div>

      {/* Tab: Available Tasks */}
      {activeTab === "available" && (
        <div id="available-tasks-list" className="space-y-4">
          {combatZoneTasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#DEEFE5] rounded-[24px] bg-white">
              <Compass className="h-12 w-12 text-[#47A875]/35 mx-auto mb-3 animate-pulse" />
              <p className="text-base text-gray-500 font-sans font-bold">目前沒有指派中的任務項目喔</p>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
                管理員或家長可以在右上角點擊「新增任務事項」來分配打掃、畫畫、自學英文或任何好寶寶習慣任務！
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {combatZoneTasks.map((task) => {
                const isRejected = task.status === TaskStatus.REJECTED;
                const statusInfo = getTaskStatusInfo(task);

                return (
                  <div
                    key={task.id}
                    style={{
                      border: "1px solid #E9E2DB",
                      borderRadius: "24px",
                      background: "#FFFFFF",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                    }}
                    className={`p-6 relative flex flex-col justify-between min-h-[220px] transition duration-200 hover:-translate-y-0.5 ${
                      isRejected ? "border-rose-100 bg-rose-50/5 animate-fade-in" : ""
                    }`}
                  >
                    <div>
                      {/* Status and Type Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 pr-20">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-full border ${statusInfo.colorBg}`}>
                            <span>{statusInfo.dot}</span>
                            <span>{statusInfo.label}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-50 rounded-md border border-gray-200/50 font-sans">
                            {getTaskTypeLabel(task.taskType)}
                          </span>
                        </div>
                      </div>

                      {/* Upper right action buttons - always visible on all task cards for parent */}
                      {isParent && (
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 select-none z-10 text-[10px] font-sans">
                          <button
                            onClick={() => handleOpenEditForm(task)}
                            className="p-1.5 text-xs font-black text-[#5B7283] hover:text-[#3D9265] bg-[#FAFDFB] border border-gray-250/50 hover:bg-emerald-55/40 hover:border-emerald-200 rounded-xl transition cursor-pointer flex items-center gap-0.5 shadow-sm"
                            title="編輯任務"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>編輯</span>
                          </button>
                          <button
                            onClick={() => {
                              setDeletingTaskId(task.id);
                            }}
                            className="p-1.5 text-xs font-black text-gray-400 hover:text-red-500 hover:bg-rose-50 border border-gray-150 rounded-xl transition cursor-pointer flex items-center gap-0.5 shadow-sm"
                            title="刪除任務"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>刪除</span>
                          </button>
                        </div>
                      )}

                      {/* Header block with stars */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 font-sans">
                          {isRejected && (
                            <span className="inline-block text-[10px] font-sans font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md mb-1 animate-pulse">
                              🚨 人員請再努力：
                            </span>
                          )}
                          <h3 className="font-extrabold text-gray-800 text-base leading-snug">{task.title}</h3>
                          
                          <div className="text-xs text-gray-500 font-extrabold mt-1">
                            對象：{task.assignedTo === "all" ? "全體孩子" : familyMembers.find(m => m.uid === task.assignedTo)?.displayName || "全體孩子"}
                          </div>

                          <p className="text-xs text-gray-500 mt-2.5 leading-relaxed whitespace-pre-wrap bg-[#FAF9F6] p-2.5 rounded-xl border border-[#FAF3E5] font-medium text-[#4C433D]">
                            🎯 達成條件：{task.requirement}
                          </p>
                        </div>

                        {/* Stars cost block */}
                        <div className="text-right flex-shrink-0 font-sans">
                          <span className="inline-flex items-center gap-1 text-amber-500 font-black text-xs bg-amber-50/55 border border-amber-150 rounded-xl px-2.5 py-1.5 shadow-sm">
                            ★ {task.starsReward} 星
                          </span>
                          {systemMode === SystemMode.EXAM && (
                            <div className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg mt-1 border border-rose-100">
                              加倍 2x
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Inline form or message for Kid Re-submission */}
                      {isRejected && (
                        <div className="mt-4 p-4 rounded-2xl bg-[#FFF5F5] border border-rose-100/50 space-y-3 font-sans">
                          <div className="flex items-center gap-1.5 font-black text-xs text-rose-700">
                            <span>🔴 再努力一次</span>
                          </div>
                          {task.rejectionNote && (
                            <div className="text-xs text-gray-700 bg-white/80 p-2.5 rounded-xl border border-gray-150">
                              <span className="font-extrabold text-[#7C6354] block mb-1">退回原因：</span>
                              <span className="text-[#3C332D] font-bold">{task.rejectionNote}</span>
                            </div>
                          )}
                          
                          {currentUser.role === UserRole.KID && (
                            <div className="space-y-2 mt-2">
                              <label className="block text-[11px] font-black text-[#3C332D]">重新送出心得：</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="請寫下這次的努力心得..."
                                  id={`re-submit-note-${task.id}`}
                                  className="flex-grow text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <button
                                  onClick={async () => {
                                    const inputEl = document.getElementById(`re-submit-note-${task.id}`) as HTMLInputElement;
                                    const note = inputEl?.value?.trim();
                                    if (!note) return;
                                    await onSubmitTask(task.id, note);
                                  }}
                                  className="shrink-0 bg-red-500 hover:bg-red-600 text-white text-[11px] font-extrabold px-3.5 py-2 rounded-xl shadow-sm transition cursor-pointer"
                                >
                                  再次送出
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Timeline bottom bar */}
                    <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
                      <div className="flex flex-col gap-0.5 text-gray-400 font-bold">
                        {task.taskType === "regular" ? (
                          <span className="flex items-center gap-1 text-[#47A875] font-extrabold text-[11px] mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-[#47A875]/80" />
                            <span>永久有效</span>
                          </span>
                        ) : (
                          task.startDate && (
                            <span className="flex items-center gap-1 text-gray-400 font-mono text-[11px] mt-0.5">
                              <Calendar className="h-3.5 w-3.5 text-gray-300" />
                              <span>{task.startDate.replace(/-/g, "/")} ~ {task.endDate?.replace(/-/g, "/")}</span>
                            </span>
                          )
                        )}
                      </div>

                      {/* Completion action for kids */}
                      {currentUser.role === UserRole.KID && !isRejected && (
                        <button
                          onClick={() => handleOpenSubmit(task.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4.5 py-2.5 rounded-full shadow-md hover:shadow-lg transition cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          ✅ 我完成了！
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Submitted Tasks awaiting parent verification */}
      {activeTab === "submitted" && (
        <div id="submitted-tasks-list" className="space-y-4 animate-in fade-in duration-150 font-sans">
          {submittedTasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#DEEFE5] rounded-[24px] bg-white">
              <Clock className="h-12 w-12 text-amber-500/35 mx-auto mb-3" />
              <p className="text-base text-gray-500 font-sans font-bold">目前沒有等待確認的任務喔</p>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
                當孩子完成某項任務、送出心得完成回報後，這裡將立即出現卡片供家長確認並核發大大的進度星星。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submittedTasks.map((task) => {
                const kidDoc = familyMembers.find((m) => m.uid === task.submitterUid || m.uid === task.assignedTo);
                const starsCount = systemMode === SystemMode.EXAM ? task.starsReward * 2 : task.starsReward;

                return (
                  <div
                    key={task.id}
                    style={{
                      border: "1px solid #E9E2DB",
                      borderRadius: "24px",
                      background: "#FFFFFF",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                    }}
                    className="p-6 relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition"
                  >
                    {/* Edit/Delete if admin on submitted tab */}
                    {isParent && (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 select-none z-10 text-[10px]">
                        <button
                          onClick={() => handleOpenEditForm(task)}
                          className="p-1.5 text-xs font-black text-[#5B7283] hover:text-[#3D9265] bg-[#FAFDFB] border border-gray-150 rounded-xl transition cursor-pointer flex items-center gap-0.5 shadow-sm"
                          title="編輯任務"
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          onClick={() => {
                            setDeletingTaskId(task.id);
                          }}
                          className="p-1.5 text-xs font-black text-gray-400 hover:text-red-500 hover:bg-rose-50 border border-gray-150 rounded-xl transition cursor-pointer flex items-center gap-0.5 shadow-sm"
                          title="刪除任務"
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    )}

                    <div className="space-y-4 flex-grow max-w-4xl pr-20">
                      {/* Family card title */}
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎉</span>
                        <h3 className="font-extrabold text-[#3C332D] text-lg">
                          <b>{kidDoc?.displayName || "小孩"}</b> 完成任務囉！
                        </h3>
                      </div>

                      {/* Submitted detail box */}
                      <div className="bg-[#FAF8F5]/60 p-4.5 rounded-2xl border border-[#FAF0E6] space-y-3.5">
                        <div className="text-sm font-black text-[#3C332D] flex items-center gap-1.5">
                          <span className="text-gray-400 font-bold">任務：</span>
                          <span>{task.title}</span>
                        </div>

                        {/* Child Mood (Fast button choice) */}
                        <div className="text-xs text-gray-700 bg-white border border-gray-150 px-4 py-3 rounded-xl font-medium leading-relaxed shadow-xs">
                          <span className="text-emerald-600 font-extrabold block mb-1">孩子心情：</span>
                          <span className="text-[#3C332D] font-extrabold text-sm">{task.childMood || "😊 我完成了"}</span>
                        </div>

                        {/* Supplementary content or fallback */}
                        <div className="text-xs text-gray-700 bg-white border border-gray-150 px-4 py-3 rounded-xl font-medium leading-relaxed shadow-xs">
                          <span className="text-indigo-600 font-extrabold block mb-1">補充內容：</span>
                          {task.submissionNote && task.submissionNote.trim() !== "" ? (
                            <span className="text-[#3E3A35] font-black">{task.submissionNote}</span>
                          ) : (
                            <span className="text-gray-400 italic font-semibold">未填寫補充內容</span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-[#7C6354] flex items-center gap-1">
                          <span className="text-base">⏳</span>
                          <span className="text-amber-600 font-extrabold">等待家長確認</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 w-full sm:w-auto md:w-[150px] self-stretch justify-center items-center">
                      <div className="text-center">
                        <span className="text-[10px] font-black text-gray-400 block mb-0.5">可獲得</span>
                        <span className="text-amber-550 font-black text-xs bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1">
                          ★ {starsCount} 星
                        </span>
                      </div>

                      {isParent ? (
                        <div className="w-full space-y-2 mt-2">
                          <button
                            onClick={() => handleOpenReject(task.id)}
                            className="w-full bg-white border border-rose-250 hover:bg-[#FAF9F5] text-red-500 text-xs font-black py-2.5 px-3 rounded-xl transition cursor-pointer text-center hover:border-red-150"
                          >
                            再努力一次
                          </button>
                          <button
                            onClick={() => handleOpenApproveModal(task)}
                            className="w-full bg-[#47A875] hover:bg-[#3D9265] text-white text-xs font-black py-2.5 px-3 rounded-xl shadow-sm hover:shadow-md transition cursor-pointer text-center"
                          >
                            確認完成
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl animate-pulse mt-2">
                          等待家長確認中
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Growth History memories album */}
      {activeTab === "history" && (
        <div id="task-completed-history" className="animate-in fade-in duration-150 space-y-6">
          {completedTasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#DEEFE5] rounded-[24px] bg-white text-sans">
              <Compass className="h-12 w-12 text-[#47A875]/35 mx-auto mb-3 animate-pulse" />
              <p className="text-base text-gray-500 font-sans font-bold">目前還沒有完成過關記錄喔</p>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
                完成任務後，家長點選「確認完成」便能把學習與進步心得儲存到這本成長記錄本中囉！📖
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-emerald-100 ml-4 pl-6 md:pl-8 space-y-6 font-sans">
              {completedTasks.map((task) => {
                const kid = familyMembers.find((m) => m.uid === task.submitterUid || m.uid === task.assignedTo);
                const approveDate = task.approvedAt?.seconds
                  ? new Date(task.approvedAt.seconds * 1000).toLocaleString("zh-TW", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "剛剛";

                return (
                  <div
                    key={task.id}
                    className="relative pb-2"
                  >
                    {/* timeline node dot */}
                    <div className="absolute -left-[35px] md:-left-[43px] top-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500 flex items-center justify-center text-white ring-4 ring-emerald-50 shadow" />

                    <div className="bg-white border border-[#D0EDE0] rounded-2xl p-5 hover:border-emerald-300 hover:shadow-xs transition relative">
                      {/* Trash/delete action for admin and parent */}
                      {isParent && (
                        <button
                          onClick={() => setDeletingTaskId(task.id)}
                          className="absolute top-4 right-4 text-xs font-black text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 rounded-xl px-2.5 py-1.5 transition cursor-pointer flex items-center gap-1 shadow-xs"
                          title="刪除紀錄"
                        >
                          🗑 刪除紀錄
                        </button>
                      )}

                      <div className="flex flex-col gap-2.5">
                        {/* Rating stars & Task Name */}
                        <div className="flex flex-wrap items-center gap-2 pr-28">
                          <span className="text-amber-600 font-black text-xs bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-0.5">
                            ⭐ +{task.starsReward}星
                          </span>
                          <h4 className="text-sm font-extrabold text-[#32453A]">{task.title}</h4>
                        </div>

                        {/* Record time & Kid Name */}
                        <div className="text-xs text-gray-400 font-mono font-bold flex items-center gap-2">
                          <span>{approveDate}</span>
                          {kid && (
                            <span className="text-[#3F8C62] bg-[#EEF9F3] border border-[#DEEFE5] px-2 py-0.2 rounded text-[10px] uppercase tracking-wider font-sans">
                              {kid.displayName}
                            </span>
                          )}
                        </div>

                        {/* Custom content details - timeline styled */}
                        <div className="mt-2 space-y-2.5 border-t border-[#F2ECE5]/30 pt-3 text-xs leading-relaxed">
                          <div className="text-gray-700">
                            <span className="font-extrabold text-[#5B7283] block">孩子心情：</span>
                            <span className="text-[#3C332D] font-extrabold bg-[#FAFDFB] px-3.5 py-1.5 rounded-xl mt-1 border border-dashed border-[#DEEFE5] inline-block">{task.childMood || "😊 我完成了"}</span>
                          </div>

                          <div className="text-gray-700">
                            <span className="font-extrabold text-[#5B7283] block">補充內容：</span>
                            {task.submissionNote && task.submissionNote.trim() !== "" ? (
                              <p className="text-[#3E3A35] font-semibold bg-[#FAFDFB] p-2 rounded-xl mt-0.5 border border-dashed border-[#DEEFE5]/50 whitespace-pre-wrap">{task.submissionNote}</p>
                            ) : (
                              <p className="text-gray-400 italic bg-[#FAFDFB] p-2 rounded-xl mt-0.5 border border-dashed border-[#DEEFE5]/50 font-semibold">未填寫補充內容</p>
                            )}
                          </div>

                          {task.parentEncouragement && (
                            <div className="text-emerald-800">
                              <span className="font-extrabold text-[#3F8C62] block">家長鼓勵：</span>
                              <p className="text-gray-800 font-semibold bg-[#EEF9F3]/60 p-2.5 rounded-xl border border-[#D0EDE0]/50 mt-0.5 whitespace-pre-wrap">{task.parentEncouragement}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deletion confirmation dialog absolute popup overlay */}
          {deletingTaskId && (
            (() => {
              const targetTask = tasks.find((t) => t.id === deletingTaskId);
              const isApproved = targetTask?.status === "approved";
              const stars = targetTask?.starsReward || 0;
              const title = targetTask?.title || "";

              return (
                <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none font-sans">
                  <div className="bg-white rounded-[24px] border border-rose-100 p-6 lg:p-8 max-w-sm w-full shadow-2xl relative text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-xl font-bold">
                      ⚠️
                    </div>
                    
                    {isApproved && stars > 0 ? (
                      <>
                        <h3 className="text-base lg:text-lg font-black text-[#3C332D]">
                          確定要刪除此筆記錄嗎？
                        </h3>
                        <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100/50 font-bold leading-relaxed">
                          此任務已發放 <span className="font-mono text-sm font-black">{stars}</span> 顆星星。<br/>
                          是否同步回收星星？
                        </p>
                        
                        <div className="flex flex-col gap-2 pt-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await onDeleteTask(deletingTaskId, true);
                              } catch (err) {
                                console.error("Error recycling stars:", err);
                              } finally {
                                setDeletingTaskId(null);
                              }
                            }}
                            className="w-full py-2.5 px-4 text-xs font-black text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition shadow-sm cursor-pointer"
                          >
                            【刪除並回收星星】
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await onDeleteTask(deletingTaskId, false);
                              } catch (err) {
                                console.error("Error deleting record only:", err);
                              } finally {
                                setDeletingTaskId(null);
                              }
                            }}
                            className="w-full py-2.5 px-4 text-xs font-black text-gray-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 rounded-xl transition cursor-pointer"
                          >
                            【只刪除紀錄】
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTaskId(null)}
                            className="w-full py-2 px-4 text-xs font-bold text-gray-400 hover:text-gray-600 rounded-xl transition hover:bg-gray-50 cursor-pointer"
                          >
                            【取消】
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base lg:text-lg font-black text-[#3C332D]">
                          確定要刪除「{title}」嗎？
                        </h3>
                        <p className="text-xs text-gray-450 font-semibold">
                          刪除後此筆紀錄與成長歷程將無法復原唷。
                        </p>
                        
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setDeletingTaskId(null)}
                            className="flex-1 px-4 py-2.5 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-xl transition cursor-pointer"
                          >
                            【取消】
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await onDeleteTask(deletingTaskId, false);
                              } catch (err) {
                                console.error("Error deleting task:", err);
                              } finally {
                                setDeletingTaskId(null);
                              }
                            }}
                            className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-xs cursor-pointer"
                          >
                            【確認刪除】
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Editor Modal for Adding/Editing Task */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] border border-[#DEEFE5] p-8 max-w-md w-full shadow-2xl relative font-sans animate-in fade-in duration-150">
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingTask(null);
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer animate-none"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-extrabold text-[#32453A] mb-6 flex items-center gap-2">
              <Plus className="h-6 w-6 text-emerald-600" />
              {editingTask ? "編輯事項任務" : "指派全新項目"}
            </h3>

            <form onSubmit={handleSaveTask} className="space-y-5">
              {/* Template quick fill section */}
              {(() => {
                const taskTemplates = favoriteActivities.filter((t) => {
                  const ut = t.usageType || t.type;
                  return ut === "task" || ut === "both";
                });
                if (taskTemplates.length === 0 || editingTask) return null;
                return (
                  <div className="bg-[#FAFDFB] border border-[#DEEFE5] p-3 rounded-2xl text-xs shadow-inner">
                    <label className="block text-[10px] font-black text-[#32453A] mb-1.5">
                      🎯 選擇常用範本：
                    </label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const t = taskTemplates.find((item) => item.id === val);
                        if (t) {
                          setTaskTitle(t.title);
                          setRequirement(`${t.title}：完成後請記得填寫心得心得喔！`);
                        }
                      }}
                      className="w-full text-xs font-bold border border-[#DEEFE5] bg-white rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- 自常用清單中秒速載入 --</option>
                      {taskTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5">任務名稱 (例如: 收拾書桌、游泳課...)</label>
                <input
                  type="text"
                  required
                  placeholder="請輸入任務名稱"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5">達成判定條件說明</label>
                <textarea
                  required
                  rows={2}
                  placeholder="請清楚說明判定及過關標準"
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-semibold"
                />
              </div>

              {/* Task type repeats and Date selection */}
              <div className="space-y-4 p-4 bg-[#FAF9F5] border border-gray-150 rounded-2xl">
                <div>
                  <label className="block text-xs font-black text-[#32453A] mb-1.5">任務頻率類型</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { label: "⭐ 常態", value: "regular" },
                      { label: "📌 單次", value: "single" },
                      { label: "📅 每日", value: "daily" },
                      { label: "📆 每週", value: "weekly" },
                      { label: "🗓️ 每月", value: "monthly" }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.value}
                        onClick={() => setTaskType(item.value as any)}
                        className={`py-2 px-1 text-[11px] font-black border rounded-xl transition text-center ${
                          taskType === item.value
                            ? "bg-[#47A875] text-white border-[#47A875]"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        } cursor-pointer`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {taskType === "regular" ? (
                  <div className="bg-[#EEF9F3] border border-[#DEEFE5] p-3 rounded-2xl text-[11px] text-[#315E44] font-black text-center leading-relaxed">
                    💡 此任務為長期有效任務，直到家長手動停用或刪除
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">開始日期</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 font-mono bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">結束日期</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 font-mono bg-white font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 mb-1.5">獎勵星星數量</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={starsReward}
                    onChange={(e) => setStarsReward(parseInt(e.target.value) || 1)}
                    className="w-full text-sm font-extrabold border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50/30 text-[#DCA212] font-mono focus:outline-none"
                  />
                </div>

                {/* Kids selection: multi-kids show selection checklist, single-kid hides and auto-binds */}
                {kids.length >= 2 && (
                  <div>
                    <label className="block text-xs font-black text-[#32453A] mb-1.5 flex items-center justify-between">
                      <span>指派目標對象</span>
                      <span className="text-[10px] text-gray-400 font-bold">(可複選)</span>
                    </label>
                    
                    <div className="space-y-2 p-3 bg-white border border-gray-150 rounded-2xl max-h-[140px] overflow-y-auto animate-fade-in">
                      <label className="flex items-center gap-2.5 text-xs font-extrabold text-gray-700 cursor-pointer p-1 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={assignedUids.includes("all")}
                          onChange={() => handleToggleAssignee("all")}
                          className="h-4 w-4 text-[#47A875] rounded cursor-pointer"
                        />
                        <span>全部孩子</span>
                      </label>

                      {kids.map((kid) => {
                        const isChecked = !assignedUids.includes("all") && assignedUids.includes(kid.uid);
                        return (
                          <label key={kid.uid} className="flex items-center gap-2.5 text-xs font-extrabold text-gray-700 cursor-pointer p-1 rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAssignee(kid.uid)}
                              className="h-4 w-4 text-[#47A875] rounded cursor-pointer"
                            />
                            <span>{kid.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTask(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 border rounded-full transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "發佈儲存中..." : editingTask ? "儲存修改" : "指派任務"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation of submission / completed thoughts description form for Kids */}
      {showSubmitForm && (
        <div className="fixed inset-0 bg-[#3C332D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] border border-[#EFEAE2] p-8 max-w-sm w-full soft-journal-shadow relative font-sans">
            <button
              onClick={() => setShowSubmitForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-black text-[#3C332D] mb-5 flex items-center gap-2">
              <Smile className="h-6 w-6 text-[#EAA59E] animate-bounce" />
              任務過關回報！
            </h3>

            <form onSubmit={handleSendSubmission} className="space-y-5">
              {/* Toddler-friendly Mood Selection Buttons */}
              <div className="space-y-2.5">
                <label className="block text-xs font-black text-[#5B7283]">
                  🎈 挑一個你的過關心情：
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "😊 我完成了",
                    "😄 很開心",
                    "🥳 我超棒",
                    "💪 我很努力",
                    "❤️ 我要領星星",
                    "🎉 任務完成"
                  ].map((moodStr) => {
                    const isSelected = selectedMood === moodStr;
                    return (
                      <button
                        type="button"
                        key={moodStr}
                        onClick={() => setSelectedMood(moodStr)}
                        className={`px-3 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 justify-center border-2 cursor-pointer ${
                          isSelected
                            ? "bg-[#EEF9F3] text-[#3F8C62] border-[#47A875] scale-[1.02] shadow-xs"
                            : "bg-[#FFFDF8] text-gray-600 border-[#EFEAE2] hover:bg-gray-50"
                        }`}
                      >
                        {moodStr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional supplementary input field */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-[#5B7283]">
                  💬 還想跟爸爸媽媽說什麼嗎？ <span className="text-gray-400 font-bold">(選填)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="例如：今天考92分、我自己完成的。不填也可以直接送出唷！"
                  value={subNote}
                  onChange={(e) => setSubNote(e.target.value)}
                  className="w-full text-xs border border-[#EFEAE2] rounded-xl px-4 py-3 bg-[#FFFDF8] placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-[#47A875] resize-none font-semibold text-gray-700"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#F7F3EB]">
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2.5 text-xs font-black text-gray-500 hover:bg-[#FFFDF8] border border-[#EFEAE2] rounded-full transition"
                >
                  【取消】
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-black text-white bg-[#EAA59E] hover:bg-[#df938c] rounded-full transition disabled:opacity-50 soft-journal-shadow cursor-pointer"
                >
                  {isSubmitting ? "送出中..." : "【確定完成】"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject with Feedback dialog for parents (再努力一次) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-md w-full shadow-2xl relative font-sans">
            <button
              onClick={() => setShowRejectModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2 font-black">
              <AlertCircle className="h-5 w-5 text-red-500" />
              ⚠️ 請孩子再努力一次
            </h3>

            <form onSubmit={handleSendRejection} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-600 mb-1.5">💡 退回原因與給孩子的小提醒（必填）</label>
                
                {/* Rejection suggestions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    "這次還沒達到90分",
                    "內容還沒完成",
                    "請再檢查一次"
                  ].map((phrase) => (
                    <button
                      type="button"
                      key={phrase}
                      onClick={() => setRejectReason(phrase)}
                      className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/55 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      💡 {phrase}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={3}
                  placeholder="寫下原因... 例如：這次還沒達到90分、內容還沒完成"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none font-sans font-medium"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-xs font-extrabold text-gray-500 hover:bg-[#FAF9F5] border rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "退回中..." : "送出退回"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation approval modal with encouragement and stars */}
      {showApproveModal && taskToApprove && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 animate-fade-in font-sans">
          <div className="bg-white rounded-[24px] border border-[#DEEFE5] p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => {
                setShowApproveModal(false);
                setTaskToApprove(null);
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-700 transition cursor-pointer font-sans text-xs"
            >
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-extrabold text-[#32453A] mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-emerald-600" />
              🎉 確認完成任務
            </h3>

            <div className="p-4 bg-[#EEF9F3] border border-[#DEEFE5] rounded-2xl mb-4 space-y-2 text-xs font-semibold">
              <p className="text-gray-600">獲得星星：<b className="text-amber-600">⭐ {systemMode === SystemMode.EXAM ? taskToApprove.starsReward * 2 : taskToApprove.starsReward} 顆星星</b></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#32453A] mb-1.5 flex items-center justify-between">
                  <span>家長鼓勵：</span>
                </label>

                {/* Encouragement suggestions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    "做得很好！",
                    "這次很認真！",
                    "持續保持！"
                  ].map((word) => (
                    <button
                      type="button"
                      key={word}
                      onClick={() => setParentEncouragementInput(word)}
                      className="text-[11px] font-black text-emerald-700 bg-[#EEF9F3] hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      💝 {word}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="寫一些溫馨的字句鼓勵孩子吧，例如：持續保持！做得太棒了！"
                  value={parentEncouragementInput}
                  onChange={(e) => setParentEncouragementInput(e.target.value)}
                  className="w-full text-sm border border-[#DEEFE5] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowApproveModal(false);
                    setTaskToApprove(null);
                  }}
                  className="px-5 py-2.5 text-xs font-extrabold text-gray-500 hover:bg-gray-50 border rounded-full transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmApprove}
                  className="px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-750 border-none rounded-full shadow-md transition hover:scale-[1.01] cursor-pointer"
                >
                  確認完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
