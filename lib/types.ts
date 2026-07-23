import type { Restaurant, Review, Profile } from "@/app/generated/prisma/client";

export type ReviewWithRestaurant = Review & { restaurant: Restaurant };
export type ProfileWithReviews = Profile & {
  reviews: ReviewWithRestaurant[];
};

/**
 * 把 SQLite 里存的 JSON string array 解析回数组
 */
export function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Parse cuisine array from Restaurant.cuisine (JSON string)
 */
export function parseCuisines(cuisine: string | null | undefined): string[] {
  return parseJsonArray(cuisine);
}
