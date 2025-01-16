import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from '@remix-run/react';
import { toast } from 'react-toastify';
import { signOut } from '~/lib/persistence/auth';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { SettingsWindow } from '~/components/settings/SettingsWindow';
import { SettingsButton } from '~/components/ui/SettingsButton';
import {
  deleteById,
  getPaginatedChats,
  chatId,
  type ChatHistoryItem,
  useChatHistorySupabase,
  searchChats,
} from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-3 font-bold text-gray-700 dark:text-gray-300 border-b border-bolt-elements-borderColor">
      <div className="h-4 w-4 i-ph:clock-thin" />
      {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export const Menu = () => {
  const navigate = useNavigate();
  const { isAuthenticated, userEmail, userId } = useSupabaseAuth();
  const { duplicateCurrentChat, exportChat } = useChatHistorySupabase();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatHistoryItem[]>([]);

  // const [isSearching, setIsSearching] = useState(false);

  // 디바운스된 검색 처리
  const handleSearch = useCallback(
    async (query: string) => {
      if (!userId) {
        return;
      }

      if (!query.trim()) {
        setSearchResults([]);

        // setIsSearching(false);

        return;
      }

      // setIsSearching(true);

      try {
        const results = await searchChats(userId, query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        toast.error('Failed to search chats');
      } finally {
        // setIsSearching(false);
      }
    },
    [userId],
  );

  // 검색어 입력 핸들러
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);

      // 이전 타이머 취소
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // 300ms 디바운스
      searchTimeoutRef.current = setTimeout(() => {
        void handleSearch(query);
      }, 300);
    },
    [handleSearch],
  );

  // 컴포넌트 언마운트시 타이머 정리
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // 현재 보여줄 목록 (검색 결과 또는 페이지네이션 목록)
  const displayList = searchQuery ? searchResults : list;

  // Cache invalidation key that changes when a new chat is created
  const [cacheKey, setCacheKey] = useState(0);

  // Memoized entries cache
  const entriesCache = useMemo(() => {
    const cache = new Map<string, Promise<{ items: ChatHistoryItem[]; hasMore: boolean }>>();

    return {
      get: async (userId: string, page: number) => {
        const cacheKey = `${userId}-${page}`;

        if (!cache.has(cacheKey)) {
          const promise = getPaginatedChats(userId, page, 20).then((result) => ({
            items: result.items.filter((item) => item.urlId && item.description),
            hasMore: result.hasMore,
          }));
          cache.set(cacheKey, promise);
        }

        return cache.get(cacheKey)!;
      },
      invalidate: () => {
        cache.clear();
        setCacheKey((prev) => prev + 1);
        setPage(0);
        setHasMore(true);
      },
    };
  }, [cacheKey]); // Reset cache when cacheKey changes

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const result = await entriesCache.get(userId, page + 1);
      setList((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to load more chats:', error);
      toast.error('Failed to load more chats');
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, page, hasMore, isLoadingMore, entriesCache]);

  // Scroll event handler
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const handleScroll = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = container;

      if (scrollHeight - scrollTop - clientHeight < 50) {
        // 50px before bottom
        void loadMore();
        return;
      }
    };

    container.addEventListener('scroll', handleScroll);

    // eslint-disable-next-line consistent-return
    return (): void => {
      container?.removeEventListener('scroll', handleScroll);
    };
  }, [loadMore]);

  const loadEntries = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await entriesCache.get(userId, 0);
      setList(result.items);
      setHasMore(result.hasMore);
      setPage(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load chats';
      toast.error(message);
      entriesCache.invalidate();
    } finally {
      setIsLoading(false);
    }
  }, [userId, entriesCache]);

  // Invalidate cache when new chat is created
  useEffect(() => {
    const handleNewChat = () => {
      entriesCache.invalidate();
    };

    window.addEventListener('newChatCreated', handleNewChat);

    return () => window.removeEventListener('newChatCreated', handleNewChat);
  }, [entriesCache]);

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();

      if (userId) {
        deleteById(userId, item.id)
          .then(() => {
            entriesCache.invalidate(); // Invalidate cache on deletion
            loadEntries();

            if (chatId.get() === item.id) {
              // hard page navigation to clear the stores
              window.location.pathname = '/';
            }
          })
          .catch((error) => {
            toast.error('Failed to delete conversation');
            logger.error(error);
          });
      }
    },
    [userId, entriesCache, loadEntries],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const handleDeleteClick = (event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();
    setDialogContent({ type: 'delete', item });
  };

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    entriesCache.invalidate(); // Invalidate cache after duplication
    loadEntries();
  };

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex selection-accent flex-col side-menu fixed top-0 w-[350px] h-full bg-bolt-elements-background-depth-2 border-r rounded-r-3xl border-bolt-elements-borderColor z-sidebar shadow-xl shadow-bolt-elements-sidebar-dropdownShadow text-sm"
    >
      <div className="h-[60px]" /> {/* Spacer for top margin */}
      <CurrentDateTime />
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="p-4 select-none">
          <a
            href="/"
            className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme mb-4"
          >
            <span className="inline-block i-bolt:chat scale-110" />
            Start new chat
          </a>
          <div className="relative w-full">
            <input
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
              type="search"
              placeholder="Search"
              onChange={handleSearchChange}
              aria-label="Search chats"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pl-6 pr-5 my-2">
          <span className="text-bolt-elements-textPrimary font-medium">Your Chats</span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-bolt-elements-borderColor border-t-bolt-elements-textPrimary rounded-full animate-spin" />
          )}
        </div>
        <div ref={scrollContainerRef} className="flex-1 overflow-auto pl-4 pr-5 pb-5">
          {displayList.length === 0 && (
            <div className="pl-2 text-bolt-elements-textTertiary">
              {searchQuery ? 'No matches found' : list.length === 0 ? 'No previous conversations' : 'No matches found'}
            </div>
          )}
          <DialogRoot open={dialogContent !== null}>
            {binDates(displayList).map(({ category, items }) => (
              <div key={category} className="mt-4 first:mt-0 space-y-1">
                <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-background-depth-2 pl-2 pt-2 pb-1">
                  {category}
                </div>
                {items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    exportChat={exportChat}
                    onDelete={(event) => handleDeleteClick(event, item)}
                    onDuplicate={() => handleDuplicate(item.id)}
                  />
                ))}
              </div>
            ))}
            <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
              {dialogContent?.type === 'delete' && (
                <>
                  <DialogTitle>Delete Chat?</DialogTitle>
                  <DialogDescription asChild>
                    <div>
                      <p>
                        You are about to delete <strong>{dialogContent.item.description}</strong>.
                      </p>
                      <p className="mt-1">Are you sure you want to delete this chat?</p>
                    </div>
                  </DialogDescription>
                  <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                    <DialogButton type="secondary" onClick={closeDialog}>
                      Cancel
                    </DialogButton>
                    <DialogButton
                      type="danger"
                      onClick={(event) => {
                        deleteItem(event, dialogContent.item);
                        closeDialog();
                      }}
                    >
                      Delete
                    </DialogButton>
                  </div>
                </>
              )}
            </Dialog>
          </DialogRoot>
          {!searchQuery && isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-bolt-elements-borderColor border-t-bolt-elements-textPrimary rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-bolt-elements-borderColor p-4">
          <SettingsButton onClick={() => setIsSettingsOpen(true)} />
          {isAuthenticated ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500">{userEmail}</span>
              <button
                onClick={async () => {
                  const { error } = await signOut();

                  if (!error) {
                    navigate('/');
                  } else {
                    toast.error('Failed to sign out');
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Sign In
            </button>
          )}
          <ThemeSwitch />
        </div>
      </div>
      <SettingsWindow open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </motion.div>
  );
};
