import type { DriveItem } from "@/types";
import { getFileTypeMeta } from "@/utils/file-types";

interface FileIconProps {
  item: DriveItem;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-5 w-5 text-[9px]",
  md: "h-8 w-8 text-[10px]",
  lg: "h-12 w-12 text-xs",
};

function getLabel(kind: string): string {
  switch (kind) {
    case "word":
      return "W";
    case "excel":
      return "X";
    case "powerpoint":
      return "P";
    case "pdf":
      return "PDF";
    case "onenote":
      return "N";
    case "visio":
      return "V";
    case "image":
      return "IMG";
    case "video":
      return "VID";
    case "audio":
      return "AUD";
    case "archive":
      return "ZIP";
    case "text":
      return "TXT";
    case "csv":
      return "CSV";
    default:
      return "DOC";
  }
}

export function FileIcon({ item, size = "md" }: FileIconProps) {
  const meta = getFileTypeMeta(item);

  if (meta.kind === "folder") {
    return (
      <div className={sizeMap[size]}>
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <path
            d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11z"
            fill="#FFB900"
          />
          <path
            d="M3 10h18v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5V10z"
            fill="#F9C843"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size]} flex items-center justify-center rounded border border-white/10 font-semibold text-white`}
      style={{ backgroundColor: meta.color }}
      title={meta.extension || "file"}
    >
      <span>{getLabel(meta.kind)}</span>
    </div>
  );
}

