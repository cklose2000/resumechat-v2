import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getSearchAnalytics, getPopularSearches } from '@/lib/db';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireRole('admin');
    
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type') || 'overview';
    
    // Check cache
    const cacheKey = `analytics:${type}:${days}`;
    const cached = await getCachedAnalytics(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    let data;
    
    switch (type) {
      case 'searches':
        data = {
          daily: await getSearchAnalytics(days),
          popular: await getPopularSearches(20),
        };
        break;
        
      case 'overview':
      default:
        const [daily, popular] = await Promise.all([
          getSearchAnalytics(days),
          getPopularSearches(10),
        ]);
        
        data = {
          daily,
          popular,
          summary: {
            totalSearches: daily.reduce((sum: number, day: any) => sum + day.search_count, 0),
            uniqueUsers: new Set(daily.map((d: any) => d.unique_users)).size,
            avgResultsPerSearch: daily.reduce((sum: number, day: any) => sum + day.avg_results, 0) / daily.length,
          },
        };
        break;
    }
    
    // Cache for 5 minutes
    await setCachedAnalytics(cacheKey, data, 300);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}