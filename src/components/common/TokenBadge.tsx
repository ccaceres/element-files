import clsx from "clsx";
import { KeyRegular } from "@fluentui/react-icons";
import type { TokenStatus } from "@/types";

interface TokenBadgeProps {
  status: TokenStatus;
  onClick: () => void;
}

const statusLabel: Record<TokenStatus, string> = {
  valid: "Token valid",
  expiring: "Token expiring soon",
  expired: "Token expired",
  none: "No token",
};

const statusClass: Record<TokenStatus, string> = {
  valid: "text-token-valid",
  expiring: "text-token-warning",
  expired: "text-token-expired",
  none: "text-text-tertiary",
};

export function TokenBadge({ status, onClick }: TokenBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded border border-border-default bg-app-surface px-2 py-1 text-xs transition hover:bg-app-hover",
        statusClass[status],
      )}
      title={statusLabel[status]}
      aria-label="Update token"
    >
      <KeyRegular fontSize={14} />
      <span>{statusLabel[status]}</span>
    </button>
  );
}

