import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from './db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const alg = 'HS256';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
}

export async function signToken(user: User): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.user as User;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const token = cookies().get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function login(email: string, password: string): Promise<User | null> {
  // In production, properly hash passwords
  const result = await sql`
    SELECT id, email, name, role 
    FROM users 
    WHERE email = ${email} AND password = crypt(${password}, password)
  `;
  
  if (result.length === 0) return null;
  
  const user = result[0] as User;
  const token = await signToken(user);
  
  cookies().set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return user;
}

export async function logout() {
  cookies().delete('auth-token');
}

export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireRole(role: 'admin' | 'manager' | 'viewer'): Promise<User> {
  const user = await requireAuth();
  
  const roleHierarchy = {
    viewer: 0,
    manager: 1,
    admin: 2,
  };
  
  if (roleHierarchy[user.role] < roleHierarchy[role]) {
    throw new Error('Forbidden');
  }
  
  return user;
}