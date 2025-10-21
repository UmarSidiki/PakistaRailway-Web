import { formatRelativeTime } from '@/utils/time';

type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "error";

type AppTab = "search" | "details" | "stationUpdates" | "stationSchedule";

interface HeaderProps {
  liveCount: number;
  totalCount: number;
  connectionStatus: ConnectionStatus;
  lastSocketEvent?: number;
  lastError?: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasSelectedTrain: boolean;
}

const statusMeta: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: {
    label: "Connected",
    dot: "bg-emerald-500",
  },
  connecting: {
    label: "Connecting…",
    dot: "bg-amber-400 animate-pulse",
  },
  reconnecting: {
    label: "Reconnecting…",
    dot: "bg-amber-500 animate-pulse",
  },
  disconnected: {
    label: "Disconnected",
    dot: "bg-neutral-400",
  },
  error: {
    label: "Error",
    dot: "bg-rose-500 animate-pulse",
  },
};

export const Header = ({
  liveCount,
  totalCount,
  connectionStatus,
  lastSocketEvent,
  lastError,
  activeTab,
  onTabChange,
  hasSelectedTrain,
}: HeaderProps) => {
  const meta = statusMeta[connectionStatus];
  const lastUpdateLabel = formatRelativeTime(lastSocketEvent);

  const tabs: Array<{
    key: AppTab;
    label: string;
    disabled?: boolean;
  }> = [
    { key: "search", label: "Search" },
    { key: "details", label: "Details", disabled: !hasSelectedTrain },
    { key: "stationUpdates", label: "Station Updates" },
    { key: "stationSchedule", label: "Station Schedule" },
  ];

  return (
    <div className="fixed inset-x-2 bottom-2 z-30 sm:inset-x-8 sm:bottom-6 lg:inset-x-32 lg:bottom-8">
      <header className="mx-auto w-full max-w-[1440px] rounded-[20px] sm:rounded-[28px] border border-[color:var(--stroke)] bg-[#fff7ed]/90 backdrop-blur-xl shadow-[0_28px_60px_-36px_rgba(94,74,56,0.6)] transition-all">
        <div className="flex w-full flex-col gap-2 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              {/* <h1 className="flex items-center gap-3 text-lg font-semibold text-[color:var(--ink-strong)] sm:text-xl">
                <span className="emoji-badge w-10 h-10 text-xl" data-tone="amber" aria-hidden="true">
                  🚂
                </span>
                <span className="bg-[linear-gradient(120deg,#2c7f68,#c27a2f)] bg-clip-text text-transparent">
                  PakRail Live
                </span>
              </h1> */}
              <img src="/logo.png" alt="PakRail Live" width={55} className="sm:w-[70px]" />
              <div className="flex items-center gap-1.5 sm:hidden">
                <div className="flex items-center gap-1 rounded-full border border-[#d8e8df] bg-[#eef7f2] px-2 py-1">
                  <span className="emoji-badge w-5 h-5 text-xs" data-tone="emerald" aria-hidden="true">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-6.938-6.49a8.5 8.5 0 0113.876 0M12 12a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  </span>
                  <span className="text-[10px] font-semibold text-[#2c7f68]">
                    {liveCount}/{totalCount}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-[#e5dccd] bg-white px-2 py-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  <span className="text-[10px] font-medium text-[color:var(--ink-muted)]">{meta.label}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[color:var(--ink-muted)] sm:hidden">
              <span>Updated</span>
              <span className="font-semibold text-[color:var(--ink-strong)]">{lastUpdateLabel}</span>
              {lastError && (
                <span className="flex items-center gap-0.5 text-[#b15b62]" title={lastError}>
                  <span className="emoji-badge w-5 h-5 text-xs" data-tone="rose" aria-hidden="true">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </span>
                  <span className="max-w-[100px] truncate">{lastError}</span>
                </span>
              )}
            </div>
            <div className="hidden text-sm font-medium text-[color:var(--ink-muted)] sm:flex sm:items-center sm:gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#bfa687]" aria-hidden="true" />
                <span>Last update</span>
                <span className="font-semibold text-[color:var(--ink-strong)]">{lastUpdateLabel}</span>
              </span>
              {lastError && (
                <span className="flex items-center gap-2 text-[#b15b62]">
                  <span className="emoji-badge w-7 h-7 text-sm" data-tone="rose" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </span>
                  <span className="max-w-[220px] truncate" title={lastError}>{lastError}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <nav className="flex w-full justify-between gap-1 rounded-full border border-[#e4d7c5] bg-[#fff4e4]/80 p-1 shadow-[0_12px_24px_-22px_rgba(95,75,60,0.6)] sm:w-auto sm:justify-start sm:gap-2 sm:p-1.5">
              {tabs.map(({ key, label, disabled }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => !disabled && onTabChange(key)}
                    disabled={disabled}
                    className={`flex-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-all sm:flex-none sm:px-3.5 sm:py-1.5 sm:text-sm ${
                      disabled
                        ? 'cursor-not-allowed bg-[#f2e7d8] text-[#b8aa95]'
                        : isActive
                        ? 'bg-[#2c7f68] text-white shadow-[0_14px_24px_-18px_rgba(44,127,104,0.65)]'
                        : 'bg-[#fffaf1] text-[color:var(--ink-muted)] hover:bg-[#ffeeda]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
            <div className="hidden items-center gap-4 sm:flex">
              <div className="flex items-center gap-2 rounded-full border border-[#d8e8df] bg-[#eef7f2] px-4 py-2">
                <span className="emoji-badge w-8 h-8 text-base" data-tone="emerald" aria-hidden="true">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-6.938-6.49a8.5 8.5 0 0113.876 0M12 12a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c7f68]">Live</span>
                  <span className="text-sm font-bold text-[#2c7f68]">
                    {liveCount}
                    <span className="text-[#6ea895]">/{totalCount}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e5dccd] bg-white px-4 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <span className="text-sm font-medium text-[color:var(--ink-strong)]">{meta.label}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};
