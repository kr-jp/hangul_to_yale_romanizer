// 앱 루트 — 전체 상태(useReducer) + 부팅 URL 복원(APPLY_SHARE) + 히스토리 디바운스 기록
// 설계 문서 §2.1 상태 배치표·§3.3 복원 순서를 따른다
import { useEffect, useMemo, useReducer, useState } from 'react';
import { toast } from 'sonner';
import Header from './components/Header';
import IOPanels from './components/IOPanels';
import OptionRow from './components/OptionRow';
import ActionBar from './components/ActionBar';
import Footer from './components/Footer';
import InterlinearPanel from './components/InterlinearPanel';
import HistoryDrawer from './components/HistoryDrawer';
import RefDrawer from './components/RefDrawer';
import { Toaster } from './components/ui/sonner';
import { useI18n } from './hooks/useI18n';
import { useFrequencyData } from './hooks/useFrequencyData';
import { buildFormattedOutput, collectShareGlosses, getOpts, splitLines } from './lib/convert-pipeline';
import {
  addHistoryItem,
  isValidFormat,
  readFormat,
  readTabCopy,
  writeFormat,
  writeTabCopy,
} from './lib/storage';
import { copyText } from './lib/clipboard';
import { buildShareUrl, decodeShareState } from './lib/url-codec';
import { FORMAT_FILE_INFO, buildBackup, downloadText, timestamp } from './lib/download';
import type { Direction, HistoryItem, OutputFormat, ShareState } from './lib/types';

interface AppState {
  direction: Direction;
  input: string;
  labial: boolean;
  sepEnabled: boolean;
  sepChar: string; // raw 문자열 — 사용 시 .slice(0,1)
  interlinear: boolean;
  numbered: boolean;
  format: OutputFormat;
  // タブ区切り — 복사 시 공백→탭 치환 (기본 ON). 취향 설정이라 영속·공유 URL 비포함 (2026-06-12)
  tabCopy: boolean;
  // 세션 한정. 공유 URL `o`로만 복원. 방향 전환 시에도 비우지 않음 (§8-3)
  wordOverrides: Map<string, string>;
  // 글로스 (Stage 5 기능 2). key = splitLines가 낸 줄 텍스트(trim됨) — 줄 수정 시 키 불일치로 자연 무효화
  glossEnabled: boolean;
  glosses: Map<string, string[]>;
}

type AppAction =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SET_DIRECTION'; value: Direction }
  | {
      type: 'SET_OPTION';
      patch: Partial<
        Pick<
          AppState,
          'labial' | 'interlinear' | 'numbered' | 'sepEnabled' | 'sepChar' | 'glossEnabled' | 'tabCopy'
        >
      >;
    }
  | { type: 'SET_FORMAT'; value: OutputFormat }
  | { type: 'SET_OVERRIDE'; word: string; hangul: string }
  | { type: 'SET_GLOSS'; lineKey: string; tokenIndex: number; value: string }
  | { type: 'APPLY_SHARE'; share: ShareState };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.value };
    case 'SET_DIRECTION':
      // 활성 방향 재선택 무시. 전환 시 input 리셋 (원본 applyDirection, §4.10)
      if (action.value === state.direction) return state;
      return { ...state, direction: action.value, input: '' };
    case 'SET_OPTION':
      return { ...state, ...action.patch };
    case 'SET_FORMAT':
      if (action.value === state.format) return state;
      return { ...state, format: action.value };
    case 'SET_OVERRIDE': {
      const next = new Map(state.wordOverrides);
      next.set(action.word, action.hangul);
      return { ...state, wordOverrides: next };
    }
    case 'SET_GLOSS': {
      // lineKey의 배열을 토큰 수 길이로 패딩/절단 후 [tokenIndex] 기록 (Stage 5 §2.2)
      const tokenCount = action.lineKey.split(/\s+/).filter(Boolean).length;
      if (action.tokenIndex < 0 || action.tokenIndex >= tokenCount) return state;
      const prev = state.glosses.get(action.lineKey) || [];
      const arr = Array.from({ length: tokenCount }, (_, i) => prev[i] ?? '');
      arr[action.tokenIndex] = action.value;
      const next = new Map(state.glosses);
      next.set(action.lineKey, arr);
      return { ...state, glosses: next };
    }
    case 'APPLY_SHARE': {
      // ShareState 전체를 원자적으로 적용 (§3.3). 무효 d/f는 기존값 유지 (원본 검증과 동일)
      const s = action.share;
      const direction = s.d === 'y2h' || s.d === 'h2y' ? s.d : state.direction;
      const format = isValidFormat(s.f) ? s.f : state.format;
      const overrides = new Map<string, string>();
      if (s.o && typeof s.o === 'object') {
        for (const [k, v] of Object.entries(s.o)) overrides.set(k, String(v));
      }
      const glosses = new Map<string, string[]>();
      if (s.g && typeof s.g === 'object') {
        // 값이 배열이 아니면 그 키 폐기 (Stage 5 §2.5)
        for (const [k, v] of Object.entries(s.g)) {
          if (Array.isArray(v)) glosses.set(k, v.map((x) => String(x)));
        }
      }
      return {
        direction,
        input: s.i || '',
        labial: !!s.l,
        sepChar: s.s || '',
        sepEnabled: !!s.se,
        interlinear: !!s.il,
        numbered: !!s.n,
        format,
        tabCopy: state.tabCopy, // 공유 대상 아님 — 방문자 설정 유지
        wordOverrides: overrides,
        glossEnabled: !!s.ge,
        glosses,
      };
    }
  }
}

