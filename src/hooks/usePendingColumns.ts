import { useState, useCallback } from "react";

interface PendingColumn {
  tempId: string;
  realId?: string;
  isReady: boolean;
}

// Shared state for pending columns
const pendingColumnsState = new Map<string, PendingColumn>();
const listeners = new Set<() => void>();

export function usePendingColumns() {
  const [, forceUpdate] = useState({});

  // Subscribe to changes
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  // Subscribe on mount
  useState(() => {
    listeners.add(triggerUpdate);
    return () => listeners.delete(triggerUpdate);
  });

  const addPendingColumn = useCallback((tempId: string) => {
    pendingColumnsState.set(tempId, { tempId, isReady: false });
    listeners.forEach((listener) => listener());
  }, []);

  const markColumnReady = useCallback((tempId: string, realId?: string) => {
    const pending = pendingColumnsState.get(tempId);
    if (pending) {
      pending.isReady = true;
      pending.realId = realId;
    }
    listeners.forEach((listener) => listener());
  }, []);

  const removePendingColumn = useCallback((tempId: string) => {
    pendingColumnsState.delete(tempId);
    listeners.forEach((listener) => listener());
  }, []);

  const isColumnPending = useCallback((columnId: string) => {
    const pending = pendingColumnsState.get(columnId);
    return pending && !pending.isReady;
  }, []);

  const waitForColumn = useCallback((columnId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const pending = pendingColumnsState.get(columnId);

      if (!pending) {
        // Column doesn't exist in pending state, assume it's ready
        resolve(columnId);
        return;
      }

      if (pending.isReady) {
        resolve(pending.realId ?? columnId);
        return;
      }

      // Wait for column to be ready with timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Column ${columnId} creation timeout`));
      }, 10000); // 10 second timeout

      const checkReady = () => {
        const current = pendingColumnsState.get(columnId);
        if (current?.isReady) {
          clearTimeout(timeout);
          resolve(current.realId ?? columnId);
        } else {
          setTimeout(checkReady, 100); // Check every 100ms
        }
      };

      checkReady();
    });
  }, []);

  return {
    addPendingColumn,
    markColumnReady,
    removePendingColumn,
    isColumnPending,
    waitForColumn,
    pendingColumns: Array.from(pendingColumnsState.keys()),
  };
}
