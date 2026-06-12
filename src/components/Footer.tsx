// 푸터 — 하드코딩 유지 (설계 문서 §6)
export default function Footer() {
  return (
    <footer className="py-8">
      <p className="text-center text-xs text-muted-foreground">
        © 2026{' '}
        <a
          href="https://researchmap.jp/jp-kr"
          target="_blank"
          rel="noopener"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          Seo Mincheol
        </a>
        . All rights reserved.
      </p>
    </footer>
  );
}
