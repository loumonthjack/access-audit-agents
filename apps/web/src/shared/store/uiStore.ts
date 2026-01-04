import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViolationFilter } from '@/types/domain';

export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  // Scan page UI state
  selectedViolationId: string | null;
  violationFilter: ViolationFilter;
  expandedViolations: Set<string>;

  // Global UI state
  sidebarOpen: boolean;
  theme: Theme;

  // Actions
  setSelectedViolation: (id: string | null) => void;
  setViolationFilter: (filter: ViolationFilter) => void;
  toggleViolationExpanded: (id: string) => void;
  setExpandedViolations: (ids: Set<string>) => void;
  clearExpandedViolations: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  reset: () => void;
}

const initialState = {
  selectedViolationId: null,
  violationFilter: 'all' as ViolationFilter,
  expandedViolations: new Set<string>(),
  sidebarOpen: true,
  theme: 'system' as Theme,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedViolation: (id) => set({ selectedViolationId: id }),

      setViolationFilter: (filter) => set({ violationFilter: filter }),

      toggleViolationExpanded: (id) =>
        set((state) => {
          const expanded = new Set(state.expandedViolations);
          if (expanded.has(id)) {
            expanded.delete(id);
          } else {
            expanded.add(id);
          }
          return { expandedViolations: expanded };
        }),

      setExpandedViolations: (ids) => set({ expandedViolations: ids }),

      clearExpandedViolations: () => set({ expandedViolations: new Set() }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => set({ theme }),

      reset: () => set(initialState),
    }),
    {
      name: 'ui-store',
      // Custom storage to handle Set serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Convert expandedViolations array back to Set
          if (parsed.state?.expandedViolations) {
            parsed.state.expandedViolations = new Set(parsed.state.expandedViolations);
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Convert Set to array for JSON serialization
          const toStore = {
            ...value,
            state: {
              ...value.state,
              expandedViolations: Array.from(value.state.expandedViolations || []),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
