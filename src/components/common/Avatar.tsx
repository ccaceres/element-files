import clsx from "clsx";
import { getInitials } from "@/utils/format";

interface AvatarProps {
  name: string;
  imageSrc?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClassMap = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

export function Avatar({ name, imageSrc, size = "md" }: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-primary/30 font-semibold text-text-primary",
        sizeClassMap[size],
      )}
      aria-label={name}
      title={name}
    >
      {imageSrc ? (
        <img className="h-full w-full object-cover" src={imageSrc} alt={name} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

