// DOM 참조, 이벤트 바인딩, 렌더링. 변환/포맷/상태 모듈을 조합해 UI를 구성한다
import { convert } from '../converter/h2y.js';
import { reverseConvert, setFrequencyData, parseYaleWordCandidates } from '../converter/y2h.js';
import { CHOSEONG, JUNGSEONG, JONGSEONG, J2Y, DOUBLE_CODA_SPLIT } from '../converter/hangul.js';
import {
  formatPlain, formatLeipzigTSV, formatLatex, formatMarkdown, formatSingleExample,
} from '../converter/format.js';
import {
  state, setDirection, setLang, setFormat, setTheme,
  loadHistory, saveHistory, addHistoryItem,
  addTagToHistoryItem, removeTagFromHistoryItem, getAllTags,
} from './state.js';
import I18N from '../i18n/messages.json' with { type: 'json' };

const FORMAT_LIST = ['plain', 'gloss', 'latex', 'markdown'];

// ===== DOM 참조 =====
const $in = document.getElementById('input');
const $out = document.getElementById('output');
const $sep = document.getElementById('separator');
const $lab = document.getElementById('labialRule');
const $copy = document.getElementById('copyBtn');
const $status = document.getElementById('status');
const $toast = document.getElementById('toast');
const $dirToggle = document.getElementById('directionToggle');

const $interlinearMode = document.getElementById('interlinearMode');
const $interPanel = document.getElementById('interlinearPanel');
const $interlinear = document.getElementById('interlinear');
const $sepPreview = document.getElementById('sepPreview');
const $sepChips = document.getElementById('sepChips');
const $sepEnable = document.getElementById('sepEnable');
const $sepControls = document.getElementById('sepControls');

const $openRef = document.getElementById('openRef');
const $closeRef = document.getElementById('closeRef');
const $refDrawer = document.getElementById('refDrawer');
const $refBody = document.getElementById('refBody');

const $openHist = document.getElementById('openHist');
const $closeHist = document.getElementById('closeHist');
const $histDrawer = document.getElementById('historyDrawer');
const $histList = document.getElementById('histList');
const $clearHist = document.getElementById('clearHist');
const $themeToggle = document.getElementById('themeToggle');
const $backdrop = document.getElementById('backdrop');
const $langToggle = document.getElementById('langToggle');
const $labelInput = document.getElementById('labelInput');
const $labelOutput = document.getElementById('labelOutput');
const $labelLabial = document.getElementById('labelLabial');
const $labelInterlinear = document.getElementById('labelInterlinear');
const $labelSep = document.getElementById('labelSep');
const $ttlInterlinear = document.getElementById('ttlInterlinear');
const $hintInterlinear = document.getElementById('hintInterlinear');
const $hintY2H = document.getElementById('hintY2H');
const $ttlRef = document.getElementById('ttlRef');
const $ttlHist = document.getElementById('ttlHist');
const $formatChips = document.getElementById('formatChips');
const $labelFormat = document.getElementById('labelFormat');
const $exampleNumbering = document.getElementById('exampleNumbering');
const $labelExampleNum = document.getElementById('labelExampleNum');
const $downloadBtn = document.getElementById('downloadBtn');
const $labelDownload = document.getElementById('labelDownload');
const $shareBtn = document.getElementById('shareBtn');
const $labelShare = document.getElementById('labelShare');
const $backupBtn = document.getElementById('backupBtn');
const $labelBackup = document.getElementById('labelBackup');
const $histSearch = document.getElementById('histSearch');
const $histTagFilter = document.getElementById('histTagFilter');

// 히스토리 필터 상태
let histSearchQuery = '';
let histActiveTag = null; // 선택된 태그 또는 null

let COPIED_TEXT = 'Copied!';

// ===== 토스트 =====
let _toastTimer = null;
function showToast(msg) {
  if (!$toast) return;
  clearTimeout(_toastTimer);
  $toast.textContent = msg;
  $toast.classList.add('show');
  _toastTimer = setTimeout(() => { $toast.classList.remove('show'); }, 2000);
}

// ===== 변환 옵션 / 형식별 출력 =====
function getOpts() {
  const sep = ($sepEnable && !$sepEnable.checked) ? '' : ($sep.value || '').slice(0, 1);
  const labial = !!$lab.checked;
  return { sep, labial };
}

