/**
 * Registers a throwaway what-iff account against the mock-LLM backend
 * (POST /api/user/register) and signs the page in through the real form.
 * Mirrors what-iff's own e2e fixtures without importing them, so this repo
 * stays a drop-in example rather than a dependency on their internals.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_URL = process.env['WHATIFF_API_URL'] ?? 'http://localhost:8080/api';

export interface DemoUser {
  username: string;
  email: string;
  password: string;
}

export function newUser(): DemoUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { username: `demo-${id}`, email: `demo-${id}@example.test`, password: 'DemoPlaywright123!' };
}

export async function register(request: APIRequestContext, user: DemoUser): Promise<string> {
  const res = await request.post(`${API_URL}/user/register`, { data: user });
  expect(res.status(), `register ${user.username}: ${await res.text()}`).toBe(201);
  const body = (await res.json()) as { accessToken?: string; access_token?: string };
  return body.accessToken ?? body.access_token ?? '';
}

export async function signIn(page: Page, user: DemoUser): Promise<void> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Enter your username or email').fill(user.email);
  await page.getByPlaceholder('Enter your password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });
}

/** Register + sign in; returns the user so a spec can name things after it. */
export async function freshSession(page: Page, request: APIRequestContext): Promise<DemoUser> {
  const user = newUser();
  await register(request, user);
  await signIn(page, user);
  return user;
}
