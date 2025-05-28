import { Input } from "~/components/ui/input";
import { Search, X } from "lucide-react";
import { useTableSearch } from "~/hooks/useTableSearch";
import { useState, useRef, useEffect } from "react";

interface SearchInputProps {
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SearchInput({ onChange, disabled = false }: SearchInputProps) {
  // State to track if the search input is expanded
  const [isExpanded, setIsExpanded] = useState(false);

  // Ref to focus the input when expanded
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchValue,
    handleInputChange,
    handleKeyDown,
    clearSearch,
    hasValue,
  } = useTableSearch({
    onSearch: onChange,
  });

  // Focus the input when it expands
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Handle clicking the search icon to expand
  const handleSearchIconClick = () => {
    if (!disabled) {
      setIsExpanded(true);
    }
  };

  // Handle input blur - collapse if no search value
  const handleInputBlur = () => {
    if (!hasValue) {
      setIsExpanded(false);
    }
  };

  // Handle clearing search - also collapse the input
  const handleClear = () => {
    clearSearch();
    setIsExpanded(false);
  };

  // Enhanced keyboard handling
  const handleKeyDownEnhanced = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e); // Call the original handler

    // Additional handling for Escape key
    if (e.key === "Escape" && !hasValue) {
      setIsExpanded(false);
    }
  };

  // If not expanded, show just the search icon
  if (!isExpanded) {
    return (
      <button
        onClick={handleSearchIconClick}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Open search"
        type="button"
      >
        <Search className="h-4 w-4 text-gray-500" />
      </button>
    );
  }

  // If expanded, show the full search input
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search"
        value={searchValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDownEnhanced}
        onBlur={handleInputBlur}
        disabled={disabled}
        className="h-8 w-48 pr-8 pl-8 text-sm"
        aria-label="Search table data"
        aria-describedby="search-help"
        role="searchbox"
        aria-autocomplete="none"
      />

      <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-gray-400" />

      {hasValue && !disabled && (
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 h-4 w-4 hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
          aria-label="Clear search"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div id="search-help" className="sr-only">
        Type to search through table data. Results will appear as you type.
      </div>
    </div>
  );
}
