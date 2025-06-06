import { Input } from "~/components/ui/input";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useTableSearch } from "~/hooks/useTableSearch";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { SearchNavigationState } from "~/hooks/useTableSearch";
import type { SearchMatch as BackendSearchMatch } from "~/hooks/useTableData";

interface SearchInputProps {
  onChange: (value: string) => void;
  disabled?: boolean;
  backendSearchMatches?: BackendSearchMatch[];
  onSearchMatches?: (navigationState: SearchNavigationState) => void;
  onInvalidateTableData?: () => void;
}

export function SearchInput({
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
      // Don't lose focus if clicking on navigation buttons or other dropdown elements
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('[role="menu"]')) {
        // Refocus immediately if blur was caused by clicking dropdown elements
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

  // Handle clearing search and closing dropdown
  const handleClearAndClose = () => {
    clearSearch();
    setIsOpen(false);
    setShouldMaintainFocus(false);
  };

  // Enhanced keyboard handling
  const handleKeyDownEnhanced = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e); // Call the original handler

    // Additional handling for Escape key
    if (e.key === "Escape") {
      if (hasValue) {
        clearSearch();
        // Keep focus and dropdown open when just clearing
        inputRef.current?.focus();
      } else {
        setIsOpen(false);
        setShouldMaintainFocus(false);
      }
    }
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

  // Calculate statistics for the message board
  const getSearchStats = () => {
    if (!hasValue || !searchNavigationState.hasMatches) {
      return "Type to search through table data";
    }

    const totalCells = searchNavigationState.totalMatches;
    const uniqueRows = new Set(
      searchNavigationState.matches.map((match) => match.rowId),
    ).size;
    const uniqueFields = new Set(
      searchNavigationState.matches.map((match) => match.columnId),
    ).size;

    return (
      <>
        Found <span className="font-semibold">{uniqueFields}</span> field
        {uniqueFields !== 1 ? "s" : ""} and{" "}
        <span className="font-semibold">{totalCells}</span> cell
        {totalCells !== 1 ? "s" : ""} (within{" "}
        <span className="font-semibold">{uniqueRows}</span> record
        {uniqueRows !== 1 ? "s" : ""})
      </>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={handleSearchIconClick}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Open search"
          type="button"
        >
          <Search className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
