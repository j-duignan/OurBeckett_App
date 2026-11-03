import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { queryKeys } from '@/api/keys';
import {
  deleteMessage,
  fetchConversationMembers,
  fetchMessages,
  markConversationRead,
  MESSAGE_PAGE,
  sendMessage,
  signedChatImageUrl,
} from '@/api/messages';
import { ImageViewer } from '@/components/ImageViewer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { goBack } from '@/components/ui/Header';
import { useBlockUser, useReport } from '@/hooks/useModeration';
import { pickFromLibrary, uploadToBucket } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { formatClock, formatDayLabel, isSameDay, lastSeenLabel } from '@/lib/time';
import { uuid } from '@/lib/uuid';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useIsOnline } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { Message } from '@/types/models';

function ChatImage({ path, localUri, onOpen }: { path: string | null; localUri?: string; onOpen: (uri: string) => void }) {
  const { colors } = useTheme();
  const signed = useQuery({
    queryKey: ['chat-image', path],
    queryFn: () => signedChatImageUrl(path as string),
    enabled: Boolean(path) && !localUri,
    staleTime: 50 * 60_000,
  });
  const uri = localUri ?? signed.data;
  return (
    <Pressable onPress={() => uri && onOpen(uri)} accessibilityRole="imagebutton" accessibilityLabel="Photo">
      <View style={[styles.chatImage, { backgroundColor: colors.skeleton }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <ActivityIndicator color={colors.textMuted} />}
      </View>
    </Pressable>
  );
}

export default function Chat() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const report = useReport();
  const { block } = useBlockUser();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [text, setText] = useState(draft ?? '');
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const membersQuery = useQuery({
    queryKey: queryKeys.conversationMembers(id),
    queryFn: () => fetchConversationMembers(id),
  });
  const other = membersQuery.data?.find((m) => m.user_id !== userId);
  const otherProfile = other?.profile ?? null;
  const online = useIsOnline(otherProfile?.id);

  useEffect(() => {
    if (other) setOtherReadAt(other.last_read_at);
  }, [other]);

  const markRead = useCallback(() => {
    markConversationRead(id, userId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      })
      .catch(() => undefined);
  }, [id, userId, queryClient]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchMessages(id);
      setMessages(rows);
      setHasOlder(rows.length === MESSAGE_PAGE);
      markRead();
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [id, markRead]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Realtime: new messages, read receipts and typing indicator.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${id}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) => {
            const exists = current.some((m) => m.id === incoming.id);
            if (exists) return current.map((m) => (m.id === incoming.id ? { ...incoming, localUri: m.localUri } : m));
            return [incoming, ...current];
          });
          if (incoming.sender_id !== userId) {
            setOtherTyping(false);
            markRead();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string };
          if (row.user_id !== userId) setOtherReadAt(row.last_read_at);
        },
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const from = (payload.payload as { userId?: string } | undefined)?.userId;
        if (from && from !== userId) {
          setOtherTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setOtherTyping(false), 3500);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [id, userId, markRead]);

  const loadOlder = async () => {
    if (loadingOlder || !hasOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[messages.length - 1];
      const rows = await fetchMessages(id, oldest.created_at);
      setMessages((current) => {
        const ids = new Set(current.map((m) => m.id));
        return [...current, ...rows.filter((r) => !ids.has(r.id))];
      });
      setHasOlder(rows.length === MESSAGE_PAGE);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2000 && channelRef.current) {
      lastTypingSent.current = now;
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId } }).catch(() => undefined);
    }
  };

  const deliver = async (message: Message, imageUri?: string, mimeType?: string) => {
    try {
      let imagePath = message.image_path;
      if (imageUri && !imagePath) {
        imagePath = await uploadToBucket('chat', id, { uri: imageUri, kind: 'image', mimeType: mimeType ?? 'image/jpeg', width: 0, height: 0 });
      }
      const saved = await sendMessage({ id: message.id, conversationId: id, senderId: userId, body: message.body, imagePath });
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...saved, localUri: m.localUri } : m)));
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    } catch (err) {
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, pending: false, failed: true } : m)));
      showToast(friendlyError(err), 'error');
    }
  };

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    const message: Message = {
      id: uuid(),
      conversation_id: id,
      sender_id: userId,
      body,
      image_path: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [message, ...current]);
    setText('');
    deliver(message);
  };

  const sendImage = async () => {
    try {
      const [picked] = await pickFromLibrary();
      if (!picked) return;
      const message: Message = {
        id: uuid(),
        conversation_id: id,
        sender_id: userId,
        body: '',
        image_path: null,
        created_at: new Date().toISOString(),
        pending: true,
        localUri: picked.uri,
      };
      setMessages((current) => [message, ...current]);
      deliver(message, picked.uri, picked.mimeType);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const retry = (message: Message) => {
    setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, pending: true, failed: false } : m)));
    deliver(message, message.localUri, undefined);
  };

  const messageMenu = (message: Message) => {
    const mine = message.sender_id === userId;
    const options: SheetOption[] = [];
    if (mine && message.failed) {
      options.push({ label: 'Retry sending', icon: 'refresh', onPress: () => retry(message) });
      options.push({
        label: 'Discard',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => setMessages((current) => current.filter((m) => m.id !== message.id)),
      });
    } else if (mine && !message.pending) {
      options.push({
        label: 'Unsend message',
        icon: 'trash-outline',
        destructive: true,
        onPress: async () => {
          try {
            await deleteMessage(message.id);
            setMessages((current) => current.filter((m) => m.id !== message.id));
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      });
    } else if (!mine) {
      options.push({ label: 'Report message', icon: 'flag-outline', destructive: true, onPress: () => report('message', message.id, 'message') });
    }
    if (options.length) showSheet({ options });
  };

  const openHeaderMenu = () => {
    if (!otherProfile) return;
    showSheet({
      title: otherProfile.display_name,
      options: [
        {
          label: 'View profile',
          icon: 'person-circle-outline',
          onPress: () => router.push({ pathname: '/user/[username]', params: { username: otherProfile.username } }),
        },
        { label: 'Report', icon: 'flag-outline', destructive: true, onPress: () => report('user', otherProfile.id, `@${otherProfile.username}`) },
        { label: 'Block', icon: 'ban-outline', destructive: true, onPress: () => block(otherProfile.id, otherProfile.username, goBack) },
      ],
    });
  };

  // The newest message I sent (for the Seen / Sent receipt).
  const lastMineId = useMemo(() => messages.find((m) => m.sender_id === userId)?.id, [messages, userId]);

  const status = otherTyping ? 'typing…' : lastSeenLabel(otherProfile?.last_seen_at ?? null, online);

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.sender_id === userId;
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const showDay = !older || !isSameDay(new Date(older.created_at), new Date(item.created_at));
    const groupedWithNewer = newer && newer.sender_id === item.sender_id && isSameDay(new Date(newer.created_at), new Date(item.created_at));
    const seen = otherReadAt ? new Date(otherReadAt).getTime() >= new Date(item.created_at).getTime() : false;

    return (
      <View>
        {showDay ? (
          <AppText variant="tiny" tone="muted" align="center" style={styles.day}>
            {formatDayLabel(item.created_at)}
          </AppText>
        ) : null}
        <View style={[styles.messageRow, mine ? styles.mineRow : styles.theirRow, { marginBottom: groupedWithNewer ? 2 : spacing.sm }]}>
          <Pressable
            onLongPress={() => messageMenu(item)}
            onPress={item.failed ? () => messageMenu(item) : undefined}
            delayLongPress={300}
            style={[
              styles.bubble,
              item.image_path || item.localUri ? styles.imageBubble : null,
              {
                backgroundColor: mine ? colors.bubbleMine : colors.bubbleTheirs,
                opacity: item.pending ? 0.7 : 1,
                borderBottomRightRadius: mine && !groupedWithNewer ? 6 : radius.xl,
                borderBottomLeftRadius: !mine && !groupedWithNewer ? 6 : radius.xl,
              },
            ]}
            accessibilityHint="Long press for options"
          >
            {item.image_path || item.localUri ? <ChatImage path={item.image_path} localUri={item.localUri} onOpen={setViewerUri} /> : null}
            {item.body ? (
              <AppText style={[styles.bubbleText, { color: mine ? colors.bubbleMineText : colors.bubbleTheirsText }]}>{item.body}</AppText>
            ) : null}
            <AppText
              variant="tiny"
              style={[styles.time, { color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted }, item.image_path && !item.body ? styles.timeOnImage : null]}
            >
              {formatClock(new Date(item.created_at))}
            </AppText>
          </Pressable>
          {mine && item.failed ? (
            <AppText variant="tiny" tone="danger" style={styles.receipt}>
              Not sent · tap to retry
            </AppText>
          ) : mine && item.id === lastMineId ? (
            <AppText variant="tiny" tone="muted" style={styles.receipt}>
              {item.pending ? 'Sending…' : seen ? 'Seen' : 'Sent'}
            </AppText>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <IconButton icon="chevron-back" accessibilityLabel="Go back" onPress={goBack} />
        <Pressable
          style={styles.headerUser}
          onPress={() => otherProfile && router.push({ pathname: '/user/[username]', params: { username: otherProfile.username } })}
          accessibilityRole="button"
        >
          <Avatar uri={otherProfile?.avatar_url} name={otherProfile?.display_name ?? '…'} size={38} online={online} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {otherProfile?.display_name ?? ' '}
            </AppText>
            <AppText variant="caption" tone={otherTyping || online ? 'link' : 'muted'} numberOfLines={1}>
              {otherProfile ? status : ' '}
            </AppText>
          </View>
        </Pressable>
        <IconButton icon="ellipsis-horizontal" accessibilityLabel="Conversation options" onPress={openHeaderMenu} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 58 : 0}>
        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState error={loadError} onRetry={loadInitial} />
        ) : (
          <FlatList
            data={messages}
            inverted={messages.length > 0}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={messages.length ? styles.listContent : styles.grow}
            ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.older} color={colors.primary} /> : undefined}
            ListEmptyComponent={
              <EmptyState
                icon="hand-left-outline"
                title={otherProfile ? `Say hi to ${otherProfile.display_name.split(' ')[0]}` : 'Say hi'}
                message="Be kind. Messages are private between you two."
              />
            }
          />
        )}

        {otherTyping ? (
          <View style={styles.typingRow}>
            <View style={[styles.typingBubble, { backgroundColor: colors.bubbleTheirs }]}>
              <AppText variant="caption" tone="muted">
                typing…
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <IconButton icon="image-outline" accessibilityLabel="Send a photo" onPress={sendImage} color={colors.link} />
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={[styles.input, typography.body, { backgroundColor: colors.inputBackground, color: colors.text }]}
          />
          <PressableScale
            onPress={sendText}
            disabled={!text.trim()}
            style={[styles.send, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Icon name="arrow-up" size={20} color="#FFFFFF" />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {viewerUri ? <ImageViewer images={[viewerUri]} initialIndex={0} visible onClose={() => setViewerUri(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    height: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  older: { marginVertical: spacing.md },
  day: { marginVertical: spacing.md },
  messageRow: { maxWidth: '80%' },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs + 2,
  },
  imageBubble: { padding: 4, paddingBottom: 4 },
  bubbleText: { ...typography.body, paddingHorizontal: 0 },
  time: { alignSelf: 'flex-end', marginTop: 2, fontSize: 10 },
  timeOnImage: { position: 'absolute', right: 12, bottom: 8, color: '#FFFFFF' },
  receipt: { marginTop: 3, marginRight: spacing.xs },
  chatImage: { width: 220, height: 260, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  typingBubble: { alignSelf: 'flex-start', borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 130,
    minHeight: 40,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md + 2,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs },
});
