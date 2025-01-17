import { useState, useEffect } from 'react';

interface ConnectChatToProjectButtonProps {
  chatId: string;
  onConnect?: (projectId: string) => void;
}

export function ConnectChatToProjectButton({ chatId, onConnect }: ConnectChatToProjectButtonProps) {
  console.log(chatId);
  console.log(onConnect);

  const [prefersDark, setPrefersDark] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [projectType, setProjectType] = useState<'new' | 'existing'>('new');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const imageUrl = prefersDark
    ? '/assets/connect-supabase/connect-chat-dark.svg'
    : '/assets/connect-supabase/connect-chat-light.svg';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-6 opacity-100 hover:opacity-80 transition-opacity"
        aria-label="Connect Chat to Supabase Project"
      >
        <img src={imageUrl} alt="Connect Chat to Supabase Project" className="h-full" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-bolt-background rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-bolt-elements-textPrimary mb-4">Connect Chat to Supabase Project</h2>

            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  className={`flex-1 p-3 rounded-lg border ${
                    projectType === 'new'
                      ? 'border-bolt-elements-textPrimary text-bolt-elements-textPrimary'
                      : 'border-bolt-elements-textSecondary text-bolt-elements-textSecondary'
                  }`}
                  onClick={() => setProjectType('new')}
                >
                  Create New Project
                </button>
                <button
                  className={`flex-1 p-3 rounded-lg border ${
                    projectType === 'existing'
                      ? 'border-bolt-elements-textPrimary text-bolt-elements-textPrimary'
                      : 'border-bolt-elements-textSecondary text-bolt-elements-textSecondary'
                  }`}
                  onClick={() => setProjectType('existing')}
                >
                  Use Existing Project
                </button>
              </div>

              {projectType === 'new' && (
                <div className="text-bolt-elements-textSecondary">
                  <p>This will:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Create a new Supabase project</li>
                    <li>Set up necessary database tables</li>
                    <li>Configure authentication settings</li>
                    <li>Link this chat history</li>
                  </ul>
                </div>
              )}

              {projectType === 'existing' && (
                <div className="text-bolt-elements-textSecondary">
                  <p>Select a project from your Supabase account to connect with this chat.</p>
                  <p className="mt-2">The project will be configured with:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Required database tables</li>
                    <li>Authentication settings</li>
                    <li>This chat history</li>
                  </ul>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  className="px-4 py-2 rounded text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-bolt-elements-textPrimary text-white hover:opacity-90"
                  onClick={() => {
                    // TODO: Implement project creation/selection
                    setIsOpen(false);
                  }}
                >
                  {projectType === 'new' ? 'Create & Connect' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
