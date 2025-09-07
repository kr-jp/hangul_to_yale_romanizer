// Hangul → Yale Romanization (client-side)

(function () {
  'use strict';

  // ===== Unicode & 표 구성 =====
  const SBase = 0xAC00;
  const LBase = 0x1100;
  const VBase = 0x1161;
  const TBase = 0x11A7;
  const LCount = 19;
  const VCount = 21;
  const TCount = 28;
  const NCount = VCount * TCount;
  const SCount = LCount * NCount;

  const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNGSEONG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONGSEONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  const DOUBLE_CODA_SPLIT = {
    'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
    'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
    'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ'
  };

  // Yale 매핑
  const J2Y = {
    // consonants
    'ㅂ':'p','ㄷ':'t','ㅌ':'th','ㅈ':'c','ㅉ':'cc','ㅊ':'ch','ㄱ':'k','ㅎ':'h','ㄲ':'kk','ㅋ':'kh','ㄹ':'l','ㅁ':'m','ㄴ':'n','ㅇ':'ng','ㄸ':'tt','ㅃ':'pp','ㅍ':'ph','ㅅ':'s','ㅆ':'ss',
    // vowels
    'ㅏ':'a','ㅔ':'ey','ㅐ':'ay','ㅣ':'i','ㅗ':'o','ㅚ':'oy','ㅜ':'wu','ㅓ':'e','ㅡ':'u','ㅢ':'uy','ㅛ':'yo','ㅠ':'yu','ㅑ':'ya','ㅕ':'ye','ㅖ':'yey','ㅒ':'yay','ㅘ':'wa','ㅝ':'we','ㅟ':'wi','ㅙ':'way','ㅞ':'wey'
  };

  const BILABIALS = new Set(['ㅁ','ㅂ','ㅃ','ㅍ']);

  function isHangulSyllable(ch) {
    const code = ch.codePointAt(0);
    return code >= SBase && code < (SBase + SCount);
  }

  // 한글 → 자모(호환 자모), 초성 ㅇ 제거
  function toJamo(text) {
    const out = [];
    for (const ch of text) {
      if (!isHangulSyllable(ch)) { out.push(ch); continue; }
      const SIndex = ch.codePointAt(0) - SBase;
      const LIndex = Math.floor(SIndex / NCount);
      const VIndex = Math.floor((SIndex % NCount) / TCount);
      const TIndex = SIndex % TCount;

      const onset = CHOSEONG[LIndex];
      const nucleus = JUNGSEONG[VIndex];
      let coda = JONGSEONG[TIndex];

      if (onset !== 'ㅇ') out.push(onset);
      out.push(nucleus);

      if (coda) {
        if (DOUBLE_CODA_SPLIT[coda]) {
          for (const cj of DOUBLE_CODA_SPLIT[coda]) out.push(cj);
        } else {
          out.push(coda);
        }
      }
    }
    return out.join('');
  }

  // 양순음 뒤 ㅜ
  function applyLabialRule(jamoStr) {
    const arr = Array.from(jamoStr);
    for (let i = 0; i < arr.length - 1; i++) {
      if (BILABIALS.has(arr[i]) && arr[i + 1] === 'ㅜ') {
        arr[i + 1] = 'ㅡ';
      }
    }
    return arr.join('');
  }

  // 자모 → Yale 기호로 변환하면서, 비-자모(공백/문장부호 등)를 구분 토큰으로 유지
  function tokenizeYale(jamoStr) {
    const tokens = [];
    for (const ch of jamoStr) {
      if (Object.prototype.hasOwnProperty.call(J2Y, ch)) {
        tokens.push({ s: J2Y[ch], delim: false });
      } else {
        tokens.push({ s: ch, delim: true });
      }
    }
    return tokens;
  }

  // 구분자(sep)는 연속된 "자모 토큰" 사이에만 넣고, 공백/개행/문장부호 앞뒤에는 넣지 않음
  function joinWithSep(tokens, sep) {
    if (!sep) return tokens.map(t => t.s).join('');
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
      const cur = tokens[i];
      out += cur.s;
      const next = tokens[i + 1];
      if (!next) break;
      if (!cur.delim && !next.delim) {
        out += sep;
      }
    }
    return out;
  }

  function convert(text, { labial = true, sep = '' } = {}) {
    if (!text || !text.trim()) return '';
    let jamo = toJamo(text);
    if (labial) jamo = applyLabialRule(jamo);
    const tokens = tokenizeYale(jamo);
    return joinWithSep(tokens, sep);
  }

  // ===== DOM =====
  const $in = document.getElementById('input');
  const $out = document.getElementById('output');
  const $sep = document.getElementById('separator');
  const $lab = document.getElementById('labialRule');
  const $copy = document.getElementById('copyBtn');
  const $status = document.getElementById('status');

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
  const $ttlRef = document.getElementById('ttlRef');
  const $ttlHist = document.getElementById('ttlHist');
  let COPIED_TEXT = 'Copied!';

  // ===== 렌더링 =====
  function getOpts() {
    const sep = ($sepEnable && !$sepEnable.checked) ? '' : ($sep.value || '').slice(0, 1);
    const labial = !!$lab.checked;
    return { sep, labial };
  }

  function splitLines(text) {
    return (text || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function updateSingle() {
    const opts = getOpts();
    $out.value = convert($in.value, opts);
  }

  function renderInterlinear(lines, opts) {
    $interlinear.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const line of lines) {
      const block = document.createElement('div');
      block.className = 'inter-block';
      const tokens = line.split(/\s+/).filter(Boolean);
      const romas = tokens.map(t => convert(t, opts));
      const top = document.createElement('div');
      top.className = 'line top mono';
      top.textContent = tokens.join(' ');
      const bottom = document.createElement('div');
      bottom.className = 'line bottom mono';
      bottom.textContent = romas.join(' ');
      block.appendChild(top); block.appendChild(bottom);

      // 클릭 시: 탭으로 구분된 2행 복사
      block.addEventListener('click', async () => {
        const tsv = tokens.join('\t') + '\n' + romas.join('\t');
        try {
          await navigator.clipboard.writeText(tsv);
          $status.textContent = COPIED_TEXT;
        } catch {
          const ta = document.createElement('textarea');
          ta.value = tsv; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
          $status.textContent = COPIED_TEXT;
        } finally {
          setTimeout(() => { $status.textContent = ''; }, 3000);
        }
      });
      frag.appendChild(block);
    }
    $interlinear.appendChild(frag);
  }

  function togglePanels(lines, opts) {
    const il = $interlinearMode.checked;
    if (il) {
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
    // update separator preview and chips
    if ($sepPreview) $sepPreview.textContent = opts.sep ? (opts.sep === ' ' ? '␣' : opts.sep) : '∅';
    if ($sepChips) {
      const buttons = Array.from($sepChips.querySelectorAll('.chip'));
      buttons.forEach(b => b.classList.toggle('active', (b.dataset.sep || '') === opts.sep));
    }
    if ($sepControls) $sepControls.classList.toggle('hidden', !$sepEnable?.checked);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      $status.textContent = COPIED_TEXT;
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      $status.textContent = COPIED_TEXT;
    } finally {
      setTimeout(() => { $status.textContent = ''; }, 1200);
    }
  }

  // === Auto-copy: 입력창과 출력창 모두에서 선택된 텍스트를 자동 복사 ===

// 선택된 텍스트 얻기 (범용)
function getSelectedFromTextarea(textarea) {
  if (!textarea) return '';
  if (typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    return (e > s) ? textarea.value.slice(s, e) : '';
  }
  // 폴백(향후 엘리먼트 변경 대비)
  const sel = window.getSelection && window.getSelection();
  return sel ? String(sel) : '';
}

// 선택 종료 직후 한 번만 복사
let _autoCopyTimer = null;
function autoCopySelected(textarea, isOutput = false) {
  clearTimeout(_autoCopyTimer);
  // selection 갱신 직후를 기다리기 위해 약간 지연
  _autoCopyTimer = setTimeout(() => {
    const sel = getSelectedFromTextarea(textarea);
    if (!sel) return;
    
    let textToCopy = sel;
    // 출력창의 경우에만 공백을 탭으로 변환
    if (isOutput) {
      textToCopy = sel.replace(/[^\S\r\n]+/g, '\t');
    }
    
    copy(textToCopy);   // 기존 copy() 재사용 → i18n 상태문구 표시
  }, 10);
}

// 입력창($in)에 자동 복사 기능 추가
if ($in) {
  // 마우스/터치 드래그로 선택 후 놓을 때
  $in.addEventListener('mouseup', () => autoCopySelected($in, false));
  $in.addEventListener('touchend', () => autoCopySelected($in, false), { passive: true });
  
  // 키보드 선택에도 반응
  $in.addEventListener('keyup', (e) => {
    const key = e.key || '';
    if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
      autoCopySelected($in, false);
    }
  });
}

// 출력창($out)에 자동 복사 기능 (기존 코드 수정)
if ($out && !$out.hasAttribute('data-autocopy-initialized')) {
    $out.setAttribute('data-autocopy-initialized', 'true');
    
    $out.addEventListener('mouseup', autoCopySelected);
    $out.addEventListener('touchend', autoCopySelected, { passive: true });
    $out.addEventListener('keyup', (e) => {
      const key = e.key || '';
      if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
        autoCopySelected();
      }
    });
  }  

  // ===== 히스토리 (localStorage) =====
  const HIST_KEY = 'yaleHistoryV1';
  const HIST_MAX = 10;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch { return []; }
  }

  function saveHistory(arr) {
    localStorage.setItem(HIST_KEY, JSON.stringify(arr));
  }

  function addHistory() {
    const text = ($in.value || '').trim();
    if (!text) return;
    const opts = getOpts();
    const item = {
      id: Date.now(),
      text,
      opts,
      ts: new Date().toISOString(),
      pinned: false
    };
    let hist = loadHistory();

    // 동일 텍스트+옵션 중복 제거
    hist = hist.filter(h => !(h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts)));

    const pinned = hist.filter(h => h.pinned);
    const others = hist.filter(h => !h.pinned);
    others.unshift(item);
    // 최대 길이 제한(핀 제외)
    while (others.length > HIST_MAX) others.pop();
    const next = [...pinned, ...others].sort((a,b) => (b.pinned - a.pinned) || (b.id - a.id));
    saveHistory(next);
  }

  let histTimer = null;
  function persistHistoryDebounced() {
    clearTimeout(histTimer);
    histTimer = setTimeout(addHistory, 500);
  }

  function renderHistory() {
    const hist = loadHistory().sort((a,b) => (b.pinned - a.pinned) || (b.id - a.id));
    $histList.innerHTML = '';
    if (hist.length === 0) {
      $histList.innerHTML = '<p class="hint">変換履歴がありません。</p>';
      return;
    }
    for (const h of hist) {
      const div = document.createElement('div');
      div.className = 'history-item';
      const firstLine = (h.text.split(/\r?\n/)[0] || '').slice(0, 80);
      div.innerHTML = `
        <div class="hist-meta">
          <span class="badge">${new Date(h.id).toLocaleString()}</span>
          ${h.pinned ? '<span class="badge pin">PIN</span>' : ''}
          <span class="badge">sep:${h.opts.sep || '∅'}</span>
          <span class="badge">${h.opts.labial ? 'labial:on' : 'labial:off'}</span>
        </div>
        <div class="mono">${firstLine}${h.text.length > 80 ? '…' : ''}</div>
        <div class="hist-tools">
          <button class="btn btn-outline" data-act="restore" data-id="${h.id}">Restore</button>
          <button class="btn btn-outline" data-act="pin" data-id="${h.id}">${h.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn btn-outline" data-act="delete" data-id="${h.id}">Delete</button>
        </div>
      `;
      $histList.appendChild(div);
    }
  }

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
      hist.splice(idx,1);
      saveHistory(hist);
      renderHistory();
    }
  });

  $clearHist?.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
  });

  // ===== 참조표 =====
  function makeSection(title, entries) {
    const wrap = document.createElement('div');
    wrap.className = 'map-section';
    wrap.innerHTML = `<div class="ttl">${title}</div>`;
    const body = document.createElement('div');
    body.className = 'body';
    for (const [j, y] of entries) {
      const cell = document.createElement('div');
      cell.className = 'map-cell';
      cell.title = `${j} → ${y}`;
      cell.innerHTML = `${j}<small>${y}</small>`;
      body.appendChild(cell);
    }
    wrap.appendChild(body);
    return wrap;
  }

  function buildRefTable() {
    const grid = document.createElement('div');
    grid.className = 'map-grid';

    // 초성: ㅇ은 초성에서 ∅(생략) 안내
    const onsetEntries = CHOSEONG.map(j => [
      j,
      j === 'ㅇ' ? '∅' : (J2Y[j] || '—')   // 초성에서만 ∅로 표시
    ]);
    const nucleusEntries = JUNGSEONG.map(j => [j, J2Y[j] || '—']);
    // 종성은 분해쌍도 함께 표시(단, 표시는 기본자모 중심)
    const codaSet = new Set(JONGSEONG.filter(Boolean).flatMap(j => (DOUBLE_CODA_SPLIT[j] ? DOUBLE_CODA_SPLIT[j].split('') : [j])));
    const codaEntries = Array.from(codaSet).map(j => [j, J2Y[j] || '—']);

    grid.appendChild(makeSection('初声(초성)', onsetEntries));
    grid.appendChild(makeSection('中声(중성)', nucleusEntries));
    grid.appendChild(makeSection('終声(종성)', codaEntries));

    $refBody.innerHTML = '';
    $refBody.appendChild(grid);
    const note = document.createElement('p');
    note.className = 'hint';
    note.innerHTML = '「ㅇ」は初声で省略';
    $refBody.appendChild(note);
    // リンク部分
    const link = document.createElement('a');
    link.href = 'https://ja.wikipedia.org/wiki/%E3%82%A4%E3%82%A7%E3%83%BC%E3%83%AB%E5%BC%8F#%E6%9C%9D%E9%AE%AE%E8%AA%9E';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Wikipedia';
    link.className = 'btn btn-outline';
    // p 要素に追加
    note.appendChild(link);
    $refBody.appendChild(note);
  }

  // ===== 드로어 토글 =====
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

  $openRef?.addEventListener('click', () => { buildRefTable(); openDrawer($refDrawer, $openRef); });
  $closeRef?.addEventListener('click', () => closeDrawer($refDrawer, $openRef));
  $openHist?.addEventListener('click', () => { renderHistory(); openDrawer($histDrawer, $openHist); });
  $closeHist?.addEventListener('click', () => closeDrawer($histDrawer, $openHist));

  // ===== 이벤트 =====
  function onShortcut(e) {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key === 'Enter') { e.preventDefault(); updateAll(); }
  }

  $in.addEventListener('input', updateAll);
  $sep.addEventListener('input', updateAll);
  $sepEnable?.addEventListener('change', updateAll);
  $lab.addEventListener('change', updateAll);
  $interlinearMode.addEventListener('change', updateAll);
  document.addEventListener('keydown', onShortcut);

  $copy.addEventListener('click', () => {
    // 개행(\r, \n)은 유지하고, 그 외 공백(스페이스/전각 스페이스 등)을 탭으로 치환
    const raw = $out.value || '';
    const tabbed = raw.replace(/[^\S\r\n]+/g, '\t'); // 공백(whitespace) 중 개행 제외
    copy(tabbed);
  });
  

  // separator chips
  $sepChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const val = btn.dataset.sep ?? '';
    $sep.value = val;
    updateAll();
  });

  // 메인 화면 클릭으로 드로어 닫기
  document.addEventListener('click', (e) => {
    const clickedInsideRef = e.target.closest?.('#refDrawer, #openRef, #closeRef');
    const clickedInsideHist = e.target.closest?.('#historyDrawer, #openHist, #closeHist, #histList, .drawer-tools');
    if (!clickedInsideRef && $refDrawer.classList.contains('open')) closeDrawer($refDrawer, document.getElementById('openRef'));
    if (!clickedInsideHist && $histDrawer.classList.contains('open')) closeDrawer($histDrawer, document.getElementById('openHist'));
  });

  // backdrop 클릭으로 닫기
  $backdrop?.addEventListener('click', () => {
    if ($refDrawer.classList.contains('open')) closeDrawer($refDrawer, $openRef);
    if ($histDrawer.classList.contains('open')) closeDrawer($histDrawer, $openHist);
  });

  // 테마 토글 초기화
  (function initTheme(){
    const KEY = 'yaleThemeV1';
    const root = document.documentElement;
    function apply(theme){
      root.setAttribute('data-theme', theme);
      if ($themeToggle) {
        const light = theme === 'light';
        $themeToggle.setAttribute('aria-pressed', String(!light));
        $themeToggle.textContent = light ? '☀️' : '🌙';
      }
    }
    const saved = localStorage.getItem(KEY);
    // 기본값을 'dark'로 고정
    apply(saved || 'dark');
    $themeToggle?.addEventListener('click', () => {
      const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
      localStorage.setItem(KEY, next);
      apply(next);
    });
  })();

  // 언어 토글(i18n)
  const I18N = {
    ja: {
      openHist: '変換履歴', openRef: 'イェール式参照', copyBtn: '変換結果コピー', labelInput: '入力（ハングル）', labelOutput: '変換結果', labelLabial: '両唇音の後は「u」', labelInterlinear: 'ハングルと併記', labelSep: '字母区切り文字',
      ttlInterlinear: 'ハングルと並べて見る', hintInterlinear: '例文をクリックすると分かち書きを「タブ」にしてコピー', ttlRef: 'イェール式参照', ttlHist: '変換履歴',
      clearHist: 'すべて削除', closeRef: '閉じる', closeHist: '閉じる', sepPlaceholder: '∅', langToggle: '한국어', copied: 'コピー完了!'
    },
    ko: {
      openHist: '변환 기록', openRef: '예일식 참조', copyBtn: '변환 결과 복사',
      labelInput: '입력(한글)', labelOutput: '변환 결과', labelLabial: '양순음 뒤는 u', labelInterlinear: '한글과 나란히 보기', labelSep: '자모 구분자',
      ttlInterlinear: '한글과 나란히 보기', hintInterlinear: '예문을 클릭하면 띄어쓰기를 탭으로 하여 복사', ttlRef: '예일식 참조', ttlHist: '변환 기록',
      clearHist: '모두 지우기', closeRef: '닫기', closeHist: '닫기', sepPlaceholder: '∅', langToggle: '日本語', copied: '복사 완료!'
    }
  };

  function applyLang(lang) {
    const T = I18N[lang] || I18N.ja;
    $openHist.textContent = T.openHist;
    $openRef.textContent = T.openRef;
    $copy.textContent = T.copyBtn;
    $labelInput.textContent = T.labelInput;
    $labelOutput.textContent = T.labelOutput;
    $labelLabial.textContent = T.labelLabial;
    $labelInterlinear.textContent = T.labelInterlinear;
    $labelSep.textContent = T.labelSep;
    $ttlInterlinear.textContent = T.ttlInterlinear;
    $hintInterlinear.textContent = T.hintInterlinear;
    $ttlRef.textContent = T.ttlRef;
    $ttlHist.textContent = T.ttlHist;
    $clearHist.textContent = T.clearHist;
    $closeRef.textContent = T.closeRef;
    $closeHist.textContent = T.closeHist;
    $sep.setAttribute('placeholder', T.sepPlaceholder);
    if ($langToggle) $langToggle.textContent = T.langToggle + (lang === 'ja' ? ' 🇰🇷' : ' 🇯🇵');
    COPIED_TEXT = T.copied;
  }

  (function initLang(){
    const KEY = 'yaleLangV1';
    const saved = localStorage.getItem(KEY) || 'ja';
    applyLang(saved);
    $langToggle?.addEventListener('click', () => {
      const next = (localStorage.getItem(KEY) || 'ja') === 'ja' ? 'ko' : 'ja';
      localStorage.setItem(KEY, next);
      applyLang(next);
    });
  })();

  // ===== 초기 =====
  $in.value = '';
  updateAll();
})();