function splitLines(text) {
  return (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

// y2h 모드에서 사용자가 popover로 고른 word 교체. 키는 입력 yale word 문자열.
// 같은 word가 입력에 다시 나오면 자동 적용. 페이지 reload 시 사라짐 (sessionStorage 미사용)
const wordOverrides = new Map();

// 후보 목록과 사용자 override를 비교해 표시할 hangul 결정
function pickPreferred(yaleWord, candidates) {
  const override = wordOverrides.get(yaleWord);
  if (override && candidates.some(c => c.hangul === override)) return override;
  return candidates[0]?.hangul || '';
}

// 토큰 단위 변환 결과를 [{tokens, romas}, ...]로 직조
// y2h 모드: word별 후보 + override 적용. h2y 모드: 결정론적
function buildExamples(text, opts) {
  const out = [];
  for (const line of splitLines(text)) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    let romas;
    if (state.conversionDir === 'y2h') {
      romas = tokens.map(t => {
        const cands = parseYaleWordCandidates(t, opts, 5);
        return pickPreferred(t, cands);
      });
    } else {
      romas = tokens.map(t => convert(t, opts));
    }
    out.push({ tokens, romas });
  }
  return out;
}

// 형식별 출력 텍스트 생성
function buildFormattedOutput(text, opts, format) {
  if (!text || !text.trim()) return '';
  const numbered = !!$exampleNumbering?.checked;
  if (format === 'plain' || !format) {
    // numbered ON 또는 y2h+override 시 examples 경로(줄별 처리),
    // 그 외 fast-path: 통째 변환으로 줄바꿈/구두점 보존
    const needsExamples = numbered || (state.conversionDir === 'y2h' && wordOverrides.size > 0);
    if (needsExamples) return formatPlain(buildExamples(text, opts), { numbered });
    return state.conversionDir === 'y2h'
      ? reverseConvert(text, opts)
      : convert(text, opts);
  }
  const examples = buildExamples(text, opts);
  switch (format) {
    case 'gloss': return formatLeipzigTSV(examples, { numbered });
    case 'latex': return formatLatex(examples);
    case 'markdown': return formatMarkdown(examples, { numbered });
    default: return formatPlain(examples, { numbered });
  }
}

function updateSingle() {
  $out.value = buildFormattedOutput($in.value, getOpts(), state.currentFormat);
}

function renderInterlinear(lines, opts) {
  $interlinear.innerHTML = '';
  const frag = document.createDocumentFragment();
  const isY2H = state.conversionDir === 'y2h';

  lines.forEach((line, idx) => {
    const block = document.createElement('div');
    block.className = 'inter-block';
    const tokens = line.split(/\s+/).filter(Boolean);

    // y2h 모드: word별 top-K 후보 수집, 다후보 word는 클릭 가능
    let candidatesByWord = null;
    let romas;
    if (isY2H) {
      candidatesByWord = tokens.map(t => parseYaleWordCandidates(t, opts, 5));
      // pickPreferred로 사용자 override 반영
      romas = candidatesByWord.map((cs, i) => pickPreferred(tokens[i], cs));
    } else {
      romas = tokens.map(t => convert(t, opts));
    }

    const top = document.createElement('div');
    top.className = 'line top mono';
    top.textContent = tokens.join(' ');

    const bottom = document.createElement('div');
    bottom.className = 'line bottom mono';

    if (isY2H) {
      romas.forEach((roma, i) => {
        const span = document.createElement('span');
        const ambiguous = (candidatesByWord[i]?.length || 0) > 1;
        const edited = wordOverrides.has(tokens[i]);
        let cls = 'inter-word';
        if (ambiguous) cls += ' ambiguous';
        if (edited && ambiguous) cls += ' edited';
        span.className = cls;
        span.dataset.idx = String(i);
        span.textContent = roma;
        bottom.appendChild(span);
        if (i < romas.length - 1) bottom.appendChild(document.createTextNode(' '));
      });
    } else {
      bottom.textContent = romas.join(' ');
    }

    block.appendChild(top);
    block.appendChild(bottom);

    block.addEventListener('click', (e) => {
      // 다후보 word 클릭은 popover (카드 복사로 bubble되지 않게 stop)
      const wordEl = e.target.closest('.inter-word.ambiguous');
      if (wordEl && isY2H && candidatesByWord) {
        e.stopPropagation();
        const wIdx = Number(wordEl.dataset.idx);
        const yaleWord = tokens[wIdx];
        const currentSelected = wordOverrides.get(yaleWord) || candidatesByWord[wIdx][0]?.hangul;
        showCandidatePopover(wordEl, candidatesByWord[wIdx], currentSelected, (selected) => {
          wordOverrides.set(yaleWord, selected);
          updateAll();   // 출력 textarea + 인터리니어 + 다운로드/공유 일괄 갱신
        });
        return;
      }
      // 그 외 클릭 = 현재 형식으로 카드 전체 복사
      const numbered = !!$exampleNumbering?.checked;
      copy(formatSingleExample(tokens, romas, state.currentFormat, { numbered, exampleIndex: idx }));
    });
    frag.appendChild(block);
  });
  $interlinear.appendChild(frag);
}

// ===== 후보 popover (모호성 있는 word 교체용) =====
let _activePopover = null;
let _popoverOutsideHandler = null;

function showCandidatePopover(anchor, candidates, currentSelected, onSelect) {
  hideCandidatePopover();
  if (!candidates?.length) return;

  const pop = document.createElement('div');
  pop.className = 'candidate-popover';
  candidates.forEach((c, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    let cls = 'candidate-item';
    if (i === 0) cls += ' best';
    if (c.hangul === currentSelected) cls += ' selected';
    item.className = cls;
    item.textContent = c.hangul;
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onSelect(c.hangul);
      hideCandidatePopover();
    });
    pop.appendChild(item);
  });

  document.body.appendChild(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.position = 'absolute';
  pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (rect.left + window.scrollX) + 'px';

  _activePopover = pop;
  _popoverOutsideHandler = (ev) => {
    if (!pop.contains(ev.target)) hideCandidatePopover();
  };
  // 현재 클릭 이벤트가 끝난 다음 tick에 outside listener 등록
  setTimeout(() => document.addEventListener('click', _popoverOutsideHandler), 0);
}

