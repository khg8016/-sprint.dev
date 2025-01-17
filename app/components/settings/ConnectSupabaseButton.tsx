import { useEffect, useState } from 'react';

interface ConnectSupabaseButtonProps {
  chatId: string;
}

export function ConnectSupabaseButton({ chatId }: ConnectSupabaseButtonProps) {
  const [prefersDark, setPrefersDark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const imageUrl = prefersDark
    ? '/assets/connect-supabase/connect-supabase-dark.svg'
    : '/assets/connect-supabase/connect-supabase-light.svg';

  const handleConnect = async () => {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      interface LoginResponse {
        redirectUrl?: string;
      }

      fetch('https://cxwwczwjdevjxnfcxsja.supabase.co/functions/v1/connect-supabase/login', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        credentials: 'include', // ⬅️ 쿠키를 포함하여 요청
      })
        .then((response) => response.json() as Promise<LoginResponse>)
        .then((data) => {
          console.log(data);

          if (data.redirectUrl) {
            // Add chat ID as state parameter
            const url = new URL(data.redirectUrl!);
            url.searchParams.append('state', chatId);

            setTimeout(() => {
              window.location.href = url.toString(); // 🚀 쿠키가 저장될 시간을 확보한 후 이동
            }, 500); // 500ms (0.5초) 정도 대기
          }
        })
        .catch((error) => {
          console.error('Failed to fetch login URL', error);
        });
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="h-6 opacity-100 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading}
      aria-label="Connect Supabase"
    >
      <img src={imageUrl} alt="Connect Supabase" className="h-full" />
    </button>
  );
}
