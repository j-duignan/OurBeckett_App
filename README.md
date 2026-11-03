# OurBeckett

**Your campus. Your people.** A social network exclusively for Leeds Beckett University students.

OurBeckett combines a home feed, communities, private messaging, events and a student marketplace in one app. The only requirement to join is an email address ending in `@student.leedsbeckett.ac.uk`.

Built with React Native, Expo SDK 58, TypeScript, Expo Router and Supabase (Auth, Postgres, Storage, Realtime).

> OurBeckett is a student project and is not an official Leeds Beckett University service.

---

## Contents

1. [Quick start](#quick-start)
2. [Supabase setup](#supabase-setup)
3. [Running the app](#running-the-app)
4. [Testing each feature](#testing-each-feature)
5. [Automated checks](#automated-checks)
6. [Feature status](#feature-status)
7. [Known limitations](#known-limitations)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture, folder structure, database design and security model.

---

## Quick start

Prerequisites: Node.js 20 or later, and the **Expo Go** app for SDK 58 on your phone (or an Android emulator / iOS simulator).

```bash
npm install
cp .env.example .env        # then fill in your Supabase URL and anon key
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

---

## Supabase setup

You need a Supabase project. The free tier is fine for development.

### 1. Create the database

Run the five migrations in `supabase/migrations/` **in order**. Either:

- **Supabase CLI:**
  ```bash
  npx supabase link --project-ref <your-project-ref>
  npx supabase db push
  ```
- **Or the dashboard:** open *SQL Editor*, paste each file in filename order and run it.

| File | What it does |
|---|---|
| `..._schema.sql` | Tables, constraints, indexes |
| `..._functions.sql` | Email-domain enforcement, triggers, counters, notifications, feed and messaging functions, views |
| `..._rls.sql` | Row Level Security policies and column-level privileges |
| `..._storage_realtime.sql` | Storage buckets and policies, realtime publication |
| `..._seed_communities.sql` | The 11 official launch communities |

### 2. Configure authentication

In the Supabase dashboard under **Authentication**:

1. **Sign In / Providers → Email:** enabled, with **Confirm email** turned on. Set **Email OTP Length** to `6`. If you change it, also change `OTP_LENGTH` in `src/lib/constants.ts`.
2. **Disable every other provider**, including phone, anonymous sign-ins and OAuth. The database rejects any account without a student email anyway, but they should not appear as options.
3. **Emails → Templates.** The app verifies with a 6-digit code rather than a magic link, so both templates must include `{{ .Token }}`:
   - *Confirm signup*, for example:
     ```html
     <h2>Welcome to OurBeckett</h2>
     <p>Your verification code is <strong>{{ .Token }}</strong></p>
     ```
   - *Reset Password*, for example:
     ```html
     <h2>Reset your OurBeckett password</h2>
     <p>Your reset code is <strong>{{ .Token }}</strong></p>
     ```
4. **Optional but recommended: Hooks → Before User Created.** Choose *Postgres function* and select `public.hook_before_user_created`. This returns a clean "Only @student.leedsbeckett.ac.uk email addresses can join" error. Without it, the database trigger still blocks other domains, but Supabase reports a generic "Database error saving new user".
5. **Production:** configure custom SMTP under *Emails → SMTP Settings*. The built-in sender is heavily rate-limited and is only suitable for testing.

### 3. Add your keys

Copy `.env.example` to `.env` and fill it in from **Project Settings → API**:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Only use the **anon / publishable** key. **Never** put the `service_role` or secret key in the app. All access control is enforced by Row Level Security in the database.

---

## Running the app

```bash
npx expo start            # Expo Go / dev server
npx expo start --android  # open on an Android emulator
npx expo start --ios      # open on an iOS simulator (macOS)
```

The app uses only modules included in Expo Go, so no custom development build is needed.

If your Expo Go app is on a newer SDK than 58, either install the matching Expo Go version, or upgrade with:

```bash
npx expo install expo@latest && npx expo install --fix
```

---

## Testing each feature

Create **two or three test accounts** with real `@student.leedsbeckett.ac.uk` addresses, or ask teammates, so you can see social features from both sides. Use two devices, or a device plus an emulator.

### Registration and login
1. **Domain restriction:** on *Create your account*, enter `someone@gmail.com`. The app refuses before submitting. Try `NAME@STUDENT.LEEDSBECKETT.AC.UK` and it is accepted, because the check is case-insensitive.
2. **Backend enforcement:** in the Supabase dashboard, *Authentication → Users → Add user*, try a non-student email. It is rejected by the database.
3. **Unique usernames:** type an existing username and a red cross appears. Submitting is blocked.
4. **Email verification:** sign up, enter the 6-digit code from the email, then complete onboarding (photo, bio, course, campus, interests, communities).
5. **Sessions:** kill and reopen the app. You stay signed in.
6. **Forgot password:** sign out, tap *Forgot password?*, enter the code from the email and set a new password.
7. **Change password and log out:** use Profile → ⚙️ Settings.

### Home feed
- Create a text post, then a post with up to 4 photos, then a post with a video, from the centre ➕ button.
- Switch between **For You**, **Following**, **Latest** and **Trending**. Pull down to refresh and scroll to load more.
- Like by tapping the heart or double-tapping a photo. Comment, reply to a comment, share, and bookmark.
- Use ••• to delete your own post, or to report or block another student's.
- Tap an avatar or name to open that student's profile.

### Explore and search
- Explore shows trending tags, upcoming events, popular communities, suggested people, hot discussions and trending posts.
- Search has separate tabs for students, posts, #hashtags, communities and events.

### Communities
- Explore → Communities. Join one of the official communities, post in it, then leave it.
- Create your own community. As owner, open ••• → *View members* to make someone a moderator, remove them or ban them.
- Remove a member's post as owner using ••• on the post.

### Messaging
- On another student's profile, tap **Message**.
- Send text and a photo. The other device receives it instantly.
- While one person types, the other sees *typing…*. Your last message shows *Sent*, then *Seen* once the recipient opens the chat.
- Online status shows as a green dot. The Messages tab shows unread badges.
- Long-press your own message to unsend it.

### Marketplace
- Home → 🏪, or Explore → Marketplace. Create a listing with photos, price, category and condition.
- From another account, open the listing and tap **Message seller**. A chat opens with a pre-filled message.
- As the seller, mark the item as reserved or sold, edit it or delete it.

### Events
- Create an event with a cover image, category, location and start and end times.
- From another account, tap **I'm going**. The attendee count updates.
- As the organiser, edit the time or location. Attendees receive an *updated an event* notification.
- Tap the location to open maps, and use Share to send a deep link.

### Profiles, notifications and safety
- Edit your profile (photo, username, bio, course, campus, interests). Your email is never shown.
- Follow and unfollow students, and open their Followers and Following lists.
- Likes, comments, replies, follows, messages and event updates create notifications with unread badges. Use *Mark all read*, or long-press an item for more options.
- Block a student from their profile. Their posts disappear and they can no longer message you. Manage blocks in Settings → Blocked students.
- Reports are written to the `reports` table. Review them in the Supabase Table Editor.

### Dark mode
Settings → Appearance → Automatic, Light or Dark.

---

## Automated checks

```bash
npm run typecheck   # TypeScript strict mode, 0 errors
npm run test:db     # runs every migration on an in-memory Postgres and checks the security rules
npx expo-doctor     # Expo dependency and config checks
```

`npm run test:db` uses PGlite, which is real Postgres compiled to WebAssembly, so it needs no Docker or Supabase project. It covers 76 checks, including:

- Non-student emails are rejected, including lookalike domains.
- Users cannot edit each other's content or counters.
- Outsiders cannot read or inject messages.
- Blocks hide content in both directions.
- Banned community members cannot post.
- Storage folder rules hold.

---

## Feature status

| Area | Status |
|---|---|
| Student-only registration (frontend and database enforced), unique usernames, email code verification | ✅ Done |
| Login, logout, persistent sessions, forgot or reset password, change password | ✅ Done |
| Onboarding: photo, bio, interests, course, campus, starter communities | ✅ Done |
| Bottom navigation with an emphasised Create button, animated tab icons, unread badges | ✅ Done |
| Feed: text, photo and video posts; likes; comments and replies; share; bookmarks; delete; report; infinite scroll; pull to refresh | ✅ Done |
| Feed filters: For You, Following, Latest, Trending | ✅ Done |
| Explore: trending posts and tags, discussions, suggested users, communities, events | ✅ Done |
| Search: students, posts, hashtags, communities, events | ✅ Done |
| Communities: create, join, leave, post, comment, like, members, search, owner and moderator tools | ✅ Done |
| Messaging: 1:1, realtime, text and photos, timestamps, read receipts, typing, online status, unread | ✅ Done |
| Marketplace: listings with photos, categories, price, condition, contact seller, sold or reserved | ✅ Done |
| Events: create, edit, discover, details, maps, RSVP, attendee count, share, update notifications | ✅ Done |
| Profiles: edit, follow, followers and following, communities, saved, block, report, email private | ✅ Done |
| In-app notifications with unread indicators and mark as read | ✅ Done |
| Light and dark mode | ✅ Done |
| RLS on every table, column-level write protection, private chat storage | ✅ Done |

---

## Known limitations

These are deliberate scope decisions or next steps, not hidden gaps:

- **Not yet run on a physical device by the author of this code.** The app passes a strict TypeScript check, bundles successfully for Android with Expo's production exporter, passes all Expo Doctor checks, and the database passes the 76-check test suite. A full manual pass on real iOS and Android devices is still needed before launch.
- **Push notifications** (when the app is closed) are not implemented. The brief asked for in-app notifications, which update in real time while the app is open. Adding Expo push notifications is the natural next step.
- **Moderation of reports** happens in the Supabase dashboard. There is no staff admin screen in the app.
- **Post and listing media** live in public buckets with unguessable UUID paths and no listing permission. Chat photos are fully private, using signed URLs for participants only. Switch the `media` bucket to private and signed URLs if stricter media privacy is required.
- **App icon and splash artwork** use Expo defaults. Add branded assets to `assets/` and reference them in `app.json`.
- **Uploads** are limited to 50 MB, the Supabase free-tier limit, and videos to 90 seconds. There is no upload progress bar yet.
