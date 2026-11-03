import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { createListing, fetchListing, updateListing } from '@/api/marketplace';
import { FormScaffold } from '@/components/FormScaffold';
import { MediaItem, MediaPickerStrip } from '@/components/MediaPickerStrip';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { IconName } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_ICONS,
  LISTING_CONDITIONS,
  LISTING_TYPE_LABELS,
  LISTING_TYPES,
  ListingCategory,
  ListingCondition,
  ListingType,
  MAX_LISTING_IMAGES,
} from '@/lib/constants';
import { pickFromLibrary, PickedMedia, uploadPublic } from '@/lib/media';
import { uuid } from '@/lib/uuid';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { spacing } from '@/theme/tokens';

type Photo = { key: string; remoteUrl?: string; local?: PickedMedia };

export default function ListingForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const { userId } = useCurrentUser();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState<ListingType>('sale');
  const [category, setCategory] = useState<ListingCategory>('Textbooks');
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const existing = useQuery({ queryKey: queryKeys.listing(id ?? ''), queryFn: () => fetchListing(id as string), enabled: editing });

  useEffect(() => {
    const l = existing.data;
    if (!l) return;
    if (l.seller_id !== userId) {
      showToast('You can only edit your own listings', 'error');
      router.back();
      return;
    }
    setTitle(l.title);
    setDescription(l.description);
    setPrice(l.price ? String(l.price) : '');
    setListingType(l.listing_type);
    setCategory(l.category);
    setCondition(l.condition);
    setPhotos(l.image_urls.map((url) => ({ key: url, remoteUrl: url })));
  }, [existing.data, userId, showToast]);

  const addPhotos = async () => {
    try {
      const picked = await pickFromLibrary({ multiple: true, max: MAX_LISTING_IMAGES - photos.length });
      setPhotos((current) => [...current, ...picked.map((p) => ({ key: uuid(), local: p }))].slice(0, MAX_LISTING_IMAGES));
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const chooseType = (type: ListingType) => {
    setListingType(type);
    if (type === 'free') {
      setPrice('');
      setCategory('Free');
    } else if (category === 'Free') {
      setCategory('Miscellaneous');
    }
  };

  const submit = async () => {
    const numericPrice = listingType === 'free' ? 0 : Number(price.replace(/[£,\s]/g, '') || '0');
    const next = {
      title: title.trim().length < 3 ? 'Add a title (at least 3 characters).' : null,
      price:
        listingType === 'sale' && (!Number.isFinite(numericPrice) || numericPrice <= 0)
          ? 'Enter a price, or choose Free.'
          : !Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 100000
            ? 'Enter a valid price.'
            : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      const imageUrls = await Promise.all(
        photos.map((p) => (p.remoteUrl ? Promise.resolve(p.remoteUrl) : uploadPublic('media', userId, p.local as PickedMedia))),
      );
      const input = {
        title,
        description,
        price: Math.round(numericPrice * 100) / 100,
        listingType,
        category,
        condition,
        imageUrls,
      };
      if (editing && id) {
        await updateListing(id, input);
        showToast('Listing updated');
      } else {
        await createListing(userId, input);
        showToast('Your listing is live!');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.listings });
      router.back();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const items: MediaItem[] = photos.map((p) => ({ key: p.key, uri: p.remoteUrl ?? p.local?.uri ?? '', kind: 'image' }));

  return (
    <FormScaffold title={editing ? 'Edit listing' : 'Sell or swap'} submitLabel={editing ? 'Save' : 'List it'} onSubmit={submit} submitting={saving} loading={editing && existing.isPending}>
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Photos ({photos.length}/{MAX_LISTING_IMAGES})
        </AppText>
        <MediaPickerStrip items={items} max={MAX_LISTING_IMAGES} onAdd={addPhotos} onRemove={(key) => setPhotos((current) => current.filter((p) => p.key !== key))} />
      </View>
      <TextField label="Title" placeholder="e.g. IKEA desk lamp" value={title} onChangeText={setTitle} maxLength={100} error={errors.title} />
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Type
        </AppText>
        <View style={styles.wrap}>
          {LISTING_TYPES.map((t) => (
            <Chip key={t} label={LISTING_TYPE_LABELS[t]} selected={listingType === t} onPress={() => chooseType(t)} />
          ))}
        </View>
      </View>
      {listingType !== 'free' ? (
        <TextField
          label={listingType === 'exchange' ? 'Value (optional)' : 'Price'}
          placeholder="0.00"
          leftIcon="cash-outline"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          error={errors.price}
          hint="In pounds (£)."
        />
      ) : null}
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Category
        </AppText>
        <View style={styles.wrap}>
          {LISTING_CATEGORIES.map((c) => (
            <Chip key={c} label={c} icon={LISTING_CATEGORY_ICONS[c] as IconName} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Condition (optional)
        </AppText>
        <View style={styles.wrap}>
          {LISTING_CONDITIONS.map((c) => (
            <Chip key={c} label={c} selected={condition === c} onPress={() => setCondition(condition === c ? null : c)} />
          ))}
        </View>
      </View>
      <TextField
        label="Description"
        placeholder="Condition, size, pickup location (e.g. Headingley Campus)…"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        showCount
      />
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupLabel: { marginLeft: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
