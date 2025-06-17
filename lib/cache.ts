import { kv } from '@vercel/kv';
import { Resume } from './db';

interface CachedSearch {
  results: Resume[];
  explanation: string;
  timestamp: number;
}

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

// Generate cache key for search queries
export function generateCacheKey(userId: string, query: string): string {
  // Normalize query for better cache hits
  const normalizedQuery = query.toLowerCase().trim();
  return `search:${userId}:${normalizedQuery}`;
}

// Get cached search results
export async function getCachedSearch(
  userId: string,
  query: string
): Promise<CachedSearch | null> {
  try {
    const key = generateCacheKey(userId, query);
    const cached = await kv.get<CachedSearch>(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached;
    }
    
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

// Set cached search results
export async function setCachedSearch(
  userId: string,
  query: string,
  results: Resume[],
  explanation: string
): Promise<void> {
  try {
    const key = generateCacheKey(userId, query);
    const data: CachedSearch = {
      results,
      explanation,
      timestamp: Date.now(),
    };
    
    await kv.set(key, data, { ex: CACHE_TTL });
  } catch (error) {
    console.error('Cache set error:', error);
    // Don't throw - caching is not critical
  }
}

// Cache user permissions
export async function getCachedPermissions(userId: string): Promise<string[] | null> {
  try {
    const key = `permissions:${userId}`;
    return await kv.get<string[]>(key);
  } catch (error) {
    console.error('Permission cache error:', error);
    return null;
  }
}

export async function setCachedPermissions(
  userId: string,
  resumeIds: string[]
): Promise<void> {
  try {
    const key = `permissions:${userId}`;
    // Cache for 5 minutes
    await kv.set(key, resumeIds, { ex: 300 });
  } catch (error) {
    console.error('Permission cache set error:', error);
  }
}

// Clear user cache (useful after permission changes)
export async function clearUserCache(userId: string): Promise<void> {
  try {
    // Get all keys for this user
    const searchPattern = `search:${userId}:*`;
    const permissionKey = `permissions:${userId}`;
    
    // Note: Vercel KV doesn't support pattern deletion
    // In production, you might want to track keys or use a different strategy
    await kv.del(permissionKey);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// Analytics caching
export async function getCachedAnalytics(key: string): Promise<any | null> {
  try {
    return await kv.get(key);
  } catch (error) {
    console.error('Analytics cache error:', error);
    return null;
  }
}

export async function setCachedAnalytics(
  key: string,
  data: any,
  ttl: number = 300 // 5 minutes default
): Promise<void> {
  try {
    await kv.set(key, data, { ex: ttl });
  } catch (error) {
    console.error('Analytics cache set error:', error);
  }
}