// 부팅: 기본값 구성 후 URL ?s= 가 있으면 APPLY_SHARE를 즉시 적용 (URL이 기본값·localStorage보다 우선)
function initAppState(): AppState {
  const base: AppState = {
    direction: 'h2y',
    input: '',
    labial: true,
    sepEnabled: false,
    sepChar: '',
    interlinear: true,
    numbered: false,
    format: readFormat(),
    tabCopy: readTabCopy(),
    wordOverrides: new Map(),
    glossEnabled: false,
    glosses: new Map(),
  };
  const share = decodeShareState(window.location.search);
  return share ? appReducer(base, { type: 'APPLY_SHARE', share }) : base;
}

export default function App() {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(appReducer, undefined, initAppState);
  const [histOpen, setHistOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  // format은 변경 시마다 localStorage에 기록 (공유 URL 복원 포함 — 원본 setFormat 경유 동작, §8-5)
  useEffect(() => {
    writeFormat(state.format);
  }, [state.format]);

  // タブ区切り 설정 영속화
  useEffect(() => {
    writeTabCopy(state.tabCopy);
  }, [state.tabCopy]);

  // y2h 진입 시 빈도 데이터 lazy load. 로드 완료 시 version 증가 → 출력 재계산
  const freqVersion = useFrequencyData(state.direction);

  const opts = useMemo(
    () => getOpts({ sepEnabled: state.sepEnabled, sepChar: state.sepChar, labial: state.labial }),
    [state.sepEnabled, state.sepChar, state.labial],
  );

  // 출력은 파생값 (§2.1)
  const output = useMemo(
    () =>
      buildFormattedOutput(
        state.input,
        opts,
        state.format,
        state.numbered,
        state.direction,
        state.wordOverrides,
        // 글로스 — enabled가 출력 게이트, off·빈 글로스면 기존 출력과 바이트 동일 (§2.4)
        { enabled: state.glossEnabled, map: state.glosses },
      ),
    // freqVersion: 빈도 데이터 로드 전후로 y2h 결과가 달라지므로 의존성에 포함 (§4.11)
    [
      state.input,
      opts,
      state.format,
      state.numbered,
      state.direction,
      state.wordOverrides,
      state.glossEnabled,
      state.glosses,
      freqVersion,
    ],
  );

  const lines = useMemo(() => splitLines(state.input), [state.input]);

  // 히스토리 자동 기록 — 500ms 디바운스 (§2.2)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      addHistoryItem({ text: state.input, opts });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state.input, opts]);

  // 메인 복사 버튼: plain + タブ区切り ON일 때만 공백 run → 탭 치환 (§4.2)
  const handleCopy = () => {
    const raw = output || '';
    const text = state.format === 'plain' && state.tabCopy ? raw.replace(/[^\S\r\n]+/g, '\t') : raw;
    void copyText(text).then(() => toast(t('copied'), { duration: 2000 }));
  };

  // 현재 상태 → ShareState (§3.2). s는 유효 sep(getOpts 결과), o는 size > 0일 때만
  // ge/g는 기본값이면 생략 — 기존 URL 소비자와 동일 shape 유지 (Stage 5 §2.5)
  const captureShare = (): ShareState => {
    const share: ShareState = {
      d: state.direction,
      i: state.input || '',
      l: opts.labial,
      s: opts.sep,
      se: state.sepEnabled,
      il: state.interlinear,
      f: state.format,
      n: state.numbered,
    };
    if (state.wordOverrides.size > 0) share.o = Object.fromEntries(state.wordOverrides);
    if (state.glossEnabled) share.ge = true;
    const g = collectShareGlosses(lines, state.glosses);
    if (Object.keys(g).length > 0) share.g = g;
    return share;
  };

  // 결과 다운로드 (§4.5): 출력이 비면 noContent 토스트 후 중단
  const handleDownload = () => {
    if (!output) {
      toast(t('noContent'), { duration: 2000 });
      return;
    }
    const info = FORMAT_FILE_INFO[state.format] || FORMAT_FILE_INFO.plain;
    downloadText(output, `yale-${state.direction}-${timestamp()}.${info.ext}`, info.mime);
  };

  // 백업 JSON (§4.6): 입력이 공백뿐이면 noContent 토스트 후 중단. 복원 기능은 없음
  const handleBackup = () => {
    if (!state.input.trim()) {
      toast(t('noContent'), { duration: 2000 });
      return;
    }
    const backup = buildBackup({
      direction: state.direction,
      opts,
      sepEnabled: state.sepEnabled,
      interlinear: state.interlinear,
      format: state.format,
      numbered: state.numbered,
      glossEnabled: state.glossEnabled,
      input: state.input,
      output: output || '',
      wordOverrides: state.wordOverrides,
      glosses: collectShareGlosses(lines, state.glosses),
      shareUrl: buildShareUrl(captureShare()),
    });
    downloadText(JSON.stringify(backup, null, 2), `yale-backup-${timestamp()}.json`, 'application/json');
  };

  // URL 공유 (§3): 현재 상태로 URL 생성 → 클립보드 복사 → 토스트
  const handleShare = () => {
    void copyText(buildShareUrl(captureShare())).then(() => toast(t('shareCopied'), { duration: 2000 }));
  };

  // 히스토리 복원: input·sepChar·labial만 적용, sepEnabled·direction·format 불변 (§4.8, §8-2)
  const handleRestore = (item: HistoryItem) => {
    dispatch({
      type: 'SET_OPTION',
      patch: { sepChar: item.opts.sep || '', labial: !!item.opts.labial },
    });
    dispatch({ type: 'SET_INPUT', value: item.text });
    setHistOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        direction={state.direction}
        onDirectionChange={(d) => dispatch({ type: 'SET_DIRECTION', value: d })}
        onOpenHistory={() => setHistOpen(true)}
        onOpenRef={() => setRefOpen(true)}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 md:py-8">
        <section className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <IOPanels
            direction={state.direction}
            input={state.input}
            onInputChange={(v) => dispatch({ type: 'SET_INPUT', value: v })}
            output={output}
            format={state.format}
            tabCopy={state.tabCopy}
          />
          <OptionRow
            direction={state.direction}
            labial={state.labial}
            interlinear={state.interlinear}
            numbered={state.numbered}
            sepEnabled={state.sepEnabled}
            sepChar={state.sepChar}
            glossEnabled={state.glossEnabled}
            tabCopy={state.tabCopy}
            onChange={(patch) => dispatch({ type: 'SET_OPTION', patch })}
          />
          <ActionBar
            output={output}
            format={state.format}
            onFormatChange={(f) => dispatch({ type: 'SET_FORMAT', value: f })}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onBackup={handleBackup}
            onShare={handleShare}
          />
        </section>
        <InterlinearPanel
          visible={state.interlinear}
          direction={state.direction}
          lines={lines}
          opts={opts}
          format={state.format}
          numbered={state.numbered}
          wordOverrides={state.wordOverrides}
          glossEnabled={state.glossEnabled}
          glosses={state.glosses}
          tabCopy={state.tabCopy}
          onGlossChange={(lineKey, tokenIndex, value) =>
            dispatch({ type: 'SET_GLOSS', lineKey, tokenIndex, value })
          }
          onOverride={(word, hangul) => dispatch({ type: 'SET_OVERRIDE', word, hangul })}
        />
      </main>
      <HistoryDrawer open={histOpen} onOpenChange={setHistOpen} onRestore={handleRestore} />
      <RefDrawer open={refOpen} onOpenChange={setRefOpen} />
      <Footer />
      <Toaster />
    </div>
  );
}
