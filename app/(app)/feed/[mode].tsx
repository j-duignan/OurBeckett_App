import { useLocalSearchParams } from 'expo-router';

import { queryKeys } from '@/api/keys';
import { fetchFeed } from '@/api/posts';
import { PostList } from '@/components/PostList';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import type { FeedMode } from '@/types/models';

const TITLES: Partial<Record<FeedMode, { title: string; subtitle: string }>> = {
  trending: { title: 'Trending', subtitle: 'Most popular posts this week' },
  discussions: { title: 'Hot discussions', subtitle: 'Busiest community threads' },
  latest: { title: 'Latest', subtitle: 'Fresh from campus' },
};

export default function FeedScreen() {
  const params = useLocalSearchParams<{ mode: string }>();
  const mode: FeedMode = params.mode === 'discussions' || params.mode === 'latest' ? params.mode : 'trending';
  const meta = TITLES[mode] ?? { title: 'Feed', subtitle: '' };

  return (
    <Screen>
      <Header title={meta.title} subtitle={meta.subtitle} />
      <PostList
        queryKey={queryKeys.feed(mode)}
        fetchPage={(page) => fetchFeed(mode, page)}
        empty={{ icon: 'flame-outline', title: 'Nothing here yet', message: 'Check back soon. Campus is just waking up.' }}
      />
    </Screen>
  );
}
