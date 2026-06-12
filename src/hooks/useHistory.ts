// 히스토리 훅 — lib/storage의 CRUD를 소비만 하고, revision state로 리렌더 (설계 문서 §1)
// localStorage가 단일 진실원. 이 훅은 읽기 캐시 + 변경 후 revision 증가로 동기화한다
import { useCallback, useMemo, useState } from 'react';
import {
  addTagToHistoryItem,
  getAllTags,
  loadHistory,
  removeTagFromHistoryItem,
  saveHistory,
} from '@/lib/storage';
import type { HistoryItem } from '@/lib/types';

export interface UseHistoryValue {
  items: HistoryItem[];
  allTags: string[];
  refresh(): void;
  togglePin(id: number): void;
  remove(id: number): void;
  clear(): void;
  addTag(id: number, tag: string): void;
  removeTag(id: number, tag: string): void;
}

export function useHistory(): UseHistoryValue {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  // 정렬: 핀 우선 → 최신순 (§4.8)
  const items = useMemo(
    () => loadHistory().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id),
    [revision],
  );
  const allTags = useMemo(() => getAllTags(), [revision]);

  const togglePin = useCallback(
    (id: number) => {
      const hist = loadHistory();
      const item = hist.find((h) => h.id === id);
      if (!item) return;
      item.pinned = !item.pinned;
      saveHistory(hist);
      bump();
    },
    [bump],
  );

  const remove = useCallback(
    (id: number) => {
      const hist = loadHistory();
      const idx = hist.findIndex((h) => h.id === id);
      if (idx < 0) return;
      hist.splice(idx, 1);
      saveHistory(hist);
      bump();
    },
    [bump],
  );

  const clear = useCallback(() => {
    saveHistory([]);
    bump();
  }, [bump]);

  const addTag = useCallback(
    (id: number, tag: string) => {
      addTagToHistoryItem(id, tag);
      bump();
    },
    [bump],
  );

  const removeTag = useCallback(
    (id: number, tag: string) => {
      removeTagFromHistoryItem(id, tag);
      bump();
    },
    [bump],
  );

  return { items, allTags, refresh: bump, togglePin, remove, clear, addTag, removeTag };
}