function hideCandidatePopover() {
  if (_activePopover) { _activePopover.remove(); _activePopover = null; }
  if (_popoverOutsideHandler) {
    document.removeEventListener('click', _popoverOutsideHandler);
    _popoverOutsideHandler = null;
  }
}

function togglePanels(lines, opts) {
  if ($interlinearMode.checked) {
    $interPanel.classList.remove('hidden');
    $interPanel.setAttribute('aria-hidden', 'false');
    renderInterlinear(lines, opts);
  } else {
    $interPanel.classList.add('hidden');
    $interPanel.setAttribute('aria-hidden', 'true');
  }
}

function updateAll() {
  const opts = getOpts();
  updateSingle();
  const lines = splitLines($in.value);
  togglePanels(lines, opts);
  persistHistoryDebounced();
  if ($sepPreview) $sepPreview.textContent = opts.sep ? (opts.sep === ' ' ? '␣' : opts.sep) : '∅';
  if ($sepChips) {
    Array.from($sepChips.querySelectorAll('.chip'))
      .forEach(b => b.classList.toggle('active', (b.dataset.sep || '') === opts.sep));
  }
  if ($sepControls) {
    $sepControls.classList.toggle('hidden', state.conversionDir === 'y2h' || !$sepEnable?.checked);
  }
  if ($formatChips) {
    Array.from($formatChips.querySelectorAll('.chip'))
      .forEach(b => b.classList.toggle('active', b.dataset.format === state.currentFormat));
  }
}

// ===== 클립보드 =====
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(COPIED_TEXT);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
    showToast(COPIED_TEXT);
  }
}

// 텍스트영역 선택분 자동 복사 (Plain 출력만 공백→탭 변환)
function getSelectedFromTextarea(textarea) {
  if (!textarea) return '';
  if (typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    return (e > s) ? textarea.value.slice(s, e) : '';
  }
  const sel = window.getSelection && window.getSelection();
  return sel ? String(sel) : '';
}

let _autoCopyTimer = null;
function autoCopySelected(textarea, isOutput = false) {
  clearTimeout(_autoCopyTimer);
  _autoCopyTimer = setTimeout(() => {
    const sel = getSelectedFromTextarea(textarea);
    if (!sel) return;
    const text = (isOutput && state.currentFormat === 'plain')
      ? sel.replace(/[^\S\r\n]+/g, '\t')
      : sel;
    copy(text);
  }, 10);
}

// ===== 히스토리 렌더링 =====
let histTimer = null;
function persistHistoryDebounced() {
  clearTimeout(histTimer);
  histTimer = setTimeout(() => {
    addHistoryItem({ text: $in.value, opts: getOpts() });
  }, 500);
}

