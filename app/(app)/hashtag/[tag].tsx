import { router, useLocalSearchParams } from 'expo-router';

import { queryKeys } from '@/api/keys';
import { fetchHashtagPosts } from '@/api/posts';
import { PostList } from '@/components/PostList';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';

export default function HashtagScreen() {
  const { tag = '' } = useLocalSearchParams<{ tag: string }>();
  const clean = tag.replace(/^#/, '').toLowerCase();

  return (
    <Screen>
      <Header title={`#${clean}`} subtitle="Posts with this hashtag" />
      <PostList
        queryKey={queryKeys.hashtagPosts(clean)}
        fetchPage={(page) => fetchHashtagPosts(clean, page)}
        empty={{
          icon: 'pricetag-outline',
          title: `No #${clean} posts yet`,
          message: 'Start the conversation and be the first to use it.',
          actionLabel: 'Create a post',
          onAction: () => router.push({ pathname: '/create/post', params: { text: `#${clean} ` } }),
        }}
      />
    </Screen>
  );
}
