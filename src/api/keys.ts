import type { FeedMode } from '@/types/models';

/**
 * Central React Query keys. Every list of posts starts with "posts" so a
 * single invalidation refreshes all feeds after a create/delete.
 */
export const queryKeys = {
  posts: ['posts'] as const,
  feed: (mode: FeedMode) => ['posts', 'feed', mode] as const,
  userPosts: (userId: string) => ['posts', 'user', userId] as const,
  communityPosts: (communityId: string) => ['posts', 'community', communityId] as const,
  hashtagPosts: (tag: string) => ['posts', 'hashtag', tag] as const,
  bookmarks: ['posts', 'bookmarks'] as const,
  searchPosts: (q: string) => ['posts', 'search', q] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,

  profile: (username: string) => ['profile', username] as const,
  profileById: (id: string) => ['profile-id', id] as const,
  isFollowing: (id: string) => ['is-following', id] as const,
  follows: (id: string, kind: 'followers' | 'following') => ['follows', id, kind] as const,
  suggestedUsers: ['suggested-users'] as const,
  searchUsers: (q: string) => ['search-users', q] as const,
  blocked: ['blocked'] as const,

  communities: ['communities'] as const,
  communityList: (filter: string) => ['communities', 'list', filter] as const,
  myCommunities: ['communities', 'mine'] as const,
  userCommunities: (userId: string) => ['communities', 'user', userId] as const,
  community: (id: string) => ['communities', 'detail', id] as const,
  communityMembers: (id: string) => ['communities', 'members', id] as const,

  events: ['events'] as const,
  eventList: (filter: string) => ['events', 'list', filter] as const,
  event: (id: string) => ['events', 'detail', id] as const,
  eventAttendees: (id: string) => ['events', 'attendees', id] as const,

  listings: ['listings'] as const,
  listingList: (filter: string) => ['listings', 'list', filter] as const,
  listing: (id: string) => ['listings', 'detail', id] as const,

  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  conversationMembers: (conversationId: string) => ['conversation-members', conversationId] as const,

  notifications: ['notifications'] as const,
  unreadNotifications: ['notifications', 'unread-count'] as const,

  trendingHashtags: ['trending-hashtags'] as const,
};