function renderHistory() {
  const T = I18N[state.currentLang] || I18N.ja;
  const all = loadHistory().sort((a, b) => (b.pinned - a.pinned) || (b.id - a.id));

  // 검색·태그 필터 적용
  const q = histSearchQuery.trim().toLowerCase();
  const filtered = all.filter(h => {
    if (histActiveTag && !(h.tags || []).includes(histActiveTag)) return false;
    if (q && !h.text.toLowerCase().includes(q)) return false;
    return true;
  });

  // 태그 필터 영역 렌더 (모든 태그)
  renderTagFilter();

  $histList.innerHTML = '';
  if (all.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = T.emptyHist;
    $histList.appendChild(p);
    return;
  }
  if (filtered.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = T.noMatch || 'No match';
    $histList.appendChild(p);
    return;
  }

  for (const h of filtered) {
    const div = document.createElement('div');
    div.className = 'history-item';
    const firstLine = (h.text.split(/\r?\n/)[0] || '').slice(0, 80);

    const meta = document.createElement('div');
    meta.className = 'hist-meta';
    const tsBadge = document.createElement('span');
    tsBadge.className = 'badge';
    tsBadge.textContent = new Date(h.id).toLocaleString();
    meta.appendChild(tsBadge);
    if (h.pinned) {
      const pinBadge = document.createElement('span');
      pinBadge.className = 'badge pin';
      pinBadge.textContent = 'PIN';
      meta.appendChild(pinBadge);
    }
    const sepBadge = document.createElement('span');
    sepBadge.className = 'badge';
    sepBadge.textContent = 'sep:' + (h.opts.sep || '∅');
    meta.appendChild(sepBadge);
    const labBadge = document.createElement('span');
    labBadge.className = 'badge';
    labBadge.textContent = h.opts.labial ? 'labial:on' : 'labial:off';
    meta.appendChild(labBadge);

    const mono = document.createElement('div');
    mono.className = 'mono';
    mono.textContent = firstLine + (h.text.length > 80 ? '…' : '');

    // 태그 영역: 기존 태그 chip + "+" 버튼
    const tagRow = document.createElement('div');
    tagRow.className = 'hist-tags';
    for (const tag of (h.tags || [])) {
      const tagEl = document.createElement('span');
      tagEl.className = 'hist-tag';
      tagEl.textContent = tag;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'hist-tag-x';
      x.dataset.act = 'untag';
      x.dataset.id = h.id;
      x.dataset.tag = tag;
      x.textContent = '×';
      x.setAttribute('aria-label', `Remove tag ${tag}`);
      tagEl.appendChild(x);
      tagRow.appendChild(tagEl);
    }
    const addTagBtn = document.createElement('button');
    addTagBtn.type = 'button';
    addTagBtn.className = 'hist-tag-add';
    addTagBtn.dataset.act = 'addtag';
    addTagBtn.dataset.id = h.id;
    addTagBtn.textContent = '+ tag';
    tagRow.appendChild(addTagBtn);

    const tools = document.createElement('div');
    tools.className = 'hist-tools';
    for (const [act, label] of [['restore', 'Restore'], ['pin', h.pinned ? 'Unpin' : 'Pin'], ['delete', 'Delete']]) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.dataset.act = act;
      btn.dataset.id = h.id;
      btn.textContent = label;
      tools.appendChild(btn);
    }

    div.appendChild(meta);
    div.appendChild(mono);
    div.appendChild(tagRow);
    div.appendChild(tools);
    $histList.appendChild(div);
  }
}

// 태그 필터 영역 — 모든 태그 chip + 활성 표시
function renderTagFilter() {
  if (!$histTagFilter) return;
  const tags = getAllTags();
  $histTagFilter.innerHTML = '';
  if (tags.length === 0) {
    $histTagFilter.classList.add('hidden');
    return;
  }
  $histTagFilter.classList.remove('hidden');
  for (const tag of tags) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'hist-tag-chip' + (tag === histActiveTag ? ' active' : '');
    chip.dataset.tag = tag;
    chip.textContent = tag;
    $histTagFilter.appendChild(chip);
  }
}

// ===== 참조표 =====
function makeSection(title, entries) {
  const wrap = document.createElement('div');
  wrap.className = 'map-section';
  const ttl = document.createElement('div');
  ttl.className = 'ttl';
  ttl.textContent = title;
  wrap.appendChild(ttl);
  const body = document.createElement('div');
  body.className = 'body';
  for (const [j, y] of entries) {
    const cell = document.createElement('div');
    cell.className = 'map-cell';
    cell.title = `${j} → ${y}`;
    cell.textContent = j;
    const sm = document.createElement('small');
    sm.textContent = y;
    cell.appendChild(sm);
    body.appendChild(cell);
  }
  wrap.appendChild(body);
  return wrap;
}

