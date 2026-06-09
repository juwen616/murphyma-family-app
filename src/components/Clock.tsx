import { useState, useEffect } from "react";

export default function Clock() {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSingleLine = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const weekdayShort = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${date}（${weekdayShort}）${hours}:${minutes}`;
  };

  return (
    <div
      id="top-clock"
      className="font-mono text-[10.5px] sm:text-xs font-black text-[#5B7283] bg-[#FDFCFB] border border-[#EFEAE2] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full select-none shadow-sm flex items-center gap-1.5"
    >
      <span className="text-amber-600">⏱️</span>
      <span className="tabular-nums tracking-tight tracking-wider">
        {formatSingleLine(time)}
      </span>
    </div>
  );
}
