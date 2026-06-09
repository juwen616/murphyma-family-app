import React, { useState } from "react";
import { 
  Activity, 
  Settings, 
  Terminal, 
  Clock, 
  RefreshCw, 
  Wifi, 
  User, 
  Key, 
  ChevronUp, 
  ChevronDown 
} from "lucide-react";

interface PerformanceDebugPanelProps {
  loadTimeMs: number;
  queryCount: number;
  listenerCount: number;
  lagSimulated: boolean;
  setLagSimulated: (simulate: boolean) => void;
  currentUserEmail: string;
  currentUserDisplayName: string;
  currentUserRole: string;
  familyId: string | null;
  onResetCounters: () => void;
  onFastRoleSwitch: (role: string, memberId?: string | null) => void;
  familyMembers: Array<{ uid: string; displayName: string; role: string }>;
  simulatedRole: string | null;
  simulatedMemberId: string | null;
  simulatedTodayDate?: string;
  onSetSimulatedTodayDate?: (date: string) => void;
  cacheHitRate: number;
  firestoreLogs?: Array<{
    id: string;
    timestamp: string;
    op: string;
    path: string;
    status: string;
    detail: string;
  }>;
}

export default function PerformanceDebugPanel({
  loadTimeMs,
  queryCount,
  listenerCount,
  lagSimulated,
  setLagSimulated,
  currentUserEmail,
  currentUserDisplayName,
  currentUserRole,
  familyId,
  onResetCounters,
  onFastRoleSwitch,
  familyMembers,
  simulatedRole,
  simulatedMemberId,
  simulatedTodayDate,
  onSetSimulatedTodayDate,
  cacheHitRate,
  firestoreLogs,
}: PerformanceDebugPanelProps) {
  const [isMinimized, setIsMinimized] = useState(true);

  return (
    <div 
      style={{ zIndex: 9999 }}
      className={`fixed bottom-4 right-4 max-w-sm w-full bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 font-mono text-xs ${
        isMinimized ? "h-10 w-44" : "h-[650px]"
      }`}
    >
      {/* Header bar (Toggle minimize) */}
      <div 
        onClick={() => setIsMinimized(!isMinimized)}
        className="h-10 bg-slate-950 px-3.5 flex items-center justify-between cursor-pointer select-none border-b border-slate-800"
      >
        <div className="flex items-center gap-1.5 font-bold text-sky-400">
          <Activity className="h-4 w-4 animate-pulse text-sky-400" />
          <span>效能診斷與開發</span>
        </div>
        <button className="text-slate-400 hover:text-slate-100 transition">
          {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!isMinimized && (
        <div className="p-4 space-y-4 overflow-y-auto h-[610px]">
          {/* Section 1: Performance Diagnostics */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
              <Terminal className="h-3.5 w-3.5 text-sky-400" />
              <span>1. 效能指標 (Metrics)</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">首頁載入時間</span>
                <span className="font-extrabold text-sky-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-400" />
                  {loadTimeMs > 0 ? `${loadTimeMs} ms` : "計算中..."}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">Firestore 監聽數</span>
                <span className="font-extrabold text-indigo-400 mt-1">
                  📡 {listenerCount} 個監聽
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">Firestore 查詢數</span>
                <span className="font-extrabold text-amber-500 mt-1">
                  ⚡ {queryCount} 次讀寫
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">快取命中率</span>
                <span className="font-extrabold text-pink-400 mt-1">
                  💾 {cacheHitRate}% (命中)
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">網路模擬</span>
                <span className="font-extrabold text-teal-400 mt-1">
                  {lagSimulated ? "🟢 慢速 (1.5s)" : "🟢 正常/順暢"}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                <span className="text-slate-500 font-sans text-[10px]">資料庫狀態</span>
                <span className="font-extrabold text-emerald-400 mt-1">
                  📶 連線良好
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onResetCounters}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 px-2 rounded-md transition text-[10px] flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
              >
                <RefreshCw className="h-3 w-3" /> 重設查詢計數
              </button>
              <button
                onClick={() => setLagSimulated(!lagSimulated)}
                className={`flex-1 py-1 px-2 rounded-md transition text-[10px] flex items-center justify-center gap-1 cursor-pointer border ${
                  lagSimulated 
                    ? "bg-rose-950/50 text-rose-350 border-rose-800 hover:bg-rose-900" 
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
              >
                <Wifi className="h-3 w-3" /> {lagSimulated ? "取消延遲模擬" : "模擬慢速網路"}
              </button>
            </div>
          </div>

          {/* Section 2: Environment Info */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
              <Settings className="h-3.5 w-3.5 text-indigo-400" />
              <span>2. 當前連接環境 (Context)</span>
            </h4>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-450 leading-relaxed">
                <span className="flex items-center gap-1 text-slate-500">
                  <User className="h-3 w-3" /> 登入認證:
                </span>
                <span className="text-slate-200 truncate max-w-[200px]" title={currentUserEmail}>
                  {currentUserEmail || "未登入"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-450">
                <span className="flex items-center gap-1 text-slate-500">
                  ⭐ 作為角色:
                </span>
                <span className="font-bold text-indigo-400">
                  {currentUserRole}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-450">
                <span className="flex items-center gap-1 text-slate-500">
                  <Key className="h-3 w-3" /> 家庭組 ID:
                </span>
                <span className="text-teal-400 font-mono select-all truncate max-w-[150px]">
                  {familyId || "N/A (未設定)"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: One-click Testing role Switcher */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
              <Wifi className="h-3.5 w-3.5 text-amber-500" />
              <span>3. 一鍵切換模擬角色 (Fast Switch)</span>
            </h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {[
                  { role: "admin", label: "管理員 (媽媽)" },
                  { role: "parent", label: "家長 (爸爸)" },
                  { role: "kid", label: "小孩" },
                  { role: "pet", label: "萌寵" },
                ].map((item) => (
                  <button
                    key={item.role}
                    onClick={() => onFastRoleSwitch(item.role)}
                    className={`py-1 px-1.5 rounded transition text-left cursor-pointer border ${
                      simulatedRole === item.role && !simulatedMemberId
                        ? "bg-indigo-650/40 text-indigo-300 border-indigo-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    👤 {item.label}
                  </button>
                ))}
              </div>

              {familyMembers.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <span className="text-[10px] text-slate-500 font-sans">成員視角切換:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {familyMembers.map((m) => (
                      <button
                        key={m.uid}
                        onClick={() => onFastRoleSwitch(m.role, m.uid)}
                        className={`py-1 px-1.5 rounded transition text-left cursor-pointer border truncate ${
                          simulatedMemberId === m.uid
                            ? "bg-amber-950/40 text-amber-300 border-amber-500 font-bold"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-100"
                        }`}
                        title={m.displayName}
                      >
                        🎭 {m.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Time Travel Simulator */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
              <Clock className="h-3.5 w-3.5 text-rose-400" />
              <span>4. 時間模擬測試 (Time Travel)</span>
            </h4>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <span className="text-[9px] text-slate-500 font-sans block leading-relaxed">
                變更此日期可自由往返過去與未來，測試不同環境（如：寒暑假、考試週、旅遊日等）與各系統之自動連動。
              </span>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={simulatedTodayDate || ""}
                  onChange={(e) => onSetSimulatedTodayDate?.(e.target.value)}
                  className="flex-grow bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-bold focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={() => {
                    const today = new Date();
                    const y = today.getFullYear();
                    const m = String(today.getMonth() + 1).padStart(2, "0");
                    const d = String(today.getDate()).padStart(2, "0");
                    onSetSimulatedTodayDate?.(`${y}-${m}-${d}`);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded cursor-pointer"
                  title="重設為今天"
                >
                  重設
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Recent Firestore Operational Records */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>5. 最近 Firestore 運作紀錄 (Logs)</span>
            </h4>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
              {!firestoreLogs || firestoreLogs.length === 0 ? (
                <span className="text-[9px] text-slate-500 font-sans block text-center py-4">
                  尚無 API 操作紀錄。
                </span>
              ) : (
                firestoreLogs.map((log) => (
                  <div key={log.id} className="text-[10px] border-b border-slate-900 pb-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[9px] text-slate-500">
                      <span>{log.timestamp}</span>
                      <span className={`px-1 py-0.2 px-1.5 rounded uppercase text-[8px] font-bold ${
                        log.status === "success" 
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50" 
                          : "bg-rose-950/60 text-rose-450 border border-rose-800/50"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-300">
                      <span className="text-amber-500">[{log.op.toUpperCase()}]</span> {log.path}
                    </div>
                    {log.detail && (
                      <div className="text-[9px] text-slate-450 font-sans italic">{log.detail}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
