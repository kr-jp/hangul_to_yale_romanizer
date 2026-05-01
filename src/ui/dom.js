// DOM 참조, 이벤트 바인딩, 렌더링. 변환/포맷/상태 모듈을 조합해 UI를 구성한다
import { convert } from '../converter/h2y.js';
import { reverseConvert, setFrequencyData } from '../converter/y2h.js';
import { CHOSEONG, JUNGSEONG, JONGSEONG, J2Y, DOUBLE_CODA_SPLIT } from '../converter/hangul.js';
import {
  formatPlain, formatLeipzigTSV, formatLatex, formatMarkdown, formatSingleExample,
} from '../converter/format.js';
import {
  state, setDirection, setLang, setFormat, setTheme,
  loadHistory, saveHistory, addHistoryItem,
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

// 토큰 단위 변환 결과를 [{tokens, romas}, ...]로 직조 (Plain 외 형식의 입력)
function buildExamples(text, opts) {
  const out = [];
  for (const line of splitLines(text)) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const romas = state.conversionDir === 'y2h'
      ? tokens.map(t => reverseConvert(t, opts))
      : tokens.map(t => convert(t, opts));
    out.push({ tokens, romas });
  }
  return out;
}

// 형식별 출력 텍스트 생성
function buildFormattedOutput(text, opts, format) {
  if (!text || !text.trim()) return '';
  if (format === 'plain' || !format) {
    return state.conversionDir === 'y2h'
      ? reverseConvert(text, opts)
      : convert(text, opts);
  }
  const examples = buildExamples(text, opts);
  const numbered = !!$exampleNumbering?.checked;
  switch (format) {
    case 'gloss': return formatLeipzigTSV(examples, { numbered });
    case 'latex': return formatLatex(examples);
    case 'markdown': return formatMarkdown(examples, { numbered });
    default: return formatPlain(examples);
  }
}

function updateSingle() {
  $out.value = buildFormattedOutput($in.value, getOpts(), state.currentFormat);
}

function renderInterlinear(lines, opts) {
  $interlinear.innerHTML = '';
  const frag = document.createDocumentFragment();
  lines.forEach((line, idx) => {
    const block = document.createElement('div');
    block.className = 'inter-block';
    const tokens = line.split(/\s+/).filter(Boolean);
    const romas = state.conversionDir === 'y2h'
      ? tokens.map(t => reverseConvert(t, opts))
      : tokens.map(t => convert(t, opts));
    const top = document.createElement('div');
    top.className = 'line top mono';
    top.textContent = tokens.join(' ');
    const bottom = document.createElement('div');
    bottom.className = 'line bottom mono';
    bottom.textContent = romas.join(' ');
    block.appendChild(top); block.appendChild(bottom);

    block.addEventListener('click', () => {
      const numbered = !!$exampleNumbering?.checked;
      copy(formatSingleExample(tokens, romas, state.currentFormat, { numbered, exampleIndex: idx }));
    });
    frag.appendChild(block);
  });
  $interlinear.appendChild(frag);
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
  const hist = loadHistory().sort((a, b) => (b.pinned - a.pinned) || (b.id - a.id));
  $histList.innerHTML = '';
  if (hist.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = (I18N[state.currentLang] || I18N.ja).emptyHist;
    $histList.appendChild(p);
    return;
  }
  for (const h of hist) {
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
    div.appendChild(tools);
    $histList.appendChild(div);
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
  COPIED_TEXT = T.copied;
}

// ===== 빈도 데이터 로드 =====
function loadFrequencyData() {
  fetch('data/syllable-freq.json')
    .then(r => r.json())
    .then(data => {
      setFrequencyData({ syllable: data.u || null, bigram: data.b || null, word: data.w || null });
      updateAll();
    })
    .catch((err) => {
      console.warn('[Yale] 빈도 데이터 로딩 실패, 기본 파서 사용:', err);
    });
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
    const id = Number(btn.dataset.id);
    let hist = loadHistory();
    const idx = hist.findIndex(h => h.id === id);
    if (idx < 0) return;

    const act = btn.dataset.act;
    if (act === 'restore') {
      const h = hist[idx];
      $in.value = h.text;
      $sep.value = h.opts.sep || '';
      $lab.checked = !!h.opts.labial;
      updateAll();
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
  $clearHist?.addEventListener('click', () => { saveHistory([]); renderHistory(); });

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

  // 초기 적용
  applyTheme(state.currentTheme);
  applyLang(state.currentLang);
  $in.value = '';
  loadFrequencyData();
  updateAll();
}
