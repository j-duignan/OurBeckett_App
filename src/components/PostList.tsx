import { QueryKey, useInfiniteQuery } from '@tanstack/react-query';
import { useScrollToTop } from 'expo-router';
import { ReactElement, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { PAGE_SIZE } from '@/lib/constants';
import { useTheme } from '@/theme/ThemeProvider';
import type { FeedPost } from '@/types/models';

import { PostCard } from './PostCard';
import { EmptyState, ErrorState, ListFooterLoader, LoadingState } from './ui/States';
import type { IconName } from './ui/Icon';

type Props = {
  queryKey: QueryKey;
  fetchPage: (page: number) => Promise<FeedPost[]>;
  header?: ReactElement | null;
  empty: { icon: IconName; title: string; message?: string; actionLabel?: string; onAction?: () => void };
  canModerate?: boolean;
  enabled?: boolean;
};

/**
 * Infinite, pull-to-refresh post feed used by Home, profiles, communities,
 * hashtags, bookmarks and search.
 */
export function PostList({ queryKey, fetchPage, header, empty, canModerate, enabled = true }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<FeedPost>>(null);
  const [refreshing, setRefreshing] = useState(false);
  useScrollToTop(listRef);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length),
    enabled,
  });

  // Offset pagination can repeat a post if new ones arrive; de-duplicate.
  const posts = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedPost[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const post of page) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          out.push(post);
        }
      }
    }
    return out;
  }, [query.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  let emptyComponent: ReactElement;
  if (query.isPending && enabled) emptyComponent = <LoadingState />;
  else if (query.isError) emptyComponent = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  else emptyComponent = <EmptyState {...empty} />;

  return (
    <FlatList
      ref={listRef}
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard post={item} canModerate={canModerate} />}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={<ListFooterLoader loading={query.isFetchingNextPage} />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      initialNumToRender={5}
      maxToRenderPerBatch={6}
      windowSize={9}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={posts.length ? undefined : { flexGrow: 1 }}
    />
  );
}