function buildRefTable() {
  const grid = document.createElement('div');
  grid.className = 'map-grid';

  const onsetEntries = CHOSEONG.map(j => [j, j === 'ㅇ' ? '∅' : (J2Y[j] || '—')]);
  const nucleusEntries = JUNGSEONG.map(j => [j, J2Y[j] || '—']);
  const codaEntries = JONGSEONG.filter(Boolean).map(j => {
    if (DOUBLE_CODA_SPLIT[j]) {
      const split = DOUBLE_CODA_SPLIT[j];
      const yale = Array.from(split).map(c => J2Y[c] || '?').join('');
      return [j, yale];
    }
    return [j, J2Y[j] || '—'];
  });

  grid.appendChild(makeSection('초성 (onset)', onsetEntries));
  grid.appendChild(makeSection('중성 (nucleus)', nucleusEntries));
  grid.appendChild(makeSection('종성 (coda)', codaEntries));

  $refBody.innerHTML = '';
  $refBody.appendChild(grid);
  const T = I18N[state.currentLang] || I18N.ja;
  if (T.refNote) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = T.refNote;
    $refBody.appendChild(note);
  }
}

// ===== 드로어 =====
function openDrawer($el, $btn) {
  $el.classList.add('open');
  $el.setAttribute('aria-hidden', 'false');
  if ($btn) $btn.setAttribute('aria-expanded', 'true');
  if ($backdrop) $backdrop.hidden = false;
}
function closeDrawer($el, $btn) {
  $el.classList.remove('open');
  $el.setAttribute('aria-hidden', 'true');
  if ($btn) $btn.setAttribute('aria-expanded', 'false');
  if ($backdrop && !$refDrawer.classList.contains('open') && !$histDrawer.classList.contains('open')) {
    $backdrop.hidden = true;
  }
}

// ===== 방향 전환 =====
function applyDirection(dir) {
  setDirection(dir);
  // Yale → 한글 모드 진입 시점에 빈도 데이터를 lazy load
  if (dir === 'y2h') loadFrequencyData();
  const T = I18N[state.currentLang] || I18N.ja;
  $dirToggle.querySelectorAll('.dir-btn').forEach(b => {
    const isActive = b.dataset.dir === dir;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', String(isActive));
  });
  if (dir === 'y2h') {
    $labelInput.textContent = T.labelInputY2H || 'Yale';
    $labelOutput.textContent = T.labelOutputY2H || '한글';
    $in.setAttribute('placeholder', T.placeholderY2H || 'hankwuk-e');
    if ($sepEnable) $sepEnable.closest('.switch').classList.add('hidden');
    if ($sepControls) $sepControls.classList.add('hidden');
    if ($hintY2H) {
      $hintY2H.textContent = T.hintY2H || '';
      $hintY2H.classList.remove('hidden');
    }
  } else {
    $labelInput.textContent = T.labelInput;
    $labelOutput.textContent = T.labelOutput;
    $in.setAttribute('placeholder', T.placeholderH2Y || '입력 대기 중');
    if ($sepEnable) $sepEnable.closest('.switch').classList.remove('hidden');
    if ($hintY2H) $hintY2H.classList.add('hidden');
  }
  $in.value = '';
  updateAll();
}

// ===== 테마 =====
const SVG_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const SVG_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function applyTheme(theme) {
  setTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  if ($themeToggle) {
    const light = theme === 'light';
    $themeToggle.setAttribute('aria-pressed', String(!light));
    $themeToggle.innerHTML = light ? SVG_SUN : SVG_MOON;
  }
}

