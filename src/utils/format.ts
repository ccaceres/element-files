import { format, formatDistanceToNowStrict } from "date-fns";

export function formatFileSize(size?: number): string {
  if (size == null || Number.isNaN(size)) {
    return "";
  }

  if (size === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;

  if (exponent === 0) {
    return `${Math.round(value)} ${units[exponent]}`;
  }

  return `${value.toFixed(1)} ${units[exponent]}`;
}

export function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

export function formatAbsoluteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "PPpp");
}

export function getInitials(name: string): string {
  const segments = name
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2);

  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("") || "?";
}

export function decodeSharePointFieldName(name: string): string {
  return name
    .replaceAll("_x0020_", " ")
    .replaceAll("_x002f_", "/")
    .replaceAll("_x0028_", "(")
    .replaceAll("_x0029_", ")")
    .replaceAll("_x003a_", ":");
}

