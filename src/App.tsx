// 앱 루트 — 전체 상태(useReducer) + 부팅 URL 복원(APPLY_SHARE) + 히스토리 디바운스 기록
// 설계 문서 §2.1 상태 배치표·§3.3 복원 순서를 따른다
import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import Header from './components/Header';
import IOPanels from './components/IOPanels';
import OptionRow from './components/OptionRow';
import ActionBar from './components/ActionBar';
import Footer from './components/Footer';
import InterlinearPanel from './components/InterlinearPanel';
import HistoryDrawer from './components/HistoryDrawer';
import RefDrawer from './components/RefDrawer';
import DictionaryDrawer from './components/DictionaryDrawer';
import { Toaster } from './components/ui/sonner';
import { useI18n } from './hooks/useI18n';
import { useFrequencyData } from './hooks/useFrequencyData';
import { useConvertedOutput } from './hooks/useConvertedOutput';
import { collectShareGlosses, getOpts, splitLines } from './lib/convert-pipeline';
import {
  historyDirection,
  isValidFormat,
  readFormat,
  readKeepHyphens,
  readTabCopy,
  readUserDictRaw,
  recordHistory,
  writeFormat,
  writeKeepHyphens,
  writeTabCopy,
  writeUserDictRaw,
} from './lib/storage';
import { copyText } from './lib/clipboard';
import { buildShareUrl, decodeShareState } from './lib/url-codec';
import { FORMAT_FILE_INFO, buildBackup, buildDictionaryExport, downloadText, timestamp } from './lib/download';
import {
  EMPTY_DICT,
  applyChange,
  describeToken,
  dictFromJSON,
  dictSize,
  dictToJSON,
  entriesUsedIn,
  mergeDicts,
  planCorrection,
  summarizeEntries,
} from './lib/user-dict';
import type {
  DictChange,
  DictEntry,
  DictScope,
  Direction,
  HistoryItem,
  OutputFormat,
  ShareState,
  UserDict,
  WordEditor,
} from './lib/types';