// ===== 언어 =====
function applyLang(lang) {
  setLang(lang);
  document.documentElement.lang = lang;
  const T = I18N[lang] || I18N.ja;
  $openHist.textContent = T.openHist;
  $openRef.textContent = T.openRef;
  $copy.textContent = T.copyBtn;
  if (state.conversionDir === 'y2h') {
    $labelInput.textContent = T.labelInputY2H;
    $labelOutput.textContent = T.labelOutputY2H;
    $in.setAttribute('placeholder', T.placeholderY2H);
  } else {
    $labelInput.textContent = T.labelInput;
    $labelOutput.textContent = T.labelOutput;
    $in.setAttribute('placeholder', T.placeholderH2Y);
  }
  $labelLabial.textContent = T.labelLabial;
  $labelInterlinear.textContent = T.labelInterlinear;
  $labelSep.textContent = T.labelSep;
  $ttlInterlinear.textContent = T.ttlInterlinear;
  $hintInterlinear.textContent = T.hintInterlinear;
  if ($hintY2H && state.conversionDir === 'y2h') $hintY2H.textContent = T.hintY2H || '';
  $ttlRef.textContent = T.ttlRef;
  $ttlHist.textContent = T.ttlHist;
  $clearHist.textContent = T.clearHist;
  $closeRef.textContent = T.closeRef;
  $closeHist.textContent = T.closeHist;
  $sep.setAttribute('placeholder', T.sepPlaceholder);
  if ($langToggle) $langToggle.textContent = T.langToggle;
  if ($labelFormat) $labelFormat.textContent = T.labelFormat || '';
  if ($labelExampleNum) $labelExampleNum.textContent = T.labelExampleNum || '';
  if ($labelDownload) $labelDownload.textContent = T.labelDownload || '';
  if ($labelShare) $labelShare.textContent = T.labelShare || '';
  if ($labelBackup) $labelBackup.textContent = T.labelBackup || '';
  if ($backupBtn && T.backupTooltip) $backupBtn.title = T.backupTooltip;
  if ($histSearch) $histSearch.placeholder = T.histSearchPlaceholder || '';
  COPIED_TEXT = T.copied;
}

// ===== 파일 업로드 (드래그 앤 드롭) =====
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function setupFileDrop() {
  if (!$in) return;
  ['dragenter', 'dragover'].forEach(ev => {
    $in.addEventListener(ev, (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      $in.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    $in.addEventListener(ev, (e) => {
      e.preventDefault();
      $in.classList.remove('dragover');
    });
  });
  $in.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const T = I18N[state.currentLang] || I18N.ja;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(T.fileTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      $in.value = String(reader.result || '');
      updateAll();
    };
    reader.onerror = () => showToast('Read error');
    reader.readAsText(file);
  });
}

// ===== 결과 다운로드 =====
const FORMAT_FILE_INFO = {
  plain:    { ext: 'txt', mime: 'text/plain' },
  gloss:    { ext: 'tsv', mime: 'text/tab-separated-values' },
  latex:    { ext: 'tex', mime: 'application/x-tex' },
  markdown: { ext: 'md',  mime: 'text/markdown' },
};

