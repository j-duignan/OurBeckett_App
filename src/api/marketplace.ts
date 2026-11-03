import type { ListingCategory, ListingCondition, ListingType } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Listing } from '@/types/models';

export type ListingFilter = {
  category?: ListingCategory | 'All';
  search?: string;
  sellerId?: string;
};

export async function fetchListings(filter: ListingFilter = {}): Promise<Listing[]> {
  let query = supabase.from('listing_feed').select('*');
  if (filter.sellerId) {
    query = query.eq('seller_id', filter.sellerId);
  } else {
    query = query.neq('status', 'sold');
  }
  if (filter.category && filter.category !== 'All') {
    query = filter.category === 'Free'
      ? query.or('category.eq.Free,listing_type.eq.free')
      : query.eq('category', filter.category);
  }
  const term = filter.search?.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.ilike('title', `%${term}%`);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(80);
  if (error) throw error;
  return ((data ?? []) as Listing[]).map((l) => ({ ...l, price: Number(l.price) }));
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listing_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const listing = data as Listing;
  return { ...listing, price: Number(listing.price) };
}

export type ListingInput = {
  title: string;
  description: string;
  price: number;
  listingType: ListingType;
  category: ListingCategory;
  condition: ListingCondition | null;
  imageUrls: string[];
};

function toRow(input: ListingInput) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.listingType === 'free' ? 0 : input.price,
    listing_type: input.listingType,
    category: input.category,
    condition: input.condition,
    image_urls: input.imageUrls,
  };
}

export async function createListing(sellerId: string, input: ListingInput): Promise<string> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({ ...toRow(input), seller_id: sellerId })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateListing(id: string, input: ListingInput): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

export async function setListingStatus(id: string, status: Listing['status']): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').delete().eq('id', id);
  if (error) throw error;
}

export function formatPrice(listing: Pick<Listing, 'price' | 'listing_type'>): string {
  if (listing.listing_type === 'free' || listing.price === 0) return 'Free';
  if (listing.listing_type === 'exchange') return listing.price > 0 ? `Swap · £${listing.price.toFixed(2)}` : 'Swap';
  return `£${listing.price % 1 === 0 ? listing.price.toFixed(0) : listing.price.toFixed(2)}`;
}
