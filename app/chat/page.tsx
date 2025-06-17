import { requireAuth } from '@/lib/auth';
import { getResumesForUser } from '@/lib/db';
import ChatInterface from '@/components/ChatInterface';
import { Suspense } from 'react';

export default async function ChatPage() {
  const user = await requireAuth();
  const resumes = await getResumesForUser(user.id);

  return (
    <div className="container py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Resume Search</h1>
          <p className="text-muted-foreground">
            Ask natural language questions to search through {resumes.length} resumes
          </p>
        </div>
        <Suspense fallback={<div>Loading chat interface...</div>}>
          <ChatInterface userId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}