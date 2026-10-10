// 푸터 — 하드코딩 유지 (설계 문서 §6). 라이선스 표기: 코드 MIT / 빈도 데이터 CC BY-SA 4.0(위키백과·FrequencyWords) / 서드파티 고지
const linkClass = 'underline-offset-2 hover:text-foreground hover:underline';

export default function Footer() {
  return (
    <footer className="space-y-1 py-8 text-center text-xs text-muted-foreground">
      <p>
        © 2025–2026{' '}
        <a href="https://researchmap.jp/jp-kr" target="_blank" rel="noopener" className={linkClass}>
          Seo Mincheol
        </a>
        {' · '}
        <a
          href="https://github.com/kr-jp/hangul_to_yale_romanizer/blob/main/LICENSE"
          target="_blank"
          rel="noopener"
          className={linkClass}
        >
          MIT License
        </a>
      </p>
      <p>
        <a
          href="https://github.com/kr-jp/hangul_to_yale_romanizer/blob/main/data/README.md"
          target="_blank"
          rel="noopener"
          className={linkClass}
        >
          Frequency data
        </a>
        :{' '}
        <a href="https://ko.wikipedia.org/" target="_blank" rel="noopener" className={linkClass}>
          Korean Wikipedia
        </a>{' '}
        contributors via{' '}
        <a href="https://github.com/lovit/kowikitext" target="_blank" rel="noopener" className={linkClass}>
          kowikitext
        </a>
        {' & '}
        <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener" className={linkClass}>
          FrequencyWords
        </a>{' '}
        (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener" className={linkClass}>
          CC BY-SA 4.0
        </a>
        ){' · '}
        <a href="/third-party-licenses.txt" target="_blank" rel="noopener" className={linkClass}>
          Third-party licenses
        </a>
      </p>
    </footer>
  );
}
