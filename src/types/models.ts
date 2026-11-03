import type {
  Campus,
  CommunityCategory,
  EventCategory,
  ListingCategory,
  ListingCondition,
  ListingType,
} from '@/lib/constants';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  course: string | null;
  campus: Campus | null;
  interests: string[];
  onboarded: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  last_seen_at: string | null;
  created_at: string;
};

/** Minimal author/person shape used in lists. */
export type ProfileSummary = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> & {
  bio?: string;
  course?: string | null;
  followers_count?: number;
  shared_interests?: number;
};

export type FeedMode = 'for_you' | 'following' | 'latest' | 'trending' | 'discussions';

export type FeedPost = {
  id: string;
  author_id: string;
  community_id: string | null;
  body: string;
  media_urls: string[];
  media_type: 'image' | 'video' | null;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  community_name: string | null;
  community_slug: string | null;
  community_icon: string | null;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
};

export type CommentItem = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
};

export type CommentThread = CommentItem & { replies: CommentItem[] };

export type CommunityRole = 'owner' | 'moderator' | 'member' | 'banned';

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: CommunityCategory;
  icon: string;
  cover_url: string | null;
  creator_id: string | null;
  is_official: boolean;
  member_count: number;
  post_count: number;
  created_at: string;
  my_role: CommunityRole | null;
};

export type CommunityMember = {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: string;
  profile: ProfileSummary;
};

export type EventItem = {
  id: string;
  creator_id: string;
  community_id: string | null;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  attendee_count: number;
  created_at: string;
  updated_at: string;
  creator_username: string;
  creator_display_name: string;
  creator_avatar_url: string | null;
  going_by_me: boolean;
};

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  listing_type: ListingType;
  category: ListingCategory;
  condition: ListingCondition | null;
  image_urls: string[];
  status: 'available' | 'reserved' | 'sold';
  created_at: string;
  updated_at: string;
  seller_username: string;
  seller_display_name: string;
  seller_avatar_url: string | null;
};

export type ConversationSummary = {
  conversation_id: string;
  other_user_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url: string | null;
  other_last_seen_at: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender: string | null;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
  /** Client-only: optimistic message that hasn't been confirmed yet. */
  pending?: boolean;
  failed?: boolean;
  /** Client-only: local file shown while an image message uploads. */
  localUri?: string;
};

export type NotificationType = 'like' | 'comment' | 'reply' | 'follow' | 'message' | 'event_update';

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  event_id: string | null;
  conversation_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  actor: ProfileSummary | null;
};

export type HashtagStat = { tag: string; post_count: number };
