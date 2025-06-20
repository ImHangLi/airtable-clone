import { Input } from "~/components/ui/input";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useTableSearch } from "~/hooks/useTableSearch";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { SearchNavigationState } from "~/hooks/useTableSearch";
import type { SearchMatch as BackendSearchMatch } from "~/hooks/useTableData";
import { useSearchStats } from "~/hooks/useSearchStats";

interface SearchInputProps {
  tableId: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  backendSearchMatches?: BackendSearchMatch[];
  onSearchMatches?: (navigationState: SearchNavigationState) => void;
  onInvalidateTableData?: () => void;
}

export function SearchInput({
  tableId,
  onChange,
  disabled = false,
  backendSearchMatches = [],
  onSearchMatches,
  onInvalidateTableData,
}: SearchInputProps) {
  // State to track if the search dropdown is open
  const [isOpen, setIsOpen] = useState(false);

  // State to track if input should maintain focus
  const [shouldMaintainFocus, setShouldMaintainFocus] = useState(false);

  // Ref to focus the input when opened
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchValue,
    handleInputChange,
    handleKeyDown,
    clearSearch,
    hasValue,
    searchNavigationState,
    navigateToNextMatch,
    navigateToPreviousMatch,
  } = useTableSearch({
    onSearch: onChange,
    onSearchMatches,
    backendSearchMatches,
    onInvalidateTableData,
  });

  // Get search stats directly from hook
  const { searchStats } = useSearchStats({
    tableId,
    search: searchValue,
  });

  // Focus management - maintain focus during search operations
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Focus immediately when dropdown opens
      inputRef.current.focus();
      setShouldMaintainFocus(true);
    } else {
      setShouldMaintainFocus(false);
    }
  }, [isOpen]);

  // Maintain focus when search results change
  useEffect(() => {
    if (
      shouldMaintainFocus &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      inputRef.current.focus();
    }
  }, [searchNavigationState.totalMatches, shouldMaintainFocus]);

  // Handle input focus - ensure we track focus state
  const handleInputFocus = useCallback(() => {
    setShouldMaintainFocus(true);
  }, []);

  // Handle input blur - only allow if user explicitly clicks outside
  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Don't lose focus if clicking on navigation buttons or other popover elements
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('[data-slot="popover-content"]')) {
        // Refocus immediately if blur was caused by clicking popover elements
        inputRef.current?.focus();
        return;
      }
      setShouldMaintainFocus(false);
    },
    [],
  );

  // Handle clicking the search icon to open and focus
  const handleSearchIconClick = () => {
    if (!disabled) {
      setIsOpen(true);
      // Focus will be handled by the useEffect when isOpen changes
    }
  };

  // Handle opening search with keyboard shortcut
  const openSearch = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      // Focus will be handled by the useEffect when isOpen changes
    }
  }, [disabled]);

  // Add global keyboard event listener for Ctrl/Cmd+F and Esc
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+F (Windows/Linux) or Cmd+F (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault(); // Prevent browser's default find behavior
        openSearch();
        return;
      }

      // Handle Escape key when search is open
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setShouldMaintainFocus(false);
      }
    };

    // Add event listener to document with capture phase to handle before Popover
    document.addEventListener("keydown", handleGlobalKeyDown, true);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [openSearch, isOpen]);

  // Handle clearing search and closing dropdown
  const handleClearAndClose = () => {
    clearSearch();
    setIsOpen(false);
    setShouldMaintainFocus(false);
  };

  // Enhanced keyboard handling
  const handleKeyDownEnhanced = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e); // Call the original handler for all keys
  };

  // Handle navigation button clicks - prevent losing focus
  const handlePreviousMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigateToPreviousMatch();
    // Ensure input stays focused after navigation
    inputRef.current?.focus();
  };

  const handleNextMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigateToNextMatch();
    // Ensure input stays focused after navigation
    inputRef.current?.focus();
  };

  // Calculate statistics for the message board using comprehensive backend data
  const getSearchStats = () => {
    if (!hasValue || !searchStats || searchStats.totalMatches === 0) {
      return "Type to search through table data";
    }

    const { totalMatches, uniqueRows, uniqueFields } = searchStats;

    return (
      <>
        Found <span className="font-semibold">{uniqueFields}</span> field
        {uniqueFields !== 1 ? "s" : ""} and{" "}
        <span className="font-semibold">{totalMatches}</span> cell
        {totalMatches !== 1 ? "s" : ""} (within{" "}
        <span className="font-semibold">{uniqueRows}</span> record
        {uniqueRows !== 1 ? "s" : ""})
      </>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleSearchIconClick}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Open search"
          type="button"
        >
          <Search className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="p-0"
        style={{ width: "300px", height: "74px" }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Upper part - Input and navigation controls (50% height = 37px) */}
        <div className="flex h-[37px] items-center border-b border-gray-200 pr-1">
          {/* Left side - Input */}
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Find in view"
              value={searchValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDownEnhanced}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={disabled}
              className="h-7 border-none pr-2 text-[13px] shadow-none focus-visible:ring-0"
              aria-label="Search table data"
              role="searchbox"
              aria-autocomplete="none"
            />
          </div>

          {/* Right side - Navigation and controls */}
          <div className="ml-2 flex items-center gap-1">
            {/* Match counter */}
            {hasValue && searchNavigationState.hasMatches && (
              <span className="text-xs whitespace-nowrap text-gray-500">
                {searchNavigationState.currentMatchIndex + 1} of{" "}
                {searchNavigationState.totalMatches}
              </span>
            )}

            {/* Navigation buttons */}
            {hasValue && searchNavigationState.hasMatches && (
              <>
                <button
                  onClick={handlePreviousMatch}
                  disabled={disabled || !searchNavigationState.hasMatches}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous match"
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                >
                  <ChevronUp className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={handleNextMatch}
                  disabled={disabled || !searchNavigationState.hasMatches}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next match"
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                >
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
              </>
            )}

            {/* Clear and close button */}
            <button
              onClick={handleClearAndClose}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              aria-label="Clear search and close"
              type="button"
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Lower part - Message board (50% height = 37px) */}
        <div className="flex h-[37px] items-center bg-gray-50 px-3">
          <span className="text-xs text-gray-600">{getSearchStats()}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