interface AppState {
  direction: Direction;
  input: string; // 현재 방향의 입력
  // 방향별 입력 보관 — 방향을 바꿔도 입력이 사라지지 않고, 돌아오면 복원된다 (활성 방향 값은 input이 원본)
  drafts: Record<Direction, string>;
  labial: boolean;
  sepEnabled: boolean;
  sepChar: string; // raw 문자열 — 사용 시 .slice(0,1)
  interlinear: boolean;
  numbered: boolean;
  format: OutputFormat;
  // タブ区切り — 복사 시 공백→탭 치환 (기본 ON). 취향 설정이라 영속·공유 URL 비포함 (2026-06-12)
  tabCopy: boolean;
  // y2h 형태소 경계 '-'를 한글 출력에 남김 (기본 OFF). 출력이 달라지므로 공유 URL `h`에 포함 (2026-10-10)
  keepHyphens: boolean;
  // 세션 한정. 공유 URL `o`로만 복원. 방향 전환 시에도 비우지 않음 (§8-3).
  // 2026-10부터 후보 선택은 사용자 사전으로 기록하므로 새로 생기지 않는다 (예전 공유 URL 호환용)
  wordOverrides: Map<string, string>;
  // 이번 세션에만 적용하는 사전 항목 — '사전에 기억'을 끄고 고친 것, 공유 URL `u`로 받은 것.
  // 저장된 사용자 사전보다 우선 (App의 dict = mergeDicts(userDict, sessionDict))
  sessionDict: UserDict;
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
          | 'labial'
          | 'interlinear'
          | 'numbered'
          | 'sepEnabled'
          | 'sepChar'
          | 'glossEnabled'
          | 'tabCopy'
          | 'keepHyphens'
        >
      >;
    }
  | { type: 'SET_FORMAT'; value: OutputFormat }
  | { type: 'CHANGE_SESSION_DICT'; change: Partial<DictChange> }
  | { type: 'SET_GLOSS'; lineKey: string; tokenIndex: number; value: string }
  | { type: 'RESTORE_HISTORY'; item: HistoryItem }
  | { type: 'APPLY_SHARE'; share: ShareState };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.value };
    case 'SET_DIRECTION': {
      // 활성 방향 재선택 무시. 현재 입력을 보관하고 전환할 방향의 입력을 꺼낸다
      // (예전에는 전환할 때마다 입력이 지워졌다)
      if (action.value === state.direction) return state;
      const drafts = { ...state.drafts, [state.direction]: state.input };
      return { ...state, direction: action.value, input: drafts[action.value], drafts };
    }
    case 'RESTORE_HISTORY': {
      // 기록된 방향으로 전환해 복원 — 방향을 저장하지 않던 시절에는 다른 모드에 들어가 변환되지 않았다
      const { item } = action;
      const direction = historyDirection(item);
      const drafts =
        direction === state.direction ? state.drafts : { ...state.drafts, [state.direction]: state.input };
      const sep = item.opts.sep || '';
      return {
        ...state,
        direction,
        drafts,
        input: item.text,
        labial: !!item.opts.labial,
        sepChar: sep,
        // 구분자를 쓴 기록이면 켜서 같은 결과를 재현 (빈 구분자는 켜짐·꺼짐 어느 쪽이든 결과가 같다)
        sepEnabled: sep ? true : state.sepEnabled,
      };
    }
    case 'SET_OPTION':
      return { ...state, ...action.patch };
    case 'SET_FORMAT':
      if (action.value === state.format) return state;
      return { ...state, format: action.value };
    case 'CHANGE_SESSION_DICT': {
      const next = applyChange(state.sessionDict, action.change);
      return next === state.sessionDict ? state : { ...state, sessionDict: next };
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
        drafts: { h2y: '', y2h: '' },
        labial: !!s.l,
        sepChar: s.s || '',
        sepEnabled: !!s.se,
        interlinear: !!s.il,
        numbered: !!s.n,
        format,
        tabCopy: state.tabCopy, // 공유 대상 아님 — 방문자 설정 유지
        keepHyphens: !!s.h,
        wordOverrides: overrides,
        sessionDict: s.u ? dictFromJSON({ segment: s.u.s, whole: s.u.w }) : EMPTY_DICT,
        glossEnabled: !!s.ge,
        glosses,
      };
    }
  }
}

// 사전의 모든 키 (세션 항목 지우기용)
function allKeys(d: UserDict): { scope: DictScope; key: string }[] {
  return [
    ...[...d.segment.keys()].map((key) => ({ scope: 'segment' as const, key })),
    ...[...d.whole.keys()].map((key) => ({ scope: 'whole' as const, key })),
  ];
}

