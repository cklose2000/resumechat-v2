import { neon, neonConfig } from '@neondatabase/serverless';
import { getUser } from './auth';

// Configure Neon for edge runtime
neonConfig.fetchConnectionCache = true;

// Export the sql template tag for edge-compatible queries
export const sql = neon(process.env.DATABASE_URL!);

// Helper to execute queries with RLS context
export async function sqlWithRLS(userId: string) {
  const client = neon(process.env.DATABASE_URL!);
  
  // Set the current user for RLS
  await client`SET LOCAL app.current_user_id = ${userId}`;
  
  return client;
}

// Helper to get authenticated SQL client
export async function getAuthenticatedSql() {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return sqlWithRLS(user.id);
}

// Type definitions for our database
export interface Resume {
  id: string;
  name: string;
  email: string;
  phone?: string;
  content: string;
  parsed_data?: any;
  file_path?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface SearchLog {
  id: string;
  user_id: string;
  conversation_id?: string;
  query: string;
  response?: string;
  tokens_used?: number;
  latency_ms?: number;
  cache_hit: boolean;
  created_at: Date;
}

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  context?: any;
  created_at: Date;
  updated_at: Date;
}

// Database queries with RLS
export async function getResumesForUser(userId: string): Promise<Resume[]> {
  const client = await sqlWithRLS(userId);
  
  return client`
    SELECT * FROM resumes
    ORDER BY created_at DESC
  `;
}

export async function getResumeById(id: string, userId: string): Promise<Resume | null> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    SELECT * FROM resumes
    WHERE id = ${id}
  `;
  
  return result[0] as Resume || null;
}

export async function createResume(resume: Omit<Resume, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Resume> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    INSERT INTO resumes (name, email, phone, content, parsed_data, file_path, created_by)
    VALUES (${resume.name}, ${resume.email}, ${resume.phone}, ${resume.content}, 
            ${resume.parsed_data}, ${resume.file_path}, ${userId})
    RETURNING *
  `;
  
  return result[0] as Resume;
}

export async function updateResume(
  id: string, 
  updates: Partial<Omit<Resume, 'id' | 'created_at' | 'updated_at' | 'created_by'>>,
  userId: string
): Promise<Resume | null> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    UPDATE resumes
    SET ${sql(updates)}
    WHERE id = ${id}
    RETURNING *
  `;
  
  return result[0] as Resume || null;
}

export async function deleteResume(id: string, userId: string): Promise<boolean> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    DELETE FROM resumes
    WHERE id = ${id}
    RETURNING id
  `;
  
  return result.length > 0;
}

export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    INSERT INTO conversations (user_id, title)
    VALUES (${userId}, ${title})
    RETURNING *
  `;
  
  return result[0] as Conversation;
}

export async function getConversation(id: string, userId: string): Promise<Conversation | null> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    SELECT * FROM conversations
    WHERE id = ${id}
  `;
  
  return result[0] as Conversation || null;
}

export async function updateConversation(
  id: string,
  updates: { title?: string; context?: any },
  userId: string
): Promise<Conversation | null> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    UPDATE conversations
    SET ${sql(updates)}
    WHERE id = ${id}
    RETURNING *
  `;
  
  return result[0] as Conversation || null;
}

export async function logSearch(
  searchData: {
    query: string;
    response?: string;
    conversation_id?: string;
    tokens_used?: number;
    latency_ms?: number;
    cache_hit?: boolean;
  },
  userId: string
): Promise<SearchLog> {
  const client = await sqlWithRLS(userId);
  
  const result = await client`
    INSERT INTO search_logs (user_id, query, response, conversation_id, tokens_used, latency_ms, cache_hit)
    VALUES (${userId}, ${searchData.query}, ${searchData.response}, ${searchData.conversation_id},
            ${searchData.tokens_used}, ${searchData.latency_ms}, ${searchData.cache_hit || false})
    RETURNING *
  `;
  
  return result[0] as SearchLog;
}

export async function getSearchHistory(userId: string, limit: number = 50): Promise<SearchLog[]> {
  const client = await sqlWithRLS(userId);
  
  return client`
    SELECT * FROM search_logs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function logResumeView(resumeId: string, searchLogId: string, userId: string): Promise<void> {
  const client = await sqlWithRLS(userId);
  
  await client`
    INSERT INTO resume_views (resume_id, user_id, search_log_id)
    VALUES (${resumeId}, ${userId}, ${searchLogId})
  `;
}

// Analytics queries
export async function getSearchAnalytics(days: number = 7) {
  return sql`
    SELECT 
      DATE_TRUNC('day', created_at) as day,
      COUNT(*) as search_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(tokens_used) as avg_tokens,
      AVG(latency_ms) as avg_latency,
      SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as cache_hit_rate
    FROM search_logs
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY day
    ORDER BY day DESC
  `;
}

export async function getPopularSearches(limit: number = 10) {
  return sql`
    SELECT 
      query,
      COUNT(*) as count
    FROM search_logs
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY query
    ORDER BY count DESC
    LIMIT ${limit}
  `;
}

export async function getMostViewedResumes(limit: number = 10) {
  return sql`
    SELECT 
      r.id,
      r.name,
      r.email,
      COUNT(rv.id) as view_count
    FROM resumes r
    JOIN resume_views rv ON r.id = rv.resume_id
    WHERE rv.viewed_at > NOW() - INTERVAL '30 days'
    GROUP BY r.id, r.name, r.email
    ORDER BY view_count DESC
    LIMIT ${limit}
  `;
}