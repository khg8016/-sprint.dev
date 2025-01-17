import { useEffect, useState } from 'react';

interface ProjectConnectionResponse {
  redirectUrl?: string;
}

export function ConnectSupabaseProjectButton() {
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
    ? '/assets/connect-supabase/connect-project-dark.svg'
    : '/assets/connect-supabase/connect-project-light.svg';

  const handleConnect = async () => {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      /*
       * TODO: Implement project connection logic
       * 1. For new project:
       *    - Create Supabase project via API
       *    - Set up database tables
       *    - Configure auth settings
       *    - Link chat history
       * 2. For existing project:
       *    - Validate project URL and API key
       *    - Test connection
       *    - Link chat history
       */

      fetch('https://cxwwczwjdevjxnfcxsja.supabase.co/functions/v1/connect-supabase/project', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        credentials: 'include',
      })
        .then((response) => response.json() as Promise<ProjectConnectionResponse>)
        .then((data) => {
          console.log(data);

          if (data.redirectUrl) {
            setTimeout(() => {
              window.location.href = data.redirectUrl as string;
            }, 500);
          }
        })
        .catch((error) => {
          console.error('Failed to connect project:', error);
        });
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="h-6 opacity-100 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading}
      aria-label="Connect Supabase Project"
    >
      <img src={imageUrl} alt="Connect Supabase Project" className="h-full" />
    </button>
  );
}
