import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected interface error occurred.",
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application ErrorBoundary caught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-md p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-md bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">U-GOV Workspace Recovery</h1>
                <p className="text-xs text-slate-500">
                  A component encountered an unexpected runtime condition.
                </p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700 break-words">
              {this.state.errorMessage}
            </div>
            <div className="flex justify-end">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#174EA6] text-white text-xs font-bold hover:bg-[#0F397E] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Workspace</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
