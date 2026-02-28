import clsx from "clsx";
import type { Channel, GraphUser, Team } from "@/types";
import { Avatar } from "@/components/common/Avatar";

interface SidebarProps {
  user: GraphUser;
  photoUrl?: string | null;
  teams: Team[];
  channels: Channel[];
  teamsLoading: boolean;
  channelsLoading: boolean;
  channelsError?: string | null;
  selectedTeam: Team | null;
  selectedChannel: Channel | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectTeam: (team: Team) => void;
  onSelectChannel: (channel: Channel) => void;
  onSignOut: () => void;
}

export function Sidebar({
  user,
  photoUrl,
  teams,
  channels,
  teamsLoading,
  channelsLoading,
  channelsError,
  selectedTeam,
  selectedChannel,
  collapsed,
  onToggleCollapse,
  onSelectTeam,
  onSelectChannel,
  onSignOut,
}: SidebarProps) {
  const appTitle = import.meta.env.VITE_APP_TITLE ?? "ICC-LAB Files";

  return (
    <aside
      className={clsx(
        "border-r border-border-default bg-app-sidebar transition-all duration-200",
        collapsed ? "w-0 overflow-hidden" : "w-60",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border-default p-3">
          <Avatar name={user.displayName} imageSrc={photoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-[0.5px] text-text-tertiary">{appTitle}</p>
            <p className="truncate text-sm font-semibold text-text-primary">{user.displayName}</p>
            <p className="truncate text-xs text-text-secondary">{user.mail || user.userPrincipalName}</p>
          </div>
          <button
            type="button"
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>

        <div className="border-b border-border-default p-2">
          <button
            type="button"
            className="w-full rounded border border-border-default px-2 py-1 text-left text-sm text-text-secondary transition hover:bg-app-hover"
            onClick={onToggleCollapse}
          >
            {collapsed ? "Expand" : "Collapse"} sidebar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.5px] text-text-tertiary">
            Teams
          </p>

          {teamsLoading ? (
            <p className="px-2 text-sm text-text-secondary">Loading teams...</p>
          ) : teams.length > 0 ? (
            <ul className="space-y-1">
              {teams.map((team) => {
                const active = selectedTeam?.id === team.id;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      className={clsx(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
                        active
                          ? "bg-accent-light text-text-primary"
                          : "text-text-secondary hover:bg-app-hover hover:text-text-primary",
                      )}
                      onClick={() => onSelectTeam(team)}
                    >
                      <TeamBadge name={team.displayName} active={active} />
                      <span className="truncate">{team.displayName}</span>
                    </button>

                    {active ? (
                      <div className="mt-1 pl-8">
                        <p className="mb-1 text-[11px] uppercase tracking-[0.5px] text-text-tertiary">
                          Channels
                        </p>
                        {channelsLoading ? (
                          <p className="text-xs text-text-secondary">Loading channels...</p>
                        ) : channelsError ? (
                          <p className="text-xs text-token-expired">{channelsError}</p>
                        ) : channels.length > 0 ? (
                          <ul className="space-y-1">
                            {channels.map((channel) => {
                              const channelActive = selectedChannel?.id === channel.id;
                              return (
                                <li key={channel.id}>
                                  <button
                                    type="button"
                                    className={clsx(
                                      "w-full truncate rounded px-2 py-1 text-left text-xs transition",
                                      channelActive
                                        ? "bg-app-selected text-text-primary"
                                        : "text-text-secondary hover:bg-app-hover hover:text-text-primary",
                                    )}
                                    onClick={() => onSelectChannel(channel)}
                                  >
                                    # {channel.displayName}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-text-secondary">No channels available.</p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 text-sm text-text-secondary">No teams available.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

interface TeamBadgeProps {
  name: string;
  active: boolean;
}

function TeamBadge({ name, active }: TeamBadgeProps) {
  const initials = name
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={clsx(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        active ? "bg-accent-primary text-white" : "bg-app-surface text-text-secondary",
      )}
    >
      {initials || "T"}
    </span>
  );
}

