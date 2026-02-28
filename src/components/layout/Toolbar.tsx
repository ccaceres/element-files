import clsx from "clsx";
import { ArrowClockwiseRegular, NavigationRegular } from "@fluentui/react-icons";
import { SearchInput } from "@/components/common/SearchInput";
import { TokenBadge } from "@/components/common/TokenBadge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type {
  MatrixTokenStatus,
  NavigationPath,
  SortBy,
  SortDirection,
  SyncTab,
  TokenStatus,
  ViewMode,
} from "@/types";

interface ToolbarProps {
  activeTab: SyncTab;
  pathStack: NavigationPath[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortBy;
  sortDirection: SortDirection;
  onSortChange: (sortBy: SortBy) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onNavigateToPath: (index: number) => void;
  onRefresh: () => void;
  tokenStatus: TokenStatus;
  matrixStatus: MatrixTokenStatus;
  onTokenClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  searchActive: boolean;
  syncRunning: boolean;
  mappingCount: number;
  pollIntervalSeconds: number;
}

export function Toolbar({
  activeTab,
  pathStack,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
  onNavigateToPath,
  onRefresh,
  tokenStatus,
  matrixStatus,
  onTokenClick,
  sidebarCollapsed,
  onToggleSidebar,
  searchActive,
  syncRunning,
  mappingCount,
  pollIntervalSeconds,
}: ToolbarProps) {
  const isFiles = activeTab === "files";

  return (
    <header className="border-b border-border-default bg-app-content px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-border-default bg-app-surface px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? "Show" : "Hide"} sidebar
        </button>

        {isFiles ? (
          <Breadcrumbs
            pathStack={pathStack}
            onNavigate={onNavigateToPath}
            searchActive={searchActive}
            searchQuery={searchQuery}
          />
        ) : (
          <div className="inline-flex items-center gap-2 rounded bg-app-surface px-2 py-1 text-sm text-text-secondary">
            <NavigationRegular fontSize={14} />
            <span>Sync dashboard</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isFiles ? (
          <>
            <SearchInput value={searchQuery} onChange={onSearchChange} />

            <div className="inline-flex rounded border border-border-default bg-app-surface p-0.5">
              <button
                type="button"
                className={clsx(
                  "rounded px-2 py-1 text-xs transition",
                  viewMode === "list"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:bg-app-hover",
                )}
                onClick={() => onViewModeChange("list")}
              >
                List
              </button>
              <button
                type="button"
                className={clsx(
                  "rounded px-2 py-1 text-xs transition",
                  viewMode === "grid"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:bg-app-hover",
                )}
                onClick={() => onViewModeChange("grid")}
              >
                Grid
              </button>
            </div>

            <select
              aria-label="Sort files"
              className="rounded border border-border-default bg-app-surface px-2 py-1.5 text-xs text-text-primary outline-none"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as SortBy)}
            >
              <option value="name">Name</option>
              <option value="lastModifiedDateTime">Modified date</option>
              <option value="size">Size</option>
            </select>

            <select
              aria-label="Sort direction"
              className="rounded border border-border-default bg-app-surface px-2 py-1.5 text-xs text-text-primary outline-none"
              value={sortDirection}
              onChange={(event) => onSortDirectionChange(event.target.value as SortDirection)}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>

            <button
              type="button"
              className="rounded border border-border-default bg-app-surface px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
              onClick={onRefresh}
            >
              <ArrowClockwiseRegular fontSize={14} />
              <span className="ml-1">Refresh</span>
            </button>
          </>
        ) : (
          <>
            <span className="rounded border border-border-default bg-app-surface px-2 py-1 text-xs text-text-secondary">
              Sync: {syncRunning ? "running" : "paused"}
            </span>
            <span className="rounded border border-border-default bg-app-surface px-2 py-1 text-xs text-text-secondary">
              Mappings: {mappingCount}
            </span>
            <span className="rounded border border-border-default bg-app-surface px-2 py-1 text-xs text-text-secondary">
              Poll: {pollIntervalSeconds}s
            </span>
          </>
        )}

        <ThemeToggle />
        <TokenBadge status={tokenStatus} onClick={onTokenClick} />
        <span
          className={clsx(
            "rounded border border-border-default px-2 py-1 text-xs",
            matrixStatus === "valid" ? "bg-app-surface text-token-valid" : "bg-app-surface text-text-secondary",
          )}
        >
          Matrix {matrixStatus === "valid" ? "connected" : "missing"}
        </span>
      </div>
    </header>
  );
}

interface BreadcrumbsProps {
  pathStack: NavigationPath[];
  onNavigate: (index: number) => void;
  searchActive: boolean;
  searchQuery: string;
}

function Breadcrumbs({ pathStack, onNavigate, searchActive, searchQuery }: BreadcrumbsProps) {
  if (searchActive) {
    return (
      <div className="inline-flex items-center gap-1 rounded bg-app-surface px-2 py-1 text-sm text-text-secondary">
        <NavigationRegular fontSize={14} />
        <span>Search results for "{searchQuery}"</span>
      </div>
    );
  }

  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="File path breadcrumbs">
      {pathStack.map((segment, index) => {
        const isLast = index === pathStack.length - 1;
        return (
          <div key={`${segment.id}-${segment.name}`} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              className={clsx(
                "truncate rounded px-1 py-0.5",
                isLast
                  ? "cursor-default font-semibold text-text-primary"
                  : "text-text-secondary transition hover:bg-app-hover hover:text-text-primary",
              )}
              disabled={isLast}
              onClick={() => onNavigate(index)}
              title={segment.name}
            >
              {segment.name}
            </button>
            {!isLast ? <span className="text-text-tertiary">/</span> : null}
          </div>
        );
      })}
    </nav>
  );
}
