import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
import { useSupabaseManagement } from '~/lib/hooks/useSupabaseManagement';
import { supabase } from '~/lib/persistence/supabaseClient';
import { createHighlighter } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { WORK_DIR } from '~/utils/constants';
import type { FileAction } from '~/types/actions';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { chatStore } from '~/lib/stores/chat';
import * as supabaseDb from '~/lib/persistence/supabase_db';
import type { FileMap } from '~/lib/stores/files';
import { toast } from 'react-toastify';

const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const getHighlighter = async () => {
  const highlighter = import.meta.hot?.data.shellHighlighter ?? (await createHighlighter(highlighterOptions));

  if (import.meta.hot) {
    import.meta.hot.data.shellHighlighter = highlighter;
  }

  return highlighter;
};

interface ArtifactProps {
  messageId: string;
}

export const Artifact = memo(({ messageId }: ArtifactProps) => {
  const { userId } = useSupabaseAuth();
  const { id: chatId } = useStore(chatStore);
  const { executeQuery } = useSupabaseManagement(userId);
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);
  const [noActiveConnection, setNoActiveConnection] = useState(false);
  const [successfulQueries, setSuccessfulQueries] = useState<Record<string, boolean>>({});
  const [queryError, setQueryError] = useState<string | null>(null);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[messageId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions);
    }),
  );
  const migrationActions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions).filter(
        (action) => action.type === 'file' && action.filePath.endsWith('.sql'),
      ) as FileAction[];
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0 && artifact.type === 'bundled') {
      const finished = !actions.find((action) => action.status !== 'complete');

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
  }, [actions]);

  const files = useStore(workbenchStore.files);

  return (
    <div className="artifact border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex">
        <button
          className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          {artifact.type == 'bundled' && (
            <>
              <div className="p-4">
                {allActionFinished ? (
                  <div className={'i-ph:files-light'} style={{ fontSize: '2rem' }}></div>
                ) : (
                  <div className={'i-svg-spinners:90-ring-with-bg'} style={{ fontSize: '2rem' }}></div>
                )}
              </div>
              <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
            </>
          )}
          <div className="px-5 p-3.5 w-full text-left">
            <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">{artifact?.title}</div>
            <div className="w-full w-full text-bolt-elements-textSecondary text-xs mt-0.5">Click to open Workbench</div>
          </div>
        </button>
        <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          {actions.length && artifact.type !== 'bundled' && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              onClick={toggleActions}
            >
              <div className="p-4">
                <div className={showActions ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {artifact.type !== 'bundled' && showActions && actions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

            <div className="p-5 text-left bg-bolt-elements-actions-background">
              <ActionList actions={actions} chatId={chatId || ''} userId={userId || ''} files={files} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {artifact.type !== 'bundled' && showActions && migrationActions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

            <div className="p-5 text-left bg-bolt-elements-actions-background">
              {noActiveConnection && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:warning-circle-duotone text-lg" />
                    <span className="text-sm">Please connect the Supabase project</span>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {migrationActions.map((action, index) => {
                  const migrationPath = action.filePath;
                  const fileName = migrationPath.split('/').pop();

                  return (
                    <div
                      key={index}
                      className="flex flex-col gap-2 p-3 rounded-lg border border-bolt-elements-artifacts-borderColor bg-bolt-elements-artifacts-background"
                    >
                      <div className="flex items-center gap-2">
                        <div className="i-ph:code-duotone text-bolt-elements-textSecondary text-lg" />
                        <span className="flex-1 font-medium text-sm text-bolt-elements-textPrimary">{fileName}</span>
                      </div>

                      <code
                        className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                        onClick={() => openArtifactInWorkbench(migrationPath)}
                      >
                        {migrationPath}
                      </code>
                      <div className="flex flex-col gap-2">
                        {successfulQueries[action.filePath] && (
                          <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 text-xs">
                            The migration file has been successfully executed.
                          </div>
                        )}
                        {queryError && !successfulQueries[action.filePath] && (
                          <div className="p-2 rounded-md bg-red-500/10 text-red-500 text-xs">{queryError}</div>
                        )}
                        <div className="flex gap-3">
                          {!successfulQueries[action.filePath] && (
                            <button
                              className={classNames(
                                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-all duration-150 border',
                                'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/90 hover:text-white hover:scale-[1.02] active:scale-[0.98] border-emerald-500/20',
                              )}
                              onClick={async () => {
                                if (successfulQueries[action.filePath]) {
                                  return;
                                }

                                setQueryError(null);

                                try {
                                  const { data: project, error: chatSupabaseConnectionError } = await supabase
                                    .from('chat_supabase_connections')
                                    .select('project_id')
                                    .eq('chat_id', chatId)
                                    .eq('user_id', userId)
                                    .eq('is_active', true)
                                    .single();

                                  if (chatSupabaseConnectionError || !project) {
                                    console.error('No active Supabase connection found');
                                    setNoActiveConnection(true);

                                    return;
                                  }

                                  setNoActiveConnection(false);

                                  if (project?.project_id) {
                                    await executeQuery(project.project_id, action.content);
                                    setSuccessfulQueries((prev) => ({ ...prev, [action.filePath]: true }));
                                  } else {
                                    console.error('no connected project');
                                  }
                                } catch (error) {
                                  console.error('Failed to execute migration:', error);
                                  setQueryError('쿼리 실행에 실패했습니다: ' + error);
                                }
                              }}
                              disabled={successfulQueries[action.filePath]}
                            >
                              <div className="i-ph:check-circle-duotone text-base" />
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface ShellCodeBlockProps {
  classsName?: string;
  code: string;
}

function ShellCodeBlock({ classsName, code }: ShellCodeBlockProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const highlight = async () => {
      try {
        const highlighter = await getHighlighter();
        const highlighted = highlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        });
        setHtml(highlighted);
      } catch (error) {
        console.error('Failed to highlight code:', error);
      }
    };
    highlight();
  }, [code]);

  return (
    <div
      className={classNames('text-xs', classsName)}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    ></div>
  );
}

interface ActionListProps {
  actions: ActionState[];
  chatId: string;
  userId: string;
  files: FileMap;
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function openArtifactInWorkbench(filePath: any) {
  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}
interface DeployResponse {
  success: boolean;
  deployment?: {
    url: string;
  };
  error?: string;
}

const startDeployment = async (chatId: string, userId: string, files: FileMap): Promise<DeployResponse> => {
  try {
    // 파일 저장
    await workbenchStore.saveAllFiles();

    // urlId 가져오기
    const chat = await supabaseDb.getMessagesById(userId, chatId);

    if (!chat) {
      throw new Error('Chat not found.');
    }

    // 파일 경로 처리
    const processedFiles = Object.entries(files).reduce(
      (acc, [path, file]) => {
        const cleanPath = path.replace('/home/project/', '/');
        acc[cleanPath] = file;

        return acc;
      },
      {} as typeof files,
    );

    // 배포 요청
    const response = await fetch('/api/deploy-netlify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId, urlId: chat.urlId, files: processedFiles }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Deploy request failed: ${response.statusText}`,
      };
    }

    const data: DeployResponse = await response.json();

    if (data.success && data.deployment) {
      toast.success(`Site has been deployed: ${data.deployment.url}`);
      return data;
    } else {
      toast.error(`An error occurred during deployment.`);
      return {
        success: false,
        error: data.error || 'An error occurred during deployment.',
      };
    }
  } catch (error: any) {
    toast.error('An error occurred during deployment.');
    return {
      success: false,
      error: 'An error occurred during deployment. ' + error.message,
    };
  }
};

const ActionList = memo(({ actions, chatId, userId, files }: ActionListProps) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-2.5">
        {actions.map((action, index) => {
          const { status, type, content } = action;
          const isLast = index === actions.length - 1;

          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm">
                <div className={classNames('text-lg', getIconColor(action.status))}>
                  {status === 'running' ? (
                    <>
                      {type !== 'start' ? (
                        <div className="i-svg-spinners:90-ring-with-bg"></div>
                      ) : (
                        <div className="i-ph:terminal-window-duotone"></div>
                      )}
                    </>
                  ) : status === 'pending' ? (
                    <div className="i-ph:circle-duotone"></div>
                  ) : status === 'complete' ? (
                    <div className="i-ph:check"></div>
                  ) : status === 'failed' || status === 'aborted' ? (
                    <div className="i-ph:x"></div>
                  ) : null}
                </div>
                {type === 'file' ? (
                  <div>
                    Create{' '}
                    <code
                      className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                      onClick={() => openArtifactInWorkbench(action.filePath)}
                    >
                      {action.filePath}
                    </code>
                  </div>
                ) : type === 'shell' ? (
                  <div className="flex items-center w-full min-h-[28px]">
                    <span className="flex-1">Run command</span>
                  </div>
                ) : type === 'start' ? (
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      workbenchStore.currentView.set('preview');
                    }}
                    className="flex items-center w-full min-h-[28px]"
                  >
                    <span className="flex-1">Start Application</span>
                  </a>
                ) : type === 'deploy' ? (
                  <div className="flex items-center justify-between w-full min-h-[28px] gap-3">
                    <span className="text-bolt-elements-textPrimary">Do you want to deploy?</span>
                    <button
                      onClick={async () => {
                        if (deployedUrl) {
                          window.open(deployedUrl, '_blank');
                        } else if (chatId && userId && !isDeploying) {
                          setIsDeploying(true);

                          try {
                            const response = await startDeployment(chatId, userId, files);

                            if (response?.deployment?.url) {
                              setDeployedUrl(response.deployment.url);
                            }
                          } finally {
                            setIsDeploying(false);
                          }
                        }
                      }}
                      disabled={isDeploying}
                      className={classNames(
                        'flex items-center gap-2 px-4 py-2 rounded-md border transition-all duration-150',
                        isDeploying
                          ? 'bg-emerald-500/50 text-white/50 cursor-not-allowed'
                          : deployedUrl
                            ? 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98] border-blue-400'
                            : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] border-emerald-400',
                      )}
                    >
                      {isDeploying ? (
                        <div className="i-svg-spinners:90-ring-with-bg w-4 h-4" />
                      ) : deployedUrl ? (
                        <div className="i-ph:arrow-square-out-bold w-4 h-4" />
                      ) : (
                        <div className="i-ph:cloud-arrow-up-bold w-4 h-4" />
                      )}
                      <span>{isDeploying ? 'Deploying...' : deployedUrl ? 'Visit Site' : 'Yes, deploy'}</span>
                    </button>
                  </div>
                ) : null}
              </div>
              {(type === 'shell' || type === 'start') && (
                <ShellCodeBlock
                  classsName={classNames('mt-1', {
                    'mb-3.5': !isLast,
                  })}
                  code={content}
                />
              )}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-bolt-elements-textTertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-bolt-elements-icon-success';
    }
    case 'aborted': {
      return 'text-bolt-elements-textSecondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}
