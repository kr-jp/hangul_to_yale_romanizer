// i18n 훅 + Provider (설계 문서 §6). UI 문자열은 messages.json에서만 가져온다
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import messages from '@/i18n/messages.json';
import { readLang, writeLang } from '@/lib/storage';
import type { Lang } from '@/lib/types';

export type MessageKey = keyof (typeof messages)['ja'];

interface I18nContextValue {
  lang: Lang;
  t: (key: MessageKey) => string;
  toggleLang: () => void; // ja ⇄ ko, yaleLangV1 저장, document.documentElement.lang 갱신
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => readLang());

  // 원본 applyLang과 동일: 저장 + <html lang> 갱신 (초기 적용 포함)
  useEffect(() => {
    writeLang(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      t: (key) => messages[lang][key] ?? messages.ja[key],
      toggleLang: () => setLang((prev) => (prev === 'ja' ? 'ko' : 'ja')),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
