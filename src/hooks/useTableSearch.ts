import { useState, useCallback, useEffect } from "react";
import { useDebounce } from "./useDebounce";

interface UseTableSearchOptions {
  maxLength?: number;
  onSearch?: (value: string) => void;
}

interface UseTableSearchReturn {
  searchValue: string;
  debouncedSearchValue: string;
  setSearchValue: (value: string) => void;
  clearSearch: () => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  hasValue: boolean;
}

export function useTableSearch({
  maxLength = 100,
  onSearch,
}: UseTableSearchOptions = {}): UseTableSearchReturn {
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 500);

  // Call the onSearch callback when debounced value changes
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedSearchValue);
    }
  }, [debouncedSearchValue, onSearch]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchValue("");
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

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (searchValue) {
          // If there's a value, clear it
          clearSearch();
        } else {
          // If no value, blur the input
          e.currentTarget.blur();
        }
      }
    },
    [searchValue, clearSearch],
  );

  // Computed property for whether search has value
  const hasValue = searchValue.length > 0;

  return {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    handleInputChange,
    handleKeyDown,
    hasValue,
  };
}
