import { useEffect, useState } from 'react';

interface GoToSupabaseProjectButtonProps {
  projectId: string;
}

export function GoToSupabaseProjectButton({ projectId }: GoToSupabaseProjectButtonProps) {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const imageUrl = prefersDark
    ? '/assets/connect-supabase/goto-project-dark.svg'
    : '/assets/connect-supabase/goto-project-light.svg';

  const handleClick = () => {
    window.open(`https://supabase.com/dashboard/project/${projectId}`, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className="h-6 opacity-100 hover:opacity-80 transition-opacity"
      aria-label="Go to Supabase Project"
    >
      <img src={imageUrl} alt="Go to Supabase Project" className="h-full" />
    </button>
  );
}
