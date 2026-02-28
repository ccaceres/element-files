import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { DismissRegular, OpenRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { getItemFields, getThumbnailUrl } from "@/api/files";
import { FileIcon } from "@/components/files/FileIcon";
import type { DriveItem } from "@/types";
import { decodeSharePointFieldName, formatAbsoluteDate, formatFileSize } from "@/utils/format";

interface DetailsPanelProps {
  open: boolean;
  item: DriveItem | null;
  driveId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function DetailsPanel({
  open,
  item,
  driveId,
  onOpenChange,
}: DetailsPanelProps) {
  const itemId = item?.id ?? null;

  const fieldsQuery = useQuery({
    queryKey: ["item-fields", driveId, itemId],
    queryFn: () => getItemFields(driveId ?? "", itemId ?? ""),
    enabled: Boolean(open && driveId && itemId),
    staleTime: 60 * 1000,
  });

  const thumbnailQuery = useQuery({
    queryKey: ["thumbnail", driveId, itemId],
    queryFn: () => getThumbnailUrl(driveId ?? "", itemId ?? ""),
    enabled: Boolean(open && driveId && itemId),
    staleTime: 5 * 60 * 1000,
  });

  const fields = fieldsQuery.data;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-40 h-full w-full max-w-md border-l border-border-default bg-app-content p-5 shadow-panel focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-text-primary">Details</Dialog.Title>
            <Dialog.Description className="sr-only">
              File metadata, preview, and SharePoint fields.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-text-secondary transition hover:bg-app-hover"
                aria-label="Close details panel"
              >
                <DismissRegular fontSize={16} />
              </button>
            </Dialog.Close>
          </div>

          {item ? (
            <div className="space-y-4">
              <div className="rounded border border-border-default bg-app-surface p-3">
                <div className="mb-3 flex h-40 items-center justify-center rounded border border-border-subtle bg-app-content">
                  {thumbnailQuery.data ? (
                    <img
                      src={thumbnailQuery.data}
                      alt={`${item.name} preview`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <FileIcon item={item} size="lg" />
                  )}
                </div>
                <p className="break-words text-sm font-medium text-text-primary">{item.name}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {item.folder ? "Folder" : item.file?.mimeType ?? "File"}
                </p>
              </div>

              <div className="space-y-2 rounded border border-border-default bg-app-surface p-3 text-sm">
                <DetailRow label="Size" value={item.folder ? "-" : formatFileSize(item.size) || "-"} />
                <DetailRow
                  label="Modified"
                  value={formatAbsoluteDate(item.lastModifiedDateTime)}
                />
                <DetailRow
                  label="Modified by"
                  value={item.lastModifiedBy?.user?.displayName ?? "-"}
                />
                <DetailRow
                  label="Link"
                  value={
                    <a
                      className="inline-flex items-center gap-1 text-text-link hover:underline"
                      href={item.webUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in SharePoint <OpenRegular fontSize={12} />
                    </a>
                  }
                />
              </div>

              <div className="rounded border border-border-default bg-app-surface p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.5px] text-text-tertiary">
                  SharePoint fields
                </h4>
                {fieldsQuery.isLoading ? (
                  <p className="text-sm text-text-secondary">Loading fields...</p>
                ) : fields && Object.keys(fields).length > 0 ? (
                  <dl className="space-y-2 text-sm">
                    {Object.entries(fields)
                      .filter(([key]) => !key.startsWith("@"))
                      .map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                          <dt className="truncate text-text-tertiary" title={decodeSharePointFieldName(key)}>
                            {decodeSharePointFieldName(key)}
                          </dt>
                          <dd className="break-words text-text-primary">{String(value ?? "-")}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No custom SharePoint fields available for this item.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Select a file to see details.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}

