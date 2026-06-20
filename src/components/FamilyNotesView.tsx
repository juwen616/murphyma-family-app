import React, { useState } from "react";
import { FamilyNote, UserProfile, UserRole } from "../types";
import { BookOpen, Calendar, Edit3, Trash2, Plus, X, Search, Clock, Award } from "lucide-react";

interface FamilyNotesViewProps {
  currentUser: UserProfile;
  notes: FamilyNote[];
  onAddNote: (title: string, content: string, date: string) => Promise<void>;
  onUpdateNote: (id: string, title: string, content: string, date: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

export default function FamilyNotesView({
  currentUser,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: FamilyNotesViewProps) {
  const isParent =
    (currentUser.role as any) === "Owner" ||
    (currentUser.role as any) === "Parent" ||
    (currentUser.role as any) === "Admin" ||
    currentUser.role === UserRole.OWNER ||
    currentUser.role === UserRole.PARENT;

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<FamilyNote | null>(null);

  // Form states
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const handleOpenAdd = () => {
    setNoteTitle("");
    setNoteContent("");
    const today = new Date();
    setNoteDate(today.toISOString().split("T")[0]);
    setEditingNote(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (note: FamilyNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteDate(note.date || new Date().toISOString().split("T")[0]);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    if (editingNote) {
      await onUpdateNote(editingNote.id, noteTitle, noteContent, noteDate);
    } else {
      await onAddNote(noteTitle, noteContent, noteDate);
    }
    setShowAddModal(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("確定要刪除這筆家庭記事嗎？這將會永久移除歷史回憶。")) {
      await onDeleteNote(id);
    }
  };

  // Sort notes by date descending, then createdAt descending
  const sortedNotes = [...notes].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    // Fallback to createdAt seconds if available
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  const filteredNotes = sortedNotes.filter((note) => {
    const q = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q) ||
      note.creatorName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 font-sans text-[#3C332D]">
      {/* 🚀 Header */}
      <div className="bg-gradient-to-r from-rose-50/40 to-[#FAF8F4] border border-[#E9E2D8] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-rose-50 rounded-xl">📜</span>
            <div>
              <h2 className="text-sm font-black text-[#2D2926]">家庭記事（歷史回憶紀錄）</h2>
              <p className="text-[10px] text-gray-400 font-bold mt-0.5 leading-tight">
                保留家庭的每一個第一次、共同出遊或珍貴成就，留住美好的回憶軌跡。
              </p>
            </div>
          </div>
          {isParent && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer self-start sm:self-center"
            >
              <Plus className="h-4 w-4" />
              新增記事
            </button>
          )}
        </div>
      </div>

      {/* 🔍 Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="搜尋家庭記事名稱、內容或記錄人..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-9 pr-3 py-2 bg-white border border-[#EFEAE2] rounded-xl text-xs placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
        />
      </div>

      {/* 🗓️ List timeline */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white border border-[#EFEAE2] rounded-3xl p-12 text-center text-gray-400">
          <BookOpen className="h-10 w-10 mx-auto text-gray-300 stroke-[1.5] mb-2" />
          <p className="font-bold text-[#6D5D53] text-xs">目前沒有已紀錄的家庭大事記唷！</p>
          {isParent ? (
            <p className="text-[10px] text-[#A59285] mt-1">
              點擊右上角「新增記事」來記錄下今天家裡的快樂點滴吧 ✨
            </p>
          ) : (
            <p className="text-[10px] text-[#A59285] mt-1">請等待管理員媽媽/爸爸新增回憶記事</p>
          )}
        </div>
      ) : (
        <div className="relative border-l border-rose-200/60 ml-4 pl-6 space-y-4 py-2">
          {filteredNotes.map((note) => {
            const displayDate = note.date ? note.date.replace(/-/g, "/") : "";
            return (
              <div key={note.id} className="relative group animate-in fade-in duration-200">
                {/* Timeline dot */}
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-rose-400 shadow-xs z-10">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                </span>

                {/* Card Container */}
                <div className="bg-white border border-[#EFEAE2] rounded-2xl p-4 shadow-xs hover:shadow-xs transition hover:border-rose-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      {/* Date and Author */}
                      <div className="flex items-center gap-2 border-b border-[#FAF6F0] pb-1.5">
                        <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" /> {displayDate}
                        </span>
                        <span className="text-[10px] font-bold text-gray-405 flex items-center gap-1 font-sans">
                          ✍️ {note.creatorName} 記錄
                        </span>
                      </div>
                      
                      {/* Title */}
                      <h4 className="text-xs font-black text-[#2D2926] leading-snug flex items-center gap-1.5">
                        🌟 {note.title}
                      </h4>

                      {/* Content */}
                      {note.content && (
                        <p className="text-[10.5px] text-gray-550 leading-relaxed whitespace-pre-wrap font-sans">
                          {note.content}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {isParent && (
                      <div className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleOpenEdit(note)}
                          className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="編輯記事"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="刪除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📝 Dialog Modal for CRUD */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
          <div className="bg-[#FCFAF7] border border-[#E9E2D8] rounded-3xl p-5 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto pb-[max(20px,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-150 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">✍️</span>
              <div>
                <h3 className="text-xs font-black text-[#2D2926]">
                  {editingNote ? "🔧 編輯歷史記事" : "✨ 新增家庭記事"}
                </h3>
                <p className="text-[10px] text-gray-400">保留家庭點滴，為家庭生活增添儀式感</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block font-black text-gray-700">1. 記事日期：</label>
                <input
                  type="date"
                  required
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full p-2 bg-white border border-[#EFEAE2] rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-black text-gray-700">2. 回憶標題（事件名稱）：</label>
                <input
                  type="text"
                  required
                  placeholder="例如：小龜第一次自己整理房間 / 峇里島旅行圓滿完成"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full p-2 bg-white border border-[#EFEAE2] rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-black text-gray-700">3. 詳細紀錄或心得（選填）：</label>
                <textarea
                  placeholder="詳細紀錄一下有趣的點滴吧，以後回頭看會非常有畫面唷..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  className="w-full p-2 bg-white border border-[#EFEAE2] rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-rose-500 whitespace-pre-wrap leading-relaxed resize-none"
                />
              </div>

              <div className="pt-2 border-t border-[#FAF6F0] flex justify-end gap-2 text-xs font-sans">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-1.5 px-3 bg-white border border-gray-250 text-gray-500 hover:bg-gray-50 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition shadow-xs"
                >
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
