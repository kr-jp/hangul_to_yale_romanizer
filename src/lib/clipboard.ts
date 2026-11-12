// 클립보드 복사 — navigator.clipboard 실패 시 임시 textarea + execCommand 폴백 (원본 dom.js copy())
// 복사됐으면 true, 폴백까지 실패하면 false — 호출 측이 실패를 알린다 (예전에는 실패해도 '복사 완료'가 떴다)
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