// 부팅: 기본값 구성 후 URL ?s= 가 있으면 APPLY_SHARE를 즉시 적용 (URL이 기본값·localStorage보다 우선)
function initAppState(): AppState {
  const base: AppState = {
    direction: 'h2y',
    input: '',
    drafts: { h2y: '', y2h: '' },
    labial: true,
    sepEnabled: false,
    sepChar: '',
    interlinear: true,
    numbered: false,
    format: readFormat(),
    tabCopy: readTabCopy(),
    keepHyphens: readKeepHyphens(),
    wordOverrides: new Map(),
    sessionDict: EMPTY_DICT,
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
  const [dictOpen, setDictOpen] = useState(false);
  // 사용자 사전 (저장분). 이번 세션 항목(state.sessionDict)과 합쳐 y2h 변환에 넘긴다
  const [userDict, setUserDict] = useState<UserDict>(() => dictFromJSON(readUserDictRaw()));

  // format은 변경 시마다 localStorage에 기록 (공유 URL 복원 포함 — 원본 setFormat 경유 동작, §8-5)
  useEffect(() => {
    writeFormat(state.format);
  }, [state.format]);

  // タブ区切り 설정 영속화
  useEffect(() => {
    writeTabCopy(state.tabCopy);
  }, [state.tabCopy]);

  // 형태소 경계 '-' 표시 설정 영속화
  useEffect(() => {
    writeKeepHyphens(state.keepHyphens);
  }, [state.keepHyphens]);

  // 사용자 사전 영속화 — 읽어 온 값 그대로인 첫 렌더는 건너뛴다
  const dictLoaded = useRef(false);
  useEffect(() => {
    if (!dictLoaded.current) {
      dictLoaded.current = true;
      return;
    }
    if (!writeUserDictRaw(dictToJSON(userDict))) toast(t('dictSaveFailed'), { duration: 4000 });
    // 사전이 바뀔 때만 저장 (t는 언어 전환으로만 바뀐다)
  }, [userDict]);

  // y2h 진입 시 빈도 데이터 lazy load. 로드 완료 시 version 증가 → 출력 재계산
  const freqVersion = useFrequencyData(state.direction);

  const dict = useMemo(() => mergeDicts(userDict, state.sessionDict), [userDict, state.sessionDict]);
  const opts = useMemo(
    () => ({
      ...getOpts({
        sepEnabled: state.sepEnabled,
        sepChar: state.sepChar,
        labial: state.labial,
        keepHyphens: state.keepHyphens,
      }),
      dict: dictSize(dict) ? dict : null,
    }),
    [state.sepEnabled, state.sepChar, state.labial, state.keepHyphens, dict],
  );

  // 출력은 파생값 (§2.1). 대량 입력은 Worker에서 계산하고 그동안 pending (useConvertedOutput)
  // freqVersion: 빈도 데이터 로드 전후로 y2h 결과가 달라지므로 재계산 트리거 (§4.11)
  const { output, pending } = useConvertedOutput({
    text: state.input,
    opts,
    format: state.format,
    numbered: state.numbered,
    direction: state.direction,
    overrides: state.wordOverrides,
    // 글로스 — enabled가 출력 게이트, off·빈 글로스면 기존 출력과 바이트 동일 (§2.4)
    glossEnabled: state.glossEnabled,
    glosses: state.glosses,
    freqVersion,
  });

  const lines = useMemo(() => splitLines(state.input), [state.input]);
  // 인터리니어는 지연 렌더 — 입력이 많아도 카드 재렌더가 타이핑을 막지 않는다 (React가 중단·재개)
  const deferredLines = useDeferredValue(lines);

  // 히스토리 자동 기록 — 500ms 디바운스 (§2.2). 같은 편집 세션은 한 항목을 갱신한다 (storage.recordHistory)
  const historySession = useRef<number | null>(null);
  const historyTimer = useRef<number | undefined>(undefined);
  const saveDraftToHistory = () => {
    historySession.current = recordHistory(
      { text: state.input, opts: { sep: opts.sep, labial: opts.labial }, direction: state.direction },
      historySession.current,
    );
  };
  useEffect(() => {
    historyTimer.current = window.setTimeout(saveDraftToHistory, 500);
    return () => window.clearTimeout(historyTimer.current);
    // saveDraftToHistory는 매 렌더 새로 만들어지지만 결과는 아래 값으로만 정해진다
  }, [state.input, opts.sep, opts.labial, state.direction]);

  // 결과를 사용한 시점(복사·다운로드·공유·방향 전환·복원)에 지금 입력을 확정 기록하고 세션을 끊는다.
  // 이후의 편집은 새 항목이 되어, 사용한 버전이 히스토리에 그대로 남는다
  const commitHistory = () => {
    window.clearTimeout(historyTimer.current);
    saveDraftToHistory();
    historySession.current = null;
  };

  // 대량 입력을 Worker가 변환하는 중이면 이전 결과를 내보내지 않도록 막는다
  const blockWhilePending = () => {
    if (pending) toast(t('convertingWait'), { duration: 2000 });
    return pending;
  };

  // 메인 복사 버튼: plain + タブ区切り ON일 때만 공백 run → 탭 치환 (§4.2)
  const handleCopy = () => {
    if (blockWhilePending()) return;
    const raw = output || '';
    const text = state.format === 'plain' && state.tabCopy ? raw.replace(/[^\S\r\n]+/g, '\t') : raw;
    commitHistory();
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
    if (state.keepHyphens) share.h = true;
    // 받는 사람에게는 사전이 없으므로 이 입력에 쓰인 항목만 함께 보낸다
    const used = usedDictJSON();
    if (Object.keys(used.segment).length || Object.keys(used.whole).length) {
      share.u = {};
      if (Object.keys(used.segment).length) share.u.s = used.segment;
      if (Object.keys(used.whole).length) share.u.w = used.whole;
    }
    return share;
  };

  // 현재 입력의 변환에 쓰인 사전 항목 (y2h만 — h2y 입력에는 해당 없음)
  const usedDictJSON = () =>
    dictToJSON(state.direction === 'y2h' ? entriesUsedIn(state.input, dict) : EMPTY_DICT);

  // 결과 다운로드 (§4.5): 출력이 비면 noContent 토스트 후 중단
  const handleDownload = () => {
    if (blockWhilePending()) return;
    if (!output) {
      toast(t('noContent'), { duration: 2000 });
      return;
    }
    const info = FORMAT_FILE_INFO[state.format] || FORMAT_FILE_INFO.plain;
    commitHistory();
    downloadText(output, `yale-${state.direction}-${timestamp()}.${info.ext}`, info.mime);
  };

  // 백업 JSON (§4.6): 입력이 공백뿐이면 noContent 토스트 후 중단. 복원 기능은 없음
  const handleBackup = () => {
    if (blockWhilePending()) return;
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
      keepHyphens: state.keepHyphens,
      input: state.input,
      output: output || '',
      wordOverrides: state.wordOverrides,
      glosses: collectShareGlosses(lines, state.glosses),
      userDictionary: usedDictJSON(),
      shareUrl: buildShareUrl(captureShare()),
    });
    commitHistory();
    downloadText(JSON.stringify(backup, null, 2), `yale-backup-${timestamp()}.json`, 'application/json');
  };

  // URL 공유 (§3): 현재 상태로 URL 생성 → 클립보드 복사 → 토스트
  const handleShare = () => {
    commitHistory();
    void copyText(buildShareUrl(captureShare())).then(() => toast(t('shareCopied'), { duration: 2000 }));
  };

  // 히스토리 복원: 기록된 방향·입력·구분자·양순음을 적용 (format 등 표시 설정은 불변)
  const handleRestore = (item: HistoryItem) => {
    commitHistory();
    dispatch({ type: 'RESTORE_HISTORY', item });
    setHistOpen(false);
  };

  // 인터리니어(메모화)에 넘기는 콜백은 참조를 고정 — 입력이 바뀔 때마다 카드 전체가 다시 그려지지 않게
  const commitRef = useRef(commitHistory);
  useEffect(() => {
    commitRef.current = commitHistory;
  });
  const onCardCopied = useCallback(() => commitRef.current(), []);
  const onGlossChange = useCallback(
    (lineKey: string, tokenIndex: number, value: string) =>
      dispatch({ type: 'SET_GLOSS', lineKey, tokenIndex, value }),
    [],
  );
  // ===== 사용자 사전 =====
  // remember: 저장된 사전에 기록 (아니면 이번 세션에만). 삭제는 어느 쪽에 있든 지운다
  const tRef = useRef(t);
  const optsRef = useRef(opts);
  useEffect(() => {
    tRef.current = t;
    optsRef.current = opts;
  });
  const applyDictChange = useCallback((change: DictChange, remember: boolean) => {
    if (remember) {
      setUserDict((d) => applyChange(d, change));
      // 같은 키의 세션 항목이 남아 있으면 저장한 항목을 가리므로 함께 지운다
      const added = change.add.map(({ scope, key }) => ({ scope, key }));
      dispatch({ type: 'CHANGE_SESSION_DICT', change: { remove: [...change.remove, ...added] } });
    } else {
      setUserDict((d) => applyChange(d, { remove: change.remove }));
      dispatch({ type: 'CHANGE_SESSION_DICT', change });
    }
    const tr = tRef.current;
    // 범위가 하나뿐이면 알림에 표시 (구간 일치 / 전체 일치)
    const scopes = [...new Set(change.add.map((e) => e.scope))];
    const scopeNote =
      scopes.length === 1
        ? tr('dictScopeParen').replace('{s}', tr(scopes[0] === 'segment' ? 'dictScopeSegment' : 'dictScopeWhole'))
        : '';
    const message = change.add.length
      ? tr(remember ? 'dictSaved' : 'dictSessionOnly').replace('{s}', scopeNote).replace('{e}', summarizeEntries(change.add))
      : tr('dictRemoved').replace('{e}', summarizeEntries(change.remove));
    toast(message, { duration: 3000 });
  }, []);
  const wordEditor = useMemo<WordEditor>(
    () => ({
      describe: (token) => describeToken(token, optsRef.current),
      plan: (token, text) => planCorrection(token, text, optsRef.current),
      apply: applyDictChange,
      remove: (entry) => applyDictChange({ add: [], remove: [entry] }, true),
    }),
    [applyDictChange],
  );
  const handleDictImport = (imported: UserDict) => {
    setUserDict((d) => mergeDicts(d, imported));
    dispatch({ type: 'CHANGE_SESSION_DICT', change: { remove: allKeys(imported) } });
    toast(t('dictImported').replace('{n}', String(dictSize(imported))), { duration: 3000 });
  };
  const handleDictExport = () => {
    downloadText(
      JSON.stringify(buildDictionaryExport(dictToJSON(userDict)), null, 2),
      `yale-dictionary-${timestamp()}.json`,
      'application/json',
    );
  };
  const handleDictClear = () => {
    setUserDict(EMPTY_DICT);
    dispatch({ type: 'CHANGE_SESSION_DICT', change: { remove: allKeys(state.sessionDict) } });
  };

  const handleDirectionChange = (d: Direction) => {
    if (d === state.direction) return;
    commitHistory();
    dispatch({ type: 'SET_DIRECTION', value: d });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        direction={state.direction}
        onDirectionChange={handleDirectionChange}
        onOpenHistory={() => setHistOpen(true)}
        onOpenRef={() => setRefOpen(true)}
        dictCount={dictSize(userDict)}
        onOpenDict={() => setDictOpen(true)}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 md:py-8">
        <section className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <IOPanels
            direction={state.direction}
            input={state.input}
            onInputChange={(v) => dispatch({ type: 'SET_INPUT', value: v })}
            output={output}
            pending={pending}
            format={state.format}
            tabCopy={state.tabCopy}
            onCopied={commitHistory}
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
            keepHyphens={state.keepHyphens}
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
          lines={deferredLines}
          opts={opts}
          format={state.format}
          numbered={state.numbered}
          wordOverrides={state.wordOverrides}
          glossEnabled={state.glossEnabled}
          glosses={state.glosses}
          tabCopy={state.tabCopy}
          dataVersion={freqVersion}
          onCopied={onCardCopied}
          onGlossChange={onGlossChange}
          editor={state.direction === 'y2h' ? wordEditor : null}
        />
      </main>
      <HistoryDrawer open={histOpen} onOpenChange={setHistOpen} onRestore={handleRestore} />
      <RefDrawer open={refOpen} onOpenChange={setRefOpen} />
      <DictionaryDrawer
        open={dictOpen}
        onOpenChange={setDictOpen}
        userDict={userDict}
        sessionDict={state.sessionDict}
        onAdd={(entry: DictEntry) => applyDictChange({ add: [entry], remove: [] }, true)}
        onRemove={(entry: { scope: DictScope; key: string }) => applyDictChange({ add: [], remove: [entry] }, true)}
        onSaveSession={(entries: DictEntry[]) => applyDictChange({ add: entries, remove: [] }, true)}
        onClear={handleDictClear}
        onImport={handleDictImport}
        onExport={handleDictExport}
      />
      <Footer />
      <Toaster />
    </div>
  );
}
