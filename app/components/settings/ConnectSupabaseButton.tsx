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
      fetch(import.meta.env.VITE_SUPABASE_FUNCTION_URL + '/connect-supabase/login', {
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
      className="rounded-md border border-[#3ECF8E] bg-[#3ECF8E]/10 hover:bg-[#3ECF8E]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      disabled={isLoading}
      aria-label="Connect Supabase"
    >
      {/* {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-[#3ECF8E]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <img src="/assets/brand-assets/supabase-logo-icon.svg" alt="" className="h-4 w-4" />
      )} */}
      <img src={imageUrl} alt="Connect Supabase" />
    </button>
  );
}
