import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useDebounce } from "./useDebounce";
import type { TableRow, TableColumn } from "./useTableData";

// Types for search matches and navigation
export interface SearchMatch {
  rowId: string;
  columnId: string;
  cellValue: string;
  isCurrentTarget: boolean;
}

export interface SearchNavigationState {
  matches: SearchMatch[];
  currentMatchIndex: number;
  totalMatches: number;
  hasMatches: boolean;
}

interface UseTableSearchOptions {
  maxLength?: number;
  onSearch?: (value: string) => void;
  onSearchMatches?: (navigationState: SearchNavigationState) => void;
  tableRows?: TableRow[];
  tableColumns?: TableColumn[];
}

interface UseTableSearchReturn {
  searchValue: string;
  clearSearch: () => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  hasValue: boolean;
  searchNavigationState: SearchNavigationState;
  navigateToNextMatch: () => void;
  navigateToPreviousMatch: () => void;
  getCurrentTargetMatch: () => SearchMatch | null;
}

export function useTableSearch({
  maxLength = 100,
  onSearch,
  onSearchMatches,
  tableRows = [],
  tableColumns = [],
}: UseTableSearchOptions = {}): UseTableSearchReturn {
  const [searchValue, setSearchValue] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // Store callbacks in refs to avoid dependency issues
  const onSearchRef = useRef(onSearch);
  const onSearchMatchesRef = useRef(onSearchMatches);

  useEffect(() => {
    onSearchRef.current = onSearch;
    onSearchMatchesRef.current = onSearchMatches;
  }, [onSearch, onSearchMatches]);

  // Calculate search matches when search value or table data changes
  const searchMatches = useMemo(() => {
    if (
      !debouncedSearchValue.trim() ||
      !tableRows.length ||
      !tableColumns.length
    ) {
      return [];
    }

    const matches: SearchMatch[] = [];
    const searchTerm = debouncedSearchValue.toLowerCase().trim();

    tableRows.forEach((row) => {
      tableColumns.forEach((column) => {
        const cellValue = row.cells[column.id];
        if (cellValue != null) {
          const cellText = String(cellValue).toLowerCase();
          if (cellText.includes(searchTerm)) {
            matches.push({
              rowId: row.id,
              columnId: column.id,
              cellValue: String(cellValue),
              isCurrentTarget: false,
            });
          }
        }
      });
    });

    return matches;
  }, [debouncedSearchValue, tableRows, tableColumns]);

  // Update current target match when matches or index changes - stabilized with JSON comparison
  const searchNavigationState = useMemo(() => {
    const updatedMatches = searchMatches.map((match, index) => ({
      ...match,
      isCurrentTarget: index === currentMatchIndex,
    }));

    return {
      matches: updatedMatches,
      currentMatchIndex,
      totalMatches: searchMatches.length,
      hasMatches: searchMatches.length > 0,
    };
  }, [searchMatches, currentMatchIndex]);

  // Store previous navigation state to prevent unnecessary callbacks
  const prevNavigationStateRef = useRef<SearchNavigationState | null>(null);

  // Reset match index when search value changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [debouncedSearchValue]);

  // Call the onSearch callback when debounced value changes
  useEffect(() => {
    if (onSearchRef.current) {
      onSearchRef.current(debouncedSearchValue);
    }
  }, [debouncedSearchValue]);

  // Call the onSearchMatches callback only when navigation state actually changes
  useEffect(() => {
    if (onSearchMatchesRef.current) {
      const prevState = prevNavigationStateRef.current;
      const currentState = searchNavigationState;

      // Only call if the state has actually changed
      if (
        !prevState ||
        prevState.totalMatches !== currentState.totalMatches ||
        prevState.currentMatchIndex !== currentState.currentMatchIndex ||
        prevState.hasMatches !== currentState.hasMatches
      ) {
        onSearchMatchesRef.current(currentState);
        prevNavigationStateRef.current = currentState;
      }
    }
  }, [searchNavigationState]);

  // Navigation functions
  const navigateToNextMatch = useCallback(() => {
    if (searchMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
    }
  }, [searchMatches.length]);

  const navigateToPreviousMatch = useCallback(() => {
    if (searchMatches.length > 0) {
      setCurrentMatchIndex(
        (prev) => (prev - 1 + searchMatches.length) % searchMatches.length,
      );
    }
  }, [searchMatches.length]);

  const getCurrentTargetMatch = useCallback(() => {
    return searchNavigationState.matches[currentMatchIndex] ?? null;
  }, [searchNavigationState.matches, currentMatchIndex]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchValue("");
    setCurrentMatchIndex(0);
  }, []);

  // Handle input changes with validation
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (newValue.length <= maxLength) {
        setSearchValue(newValue);
      }
    },
    [maxLength],
  );

  // Enhanced keyboard handling with navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          navigateToPreviousMatch();
        } else {
          navigateToNextMatch();
        }
      } else if (e.key === "Escape") {
        if (searchValue) {
          // If there's a value, clear it
          clearSearch();
        } else {
          // If no value, blur the input
          e.currentTarget.blur();
        }
      }
    },
    [searchValue, clearSearch, navigateToNextMatch, navigateToPreviousMatch],
  );

  // Computed property for whether search has value
  const hasValue = searchValue.length > 0;

  return {
    searchValue,
    clearSearch,
    handleInputChange,
    handleKeyDown,
    hasValue,
    searchNavigationState,
    navigateToNextMatch,
    navigateToPreviousMatch,
    getCurrentTargetMatch,
  };
}
