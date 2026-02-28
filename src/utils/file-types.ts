import type { DriveItem } from "@/types";

export type FileIconKind =
  | "word"
  | "excel"
  | "powerpoint"
  | "pdf"
  | "onenote"
  | "visio"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "text"
  | "csv"
  | "folder"
  | "default";

export interface FileTypeMeta {
  kind: FileIconKind;
  color: string;
  extension: string;
}

const COLOR = {
  word: "#2B579A",
  excel: "#217346",
  powerpoint: "#D24726",
  pdf: "#E5252A",
  onenote: "#7719AA",
  visio: "#3955A3",
  image: "#7B83EB",
  video: "#E3008C",
  audio: "#E3008C",
  archive: "#8764B8",
  text: "#69797E",
  csv: "#217346",
  folder: "#FFB900",
  default: "#69797E",
} as const;

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) {
    return "";
  }

  return name.slice(dot + 1).toLowerCase();
}

function mapExtensionToKind(extension: string): FileIconKind {
  if (["doc", "docx"].includes(extension)) return "word";
  if (["xls", "xlsx"].includes(extension)) return "excel";
  if (["ppt", "pptx"].includes(extension)) return "powerpoint";
  if (extension === "pdf") return "pdf";
  if (extension === "one") return "onenote";
  if (extension === "vsdx") return "visio";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(extension)) {
    return "image";
  }
  if (["mp4", "mov", "avi", "mkv", "wmv"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(extension)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  if (["txt", "md", "log", "rtf"].includes(extension)) return "text";
  if (extension === "csv") return "csv";
  return "default";
}

export function getFileTypeMeta(item: DriveItem): FileTypeMeta {
  if (item.folder) {
    return {
      kind: "folder",
      color: COLOR.folder,
      extension: "folder",
    };
  }

  const extension = getExtension(item.name);
  const kind = mapExtensionToKind(extension);

  return {
    kind,
    color: COLOR[kind],
    extension,
  };
}

