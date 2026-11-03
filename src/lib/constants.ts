export const APP_NAME = 'OurBeckett';
export const APP_TAGLINE = 'Your campus. Your people.';

export const PAGE_SIZE = 15;

/** Must match Supabase Dashboard > Authentication > Providers > Email > "Email OTP Length". */
export const OTP_LENGTH = 6;

export const INTERESTS = [
  'Music', 'Gaming', 'Football', 'Gym', 'Running', 'Basketball', 'Rugby', 'Netball',
  'Tech', 'Coding', 'AI', 'Startups', 'Business', 'Finance', 'Marketing', 'Design',
  'Photography', 'Film', 'Art', 'Fashion', 'Books', 'Writing', 'Anime', 'Food',
  'Cooking', 'Travel', 'Nightlife', 'Festivals', 'Volunteering', 'Politics',
  'Psychology', 'Law', 'Nursing', 'Sport Science', 'Architecture', 'Theatre', 'Dance',
  'Hiking', 'Cycling', 'Climbing', 'Yoga', 'Mental Health', 'Sustainability', 'Languages',
] as const;

export const CAMPUSES = ['City Campus', 'Headingley Campus'] as const;
export type Campus = (typeof CAMPUSES)[number];

export const COMMUNITY_CATEGORIES = [
  'General', 'Course', 'Housing', 'Sport', 'Gaming', 'Nightlife', 'Deals', 'Society', 'Freshers',
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const COMMUNITY_ICONS = ['💬', '💻', '📈', '🎉', '🏠', '💪', '🎮', '🌙', '🏷️', '📚', '🎨', '🎵', '⚽', '🏀', '🧠', '🌍', '🍕', '📸', '🎭', '🩺'];

export const EVENT_CATEGORIES = [
  'University', 'Nightlife', 'Sports', 'Societies', 'Networking', 'Study', 'Social',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  University: 'University',
  Nightlife: 'Parties & nightlife',
  Sports: 'Sports',
  Societies: 'Societies',
  Networking: 'Networking',
  Study: 'Study groups',
  Social: 'Social',
};

export const EVENT_CATEGORY_ICONS: Record<EventCategory, string> = {
  University: 'school-outline',
  Nightlife: 'musical-notes-outline',
  Sports: 'football-outline',
  Societies: 'people-outline',
  Networking: 'briefcase-outline',
  Study: 'book-outline',
  Social: 'cafe-outline',
};

export const LISTING_CATEGORIES = [
  'Textbooks', 'Electronics', 'Clothing', 'Furniture', 'Accommodation', 'Free', 'Miscellaneous',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_CATEGORY_ICONS: Record<ListingCategory, string> = {
  Textbooks: 'book-outline',
  Electronics: 'laptop-outline',
  Clothing: 'shirt-outline',
  Furniture: 'bed-outline',
  Accommodation: 'home-outline',
  Free: 'gift-outline',
  Miscellaneous: 'cube-outline',
};

export const LISTING_TYPES = ['sale', 'exchange', 'free'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  sale: 'For sale',
  exchange: 'Swap',
  free: 'Free',
};

export const LISTING_CONDITIONS = ['New', 'Like new', 'Good', 'Fair'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
export type ReportTarget = 'post' | 'comment' | 'user' | 'listing' | 'event' | 'community' | 'message';

export const MAX_POST_IMAGES = 4;
export const MAX_LISTING_IMAGES = 6;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;
