import clsx from "clsx";
import { ArrowClockwiseRegular, NavigationRegular } from "@fluentui/react-icons";
import { SearchInput } from "@/components/common/SearchInput";
import { TokenBadge } from "@/components/common/TokenBadge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { NavigationPath, SortBy, SortDirection, TokenStatus, ViewMode } from "@/types";

interface ToolbarProps {
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
  onTokenClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  searchActive: boolean;
}

export function Toolbar({
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
  onTokenClick,
  sidebarCollapsed,
  onToggleSidebar,
  searchActive,
}: ToolbarProps) {
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

        <Breadcrumbs
          pathStack={pathStack}
          onNavigate={onNavigateToPath}
          searchActive={searchActive}
          searchQuery={searchQuery}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        <ThemeToggle />
        <TokenBadge status={tokenStatus} onClick={onTokenClick} />
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

