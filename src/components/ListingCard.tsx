import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatPrice } from '@/api/marketplace';
import { LISTING_CATEGORY_ICONS } from '@/lib/constants';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { Listing } from '@/types/models';

import { AppText } from './ui/AppText';
import { Icon, IconName } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

export function ListingCard({ listing, width }: { listing: Listing; width: number }) {
  const { colors } = useTheme();
  const cover = listing.image_urls[0];
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
      scaleTo={0.97}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing)}`}
    >
      <View style={[styles.imageWrap, { backgroundColor: colors.surface }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={cover} />
        ) : (
          <Icon name={LISTING_CATEGORY_ICONS[listing.category] as IconName} size={36} color={colors.textMuted} />
        )}
        {listing.status !== 'available' ? (
          <View style={[styles.status, { backgroundColor: listing.status === 'sold' ? colors.danger : colors.warning }]}>
            <AppText variant="tiny" style={styles.white}>
              {listing.status === 'sold' ? 'SOLD' : 'RESERVED'}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong">{formatPrice(listing)}</AppText>
        <AppText variant="callout" tone="secondary" numberOfLines={1}>
          {listing.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {listing.category} · {timeAgo(listing.created_at)}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { position: 'absolute', left: spacing.sm, top: spacing.sm, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  white: { color: '#FFFFFF' },
  body: { paddingTop: spacing.sm, paddingHorizontal: 2, gap: 1 },
});
