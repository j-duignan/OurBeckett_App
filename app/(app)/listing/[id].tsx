import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { queryKeys } from '@/api/keys';
import { deleteListing, fetchListing, formatPrice, setListingStatus } from '@/api/marketplace';
import { ImageViewer } from '@/components/ImageViewer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Icon, IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useReport, useStartConversation } from '@/hooks/useModeration';
import { LISTING_CATEGORY_ICONS, LISTING_TYPE_LABELS } from '@/lib/constants';
import { relativeLabel } from '@/lib/time';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { Listing } from '@/types/models';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const report = useReport();
  const startConversation = useStartConversation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [contacting, setContacting] = useState(false);

  const query = useQuery({ queryKey: queryKeys.listing(id), queryFn: () => fetchListing(id) });

  if (query.isPending || query.isError || !query.data) {
    return (
      <Screen>
        <Header title="Listing" />
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <EmptyState icon="storefront-outline" title="Listing not found" message="It may have been removed by the seller." />
        )}
      </Screen>
    );
  }

  const listing = query.data;
  const isMine = listing.seller_id === userId;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.listings });

  const updateStatus = async (status: Listing['status']) => {
    try {
      await setListingStatus(listing.id, status);
      invalidate();
      showToast(status === 'sold' ? 'Marked as sold. Nice one!' : status === 'reserved' ? 'Marked as reserved' : 'Listing is available again');
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const remove = () =>
    Alert.alert('Delete listing?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteListing(listing.id);
            invalidate();
            showToast('Listing deleted');
            router.back();
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      },
    ]);

  const share = () => {
    const link = ExpoLinking.createURL(`/listing/${listing.id}`);
    Share.share({ message: `${listing.title} · ${formatPrice(listing)} on OurBeckett Marketplace\n${link}` }).catch(() => undefined);
  };

  const openMenu = () => {
    const options: SheetOption[] = [{ label: 'Share listing', icon: 'share-outline', onPress: share }];
    if (isMine) {
      options.push({ label: 'Edit listing', icon: 'create-outline', onPress: () => router.push({ pathname: '/create/listing', params: { id: listing.id } }) });
      if (listing.status !== 'available') options.push({ label: 'Mark as available', icon: 'refresh', onPress: () => updateStatus('available') });
      if (listing.status !== 'reserved') options.push({ label: 'Mark as reserved', icon: 'time-outline', onPress: () => updateStatus('reserved') });
      if (listing.status !== 'sold') options.push({ label: 'Mark as sold', icon: 'checkmark-done-outline', onPress: () => updateStatus('sold') });
      options.push({ label: 'Delete listing', icon: 'trash-outline', destructive: true, onPress: remove });
    } else {
      options.push({ label: 'Report listing', icon: 'flag-outline', destructive: true, onPress: () => report('listing', listing.id, 'listing') });
    }
    showSheet({ options });
  };

  const contact = async () => {
    setContacting(true);
    await startConversation(listing.seller_id, `Hi! Is your "${listing.title}" still available?`);
    setContacting(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={{ width, height: width, backgroundColor: colors.surface }}>
          {listing.image_urls.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              {listing.image_urls.map((uri, i) => (
                <Pressable key={uri} onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1}`}>
                  <Image source={{ uri }} style={{ width, height: width }} contentFit="cover" transition={150} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noImage}>
              <Icon name={LISTING_CATEGORY_ICONS[listing.category] as IconName} size={64} color={colors.textMuted} />
            </View>
          )}
          <View style={[styles.topActions, { top: insets.top + spacing.xs }]}>
            <IconButton icon="chevron-back" color="#FFFFFF" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.overlayButton} />
            <IconButton icon="ellipsis-horizontal" color="#FFFFFF" accessibilityLabel="Listing options" onPress={openMenu} style={styles.overlayButton} />
          </View>
          {listing.image_urls.length > 1 ? (
            <View style={styles.dots}>
              {listing.image_urls.map((uri, i) => (
                <View key={uri} style={[styles.dot, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {listing.status !== 'available' ? (
            <View style={[styles.status, { backgroundColor: listing.status === 'sold' ? colors.dangerSoft : colors.primarySoft }]}>
              <AppText variant="label" tone={listing.status === 'sold' ? 'danger' : 'link'}>
                {listing.status === 'sold' ? 'SOLD' : 'RESERVED'}
              </AppText>
            </View>
          ) : null}
          <AppText variant="display">{formatPrice(listing)}</AppText>
          <AppText variant="h2">{listing.title}</AppText>
          <AppText variant="caption" tone="muted">
            Listed {relativeLabel(listing.created_at)}
          </AppText>
          <View style={styles.chips}>
            <Chip label={listing.category} small icon={LISTING_CATEGORY_ICONS[listing.category] as IconName} />
            <Chip label={LISTING_TYPE_LABELS[listing.listing_type]} small />
            {listing.condition ? <Chip label={listing.condition} small icon="sparkles-outline" /> : null}
          </View>
          {listing.description ? <AppText style={styles.description}>{listing.description}</AppText> : null}

          <Pressable
            onPress={() => router.push({ pathname: '/user/[username]', params: { username: listing.seller_username } })}
            style={[styles.seller, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Avatar uri={listing.seller_avatar_url} name={listing.seller_display_name} size={46} />
            <View style={styles.flex}>
              <AppText variant="caption" tone="muted">
                Seller
              </AppText>
              <AppText variant="bodyStrong">{listing.seller_display_name}</AppText>
              <AppText variant="caption" tone="muted">
                @{listing.seller_username}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isMine ? (
          <>
            <Button title="Edit" icon="create-outline" variant="outline" onPress={() => router.push({ pathname: '/create/listing', params: { id: listing.id } })} />
            <Button
              title={listing.status === 'sold' ? 'Relist' : 'Mark as sold'}
              icon={listing.status === 'sold' ? 'refresh' : 'checkmark-done-outline'}
              variant="secondary"
              style={styles.flex}
              onPress={() => updateStatus(listing.status === 'sold' ? 'available' : 'sold')}
            />
          </>
        ) : (
          <Button
            title={listing.status === 'sold' ? 'This item has sold' : 'Message seller'}
            icon="chatbubble-ellipses-outline"
            variant="gradient"
            style={styles.flex}
            loading={contacting}
            disabled={listing.status === 'sold'}
            onPress={contact}
          />
        )}
      </View>

      {viewer !== null ? <ImageViewer images={listing.image_urls} initialIndex={viewer} visible onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topActions: { position: 'absolute', left: spacing.sm, right: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  overlayButton: { backgroundColor: 'rgba(0,0,0,0.35)' },
  dots: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { padding: spacing.lg, gap: spacing.xs },
  status: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  description: { marginTop: spacing.md },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.xl },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
