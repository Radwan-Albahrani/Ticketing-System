import { create } from 'zustand';
interface StudioState {
  category: string; priority: string; status: string; page: number;
  selectedId: string | null; composerOpen: boolean; guideOpen: boolean;
  notice: string | null;
  filter: (key: 'category' | 'priority' | 'status', value: string) => void;
  setPage: (page: number) => void;
  select: (id: string | null) => void;
  compose: (open: boolean) => void;
  guide: (open: boolean) => void;
  notify: (message: string | null) => void;
}
export const useStudio = create<StudioState>((set) => ({
  category: '', priority: '', status: '', page: 1, selectedId: null, composerOpen: false, guideOpen: false, notice: null,
  filter: (key, value) => set({ [key]: value, page: 1 }), setPage: (page) => set({ page }),
  select: (selectedId) => set({ selectedId }), compose: (composerOpen) => set({ composerOpen }),
  guide: (guideOpen) => set({ guideOpen }), notify: (notice) => set({ notice }),
}));