// 전체 상태(입력+출력+옵션+공유 URL+override)를 단일 JSON으로 다운로드
function downloadBackup() {
  const T = I18N[state.currentLang] || I18N.ja;
  const inputText = $in.value || '';
  if (!inputText.trim()) { showToast(T.noContent); return; }
  const opts = getOpts();
  const backup = {
    version: 1,
    tool: 'Hangul ↔ Yale Romanizer',
    exportedAt: new Date().toISOString(),
    direction: state.conversionDir,
    options: {
      labial: opts.labial,
      separator: opts.sep,
      separatorEnabled: !!$sepEnable?.checked,
      interlinear: !!$interlinearMode?.checked,
      format: state.currentFormat,
      exampleNumbering: !!$exampleNumbering?.checked,
    },
    input: inputText,
    output: $out.value || '',
    wordOverrides: wordOverrides.size > 0 ? Object.fromEntries(wordOverrides) : {},
    shareUrl: buildShareUrl(),
  };
  const json = JSON.stringify(backup, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `yale-backup-${stamp}.json`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadResult() {
  const text = $out.value || '';
  const T = I18N[state.currentLang] || I18N.ja;
  if (!text) { showToast(T.noContent); return; }
  const info = FORMAT_FILE_INFO[state.currentFormat] || FORMAT_FILE_INFO.plain;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `yale-${state.conversionDir}-${stamp}.${info.ext}`;
  const blob = new Blob([text], { type: `${info.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== URL 공유 (입력+옵션 → URL-safe base64) =====
function b64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(s) {
  let std = s.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4) std += '=';
  const bin = atob(std);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function captureShareState() {
  const opts = getOpts();
  const out = {
    d: state.conversionDir,
    i: $in.value || '',
    l: opts.labial,
    s: opts.sep,
    se: !!$sepEnable?.checked,
    il: !!$interlinearMode?.checked,
    f: state.currentFormat,
    n: !!$exampleNumbering?.checked,
  };
  // 사용자가 popover로 고른 word 교체 — 있을 때만 포함 (URL 길이 절약)
  if (wordOverrides.size > 0) out.o = Object.fromEntries(wordOverrides);
  return out;
}

function applyShareState(s) {
  // 방향 먼저 (applyDirection이 input을 비우므로 input보다 먼저)
  if (s.d === 'y2h' && state.conversionDir !== 'y2h') applyDirection('y2h');
  else if (s.d === 'h2y' && state.conversionDir !== 'h2y') applyDirection('h2y');
  if ($lab) $lab.checked = !!s.l;
  if ($sep) $sep.value = s.s || '';
  if ($sepEnable) $sepEnable.checked = !!s.se;
  if ($interlinearMode) $interlinearMode.checked = !!s.il;
  if ($exampleNumbering) $exampleNumbering.checked = !!s.n;
  if (s.f) setFormat(s.f);
  // word override 복원 (먼저 비우고 새로 채움)
  wordOverrides.clear();
  if (s.o && typeof s.o === 'object') {
    for (const [k, v] of Object.entries(s.o)) wordOverrides.set(k, v);
  }
  $in.value = s.i || '';
  updateAll();
}

function buildShareUrl() {
  const json = JSON.stringify(captureShareState());
  return location.origin + location.pathname + '?s=' + b64UrlEncode(json);
}

async function shareUrl() {
  const url = buildShareUrl();
  const T = I18N[state.currentLang] || I18N.ja;
  try {
    await navigator.clipboard.writeText(url);
    showToast(T.shareCopied);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
    showToast(T.shareCopied);
  }
}

function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const s = params.get('s');
  if (!s) return false;
  try {
    const decoded = JSON.parse(b64UrlDecode(s));
    applyShareState(decoded);
    return true;
  } catch (err) {
    console.warn('[Yale] URL 공유 데이터 파싱 실패:', err);
    return false;
  }
}

// ===== 빈도 데이터 lazy load =====
// y2h 모드 진입 시점에만 fetch. 한 번 받으면 Promise를 캐시해 재호출에서 재사용.
// h2y만 쓰는 사용자는 478KB 데이터를 다운로드하지 않음.
let _freqLoadPromise = null;

function loadFrequencyData() {
  if (_freqLoadPromise) return _freqLoadPromise;
  _freqLoadPromise = fetch('data/syllable-freq.json')
    .then(r => r.json())
    .then(data => {
      setFrequencyData({ syllable: data.u || null, bigram: data.b || null, word: data.w || null });
      updateAll();
    })
    .catch((err) => {
      console.warn('[Yale] 빈도 데이터 로딩 실패, 기본 파서 사용:', err);
      _freqLoadPromise = null; // 실패 시 다음 시도 가능하게
    });
  return _freqLoadPromise;
}

// ===== 이벤트 바인딩 + 진입 =====
export function init() {
  // 자동 복사
  if ($in) {
    $in.addEventListener('mouseup', () => autoCopySelected($in, false));
    $in.addEventListener('touchend', () => autoCopySelected($in, false), { passive: true });
    $in.addEventListener('keyup', (e) => {
      const key = e.key || '';
      if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
        autoCopySelected($in, false);
      }
    });
  }
  if ($out) {
    $out.addEventListener('mouseup', () => autoCopySelected($out, true));
    $out.addEventListener('touchend', () => autoCopySelected($out, true), { passive: true });
    $out.addEventListener('keyup', (e) => {
      const key = e.key || '';
      if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
        autoCopySelected($out, true);
      }
    });
  }

  // 히스토리 액션
  $histList?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    // renderHistory()로 타겟 detach되면 document 외부클릭 핸들러가 드로어를 닫는다 — 차단
    e.stopPropagation();
    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;

    // 태그 추가/제거 (드로어 유지)
    if (act === 'addtag') {
      const T = I18N[state.currentLang] || I18N.ja;
      const tag = window.prompt(T.addTagPrompt || 'Add tag');
      if (tag) {
        addTagToHistoryItem(id, tag);
        renderHistory();
      }
      return;
    }
    if (act === 'untag') {
      removeTagFromHistoryItem(id, btn.dataset.tag);
      renderHistory();
      return;
    }

    let hist = loadHistory();
    const idx = hist.findIndex(h => h.id === id);
    if (idx < 0) return;

    if (act === 'restore') {
      const h = hist[idx];
      $in.value = h.text;
      $sep.value = h.opts.sep || '';
      $lab.checked = !!h.opts.labial;
      updateAll();
      closeDrawer($histDrawer, $openHist);
    } else if (act === 'pin') {
      hist[idx].pinned = !hist[idx].pinned;
      saveHistory(hist);
      renderHistory();
    } else if (act === 'delete') {
      hist.splice(idx, 1);
      saveHistory(hist);
      renderHistory();
    }
  });
  $clearHist?.addEventListener('click', () => {
    saveHistory([]);
    histActiveTag = null;
    histSearchQuery = '';
    if ($histSearch) $histSearch.value = '';
    renderHistory();
  });

  // 검색 입력
  $histSearch?.addEventListener('input', (e) => {
    histSearchQuery = e.target.value || '';
    renderHistory();
  });

  // 태그 필터 chip 클릭
  $histTagFilter?.addEventListener('click', (e) => {
    const chip = e.target.closest('.hist-tag-chip');
    if (!chip) return;
    const tag = chip.dataset.tag;
    histActiveTag = (histActiveTag === tag) ? null : tag;
    renderHistory();
  });

  // 드로어
  $openRef?.addEventListener('click', () => { buildRefTable(); openDrawer($refDrawer, $openRef); });
  $closeRef?.addEventListener('click', () => closeDrawer($refDrawer, $openRef));
  $openHist?.addEventListener('click', () => { renderHistory(); openDrawer($histDrawer, $openHist); });
  $closeHist?.addEventListener('click', () => closeDrawer($histDrawer, $openHist));

  // 메인 입력/옵션
  document.addEventListener('keydown', (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key === 'Enter') { e.preventDefault(); updateAll(); }
  });
  $in.addEventListener('input', updateAll);
  $sep.addEventListener('input', updateAll);
  $sepEnable?.addEventListener('change', updateAll);
  $lab.addEventListener('change', updateAll);
  $interlinearMode.addEventListener('change', updateAll);

  // 방향 전환
  $dirToggle?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dir-btn');
    if (!btn || btn.classList.contains('active')) return;
    applyDirection(btn.dataset.dir);
  });

  // 메인 복사 버튼
  $copy.addEventListener('click', () => {
    const raw = $out.value || '';
    const text = state.currentFormat === 'plain'
      ? raw.replace(/[^\S\r\n]+/g, '\t')
      : raw;
    copy(text);
  });

  // 출력 형식 chip
  $formatChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const fmt = btn.dataset.format;
    if (!FORMAT_LIST.includes(fmt) || fmt === state.currentFormat) return;
    setFormat(fmt);
    updateAll();
  });
  $exampleNumbering?.addEventListener('change', updateAll);

  // 구분자 chip
  $sepChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $sep.value = btn.dataset.sep ?? '';
    updateAll();
  });

  // 메인 화면/배경 클릭으로 드로어 닫기
  document.addEventListener('click', (e) => {
    const insideRef = e.target.closest?.('#refDrawer, #openRef, #closeRef');
    const insideHist = e.target.closest?.('#historyDrawer, #openHist, #closeHist, #histList, .drawer-tools');
    if (!insideRef && $refDrawer.classList.contains('open')) closeDrawer($refDrawer, $openRef);
    if (!insideHist && $histDrawer.classList.contains('open')) closeDrawer($histDrawer, $openHist);
  });
  $backdrop?.addEventListener('click', () => {
    if ($refDrawer.classList.contains('open')) closeDrawer($refDrawer, $openRef);
    if ($histDrawer.classList.contains('open')) closeDrawer($histDrawer, $openHist);
  });

  // 테마/언어 토글
  $themeToggle?.addEventListener('click', () => {
    const next = (document.documentElement.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
    applyTheme(next);
  });
  $langToggle?.addEventListener('click', () => {
    applyLang(state.currentLang === 'ja' ? 'ko' : 'ja');
  });

  // 다운로드 / 백업 / URL 공유
  $downloadBtn?.addEventListener('click', downloadResult);
  $backupBtn?.addEventListener('click', downloadBackup);
  $shareBtn?.addEventListener('click', shareUrl);

  // 파일 드래그 앤 드롭
  setupFileDrop();

  // 초기 적용
  applyTheme(state.currentTheme);
  applyLang(state.currentLang);
  // URL에 공유 데이터가 있으면 그것을 우선 (y2h가 들어 있으면 applyDirection 경유로 빈도 데이터 lazy load)
  const restoredFromUrl = loadFromUrl();
  if (!restoredFromUrl) {
    $in.value = '';
    updateAll();
  }
}
