import { router } from 'expo-router';

import { queryKeys } from '@/api/keys';
import { fetchBookmarks } from '@/api/posts';
import { PostList } from '@/components/PostList';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';

export default function Bookmarks() {
  return (
    <Screen>
      <Header title="Saved posts" subtitle="Only you can see these" />
      <PostList
        queryKey={queryKeys.bookmarks}
        fetchPage={fetchBookmarks}
        empty={{
          icon: 'bookmark-outline',
          title: 'Nothing saved yet',
          message: 'Tap the bookmark icon on any post to save it here.',
          actionLabel: 'Browse the feed',
          onAction: () => router.navigate('/'),
        }}
      />
    </Screen>
  );
}
