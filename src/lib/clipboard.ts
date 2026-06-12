// 클립보드 복사 — navigator.clipboard 실패 시 임시 textarea + execCommand 폴백 (원본 dom.js copy())
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}
