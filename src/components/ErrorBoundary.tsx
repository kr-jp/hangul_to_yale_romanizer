// 렌더링 중 예외로 화면 전체가 비는 것을 막는 최상위 경계.
// i18n Provider 바깥에서도 동작해야 하므로 문구는 일·한 병기로 하드코딩
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Yale] 렌더링 오류:', error, info.componentStack);
  }

  // 공유 URL 등 잘못된 상태가 원인일 수 있으므로 쿼리를 떼고 다시 연다
  private reset = () => {
    window.location.replace(window.location.pathname);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-base font-semibold">エラーが発生しました / 오류가 발생했습니다</p>
        <p className="text-sm text-muted-foreground">
          ページを再読み込みしてください。共有URLから開いた場合は、URLが壊れている可能性があります。
          <br />
          페이지를 다시 불러와 주세요. 공유 URL로 열었다면 URL이 손상되었을 수 있습니다.
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          再読み込み / 다시 불러오기
        </button>
      </div>
    );
  }
}
