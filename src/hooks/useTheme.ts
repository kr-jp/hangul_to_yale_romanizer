// 테마 훅 — <html>의 .dark 클래스 토글, yaleThemeV1 저장 (설계 문서 §2.1, §8-10)
// index.html의 FOUC 방지 스크립트(yaleThemeV1 → .dark)와 정합: 같은 키·같은 클래스
import { useCallback, useEffect, useState } from 'react';
import { readTheme, writeTheme } from '@/lib/storage';
import type { Theme } from '@/lib/types';

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggle };
}
