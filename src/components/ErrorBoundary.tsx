import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            background: "#FFF8F6",
            border: "1px dashed #F0C4B8",
            borderRadius: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
          className="p-8 my-6 text-center space-y-4 font-sans max-w-xl mx-auto flex flex-col items-center justify-center min-h-[250px]"
        >
          <div className="h-12 w-12 bg-[#FFF3F0] border border-[#F0C4B8] rounded-full flex items-center justify-center text-xl text-[#C76A5A]">
            ⚠️
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-[#6B4B3E]">此模組載入失敗，請重新整理</h3>
            <p className="text-xs text-gray-500 font-medium max-w-md leading-relaxed">
              系統在執行此元件時遇到一小點狀況，您可以嘗試重新整理瀏覽器。若問題持續發生，請聯絡媽媽管理員。
            </p>
          </div>
          {this.state.error && (
            <div className="bg-white px-3 py-2 rounded-xl text-[10px] text-gray-400 font-mono max-w-full overflow-x-auto select-text break-all border border-gray-100">
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#FAF8F5] border border-[#E8E2D8] text-xs font-black text-[#7C6354] rounded-xl hover:bg-white active:translate-y-0.5 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>重新整理頁面</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
