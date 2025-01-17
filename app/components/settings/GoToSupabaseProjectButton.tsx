interface GoToSupabaseProjectButtonProps {
  projectId: string;
}

export function GoToSupabaseProjectButton({ projectId }: GoToSupabaseProjectButtonProps) {
  const handleClick = () => {
    window.open(`https://supabase.com/dashboard/project/${projectId}`, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className="h-8 px-4 rounded-md border border-[#3ECF8E] bg-[#3ECF8E]/10 hover:bg-[#3ECF8E]/20 transition-all flex items-center gap-2 text-[#3ECF8E] text-sm"
      aria-label="Go to Supabase Project"
    >
      <img src="/assets/brand-assets/supabase-logo-icon.svg" alt="" className="h-4 w-4" />
      <span>Open Dashboard</span>
    </button>
  );
}
