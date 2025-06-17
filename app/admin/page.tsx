import { requireRole } from '@/lib/auth';
import { getSearchAnalytics, getPopularSearches } from '@/lib/db';
import Analytics from '@/components/Analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminPage() {
  const user = await requireRole('admin');
  const analytics = await getSearchAnalytics(7);
  const popularSearches = await getPopularSearches(10);

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Monitor search behavior and system usage</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Search Volume</CardTitle>
            <CardDescription>Daily search activity over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Analytics data={analytics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Searches</CardTitle>
            <CardDescription>Most common search queries in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {popularSearches.map((search: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{search.query}</p>
                    <p className="text-sm text-muted-foreground">
                      {search.count} searches • {search.avg_results.toFixed(1)} avg results
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}