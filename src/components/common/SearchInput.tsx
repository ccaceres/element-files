import { DismissRegular, SearchRegular } from "@fluentui/react-icons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search files",
}: SearchInputProps) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <SearchRegular
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        fontSize={16}
      />
      <input
        aria-label="Search files"
        className="w-full rounded border border-border-default bg-app-surface py-2 pl-9 pr-9 text-sm text-text-primary outline-none transition focus:border-accent-primary"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-app-hover"
          onClick={() => onChange("")}
          type="button"
        >
          <DismissRegular fontSize={14} />
        </button>
      ) : null}
    </div>
  );
}

