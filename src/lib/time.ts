const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Compact social-style relative time: "now", "5m", "3h", "2d", "12 Mar". */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** Sentence-friendly relative time: "just now", "5m ago", "3d ago", "on 12 Mar". */
export function relativeLabel(iso: string): string {
  const short = timeAgo(iso);
  if (short === 'now') return 'just now';
  if (/^\d+[mhd]$/.test(short)) return `${short} ago`;
  return `on ${short}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Used in the conversation list. */
export function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return formatClock(date);
  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  if (now.getTime() - date.getTime() < 7 * DAY) return WEEKDAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Day separators in a chat thread. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, new Date(now.getTime() - DAY))) return 'Yesterday';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Fri 14 Nov · 19:30" */
export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} · ${formatClock(date)}`;
}

export function formatEventRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  if (!endIso) return formatEventDate(startIso);
  const end = new Date(endIso);
  if (isSameDay(start, end)) return `${formatEventDate(startIso)} – ${formatClock(end)}`;
  return `${formatEventDate(startIso)} – ${formatEventDate(endIso)}`;
}

export function eventDateBadge(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return { day: String(date.getDate()), month: MONTHS[date.getMonth()].toUpperCase() };
}

export function lastSeenLabel(iso: string | null, online: boolean): string {
  if (online) return 'Online';
  if (!iso) return 'Offline';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 2 * MINUTE) return 'Active just now';
  if (diff < HOUR) return `Active ${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `Active ${Math.floor(diff / HOUR)}h ago`;
  return `Active ${relativeLabel(iso)}`;
}

export function joinedLabel(iso: string): string {
  const date = new Date(iso);
  return `Joined ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
