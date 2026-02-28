interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-app-surface p-8 text-center">
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 max-w-xl whitespace-pre-line text-sm text-text-secondary">{description}</p>
      {actionLabel && onAction ? (
        <button
          className="mt-4 rounded border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-app-hover"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

