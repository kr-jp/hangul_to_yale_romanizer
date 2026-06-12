import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
