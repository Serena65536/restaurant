import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Category} from './types';

const STORAGE_KEY = 'restaurant.apiBaseUrl';

let baseUrl = '';

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getBaseUrl(): string {
  return baseUrl;
}

export async function loadStoredBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      baseUrl = normalizeBaseUrl(stored);
    }
  } catch {
    // 读不到就当作没配置，回到设置页
  }
  return baseUrl;
}

export async function saveBaseUrl(input: string): Promise<string> {
  baseUrl = normalizeBaseUrl(input);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, baseUrl);
  } catch {
    // 存不下也要能继续用（内存里仍然有效），不能因为本地存储失败卡住界面
  }
  return baseUrl;
}

export function absoluteImage(pathOrUrl: string): string {
  if (!pathOrUrl) {
    return '';
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const prefix = baseUrl.replace(/\/+$/, '');
  return `${prefix}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export type ProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
  body?: string;
};

/**
 * 带「硬超时」的探测：不依赖 AbortController 真的生效，用 Promise.race 保证
 * 再慢也会在 timeoutMs 内给出结论，界面不会无限转圈。
 */
export async function probeEndpoint(
  base: string,
  path: string,
  timeoutMs = 8000,
): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
      reject(new Error(`等待 ${timeoutMs}ms 没有响应`));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      fetch(`${base.replace(/\/+$/, '')}${path}`, {signal: controller.signal}),
      timeout,
    ]);
    const body = await Promise.race([res.text(), timeout]);
    return {ok: res.ok, status: res.status, ms: Date.now() - started, body};
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function request<T>(path: string, timeoutMs = 8000): Promise<T> {
  const result = await probeEndpoint(baseUrl, path, timeoutMs);
  if (result.status === 0) {
    throw new Error(result.error ?? '网络请求失败');
  }
  if (!result.ok) {
    throw new Error(`HTTP ${result.status}`);
  }
  try {
    return JSON.parse(result.body ?? '') as T;
  } catch {
    throw new Error('返回的不是 JSON，地址可能指错了');
  }
}

export type HealthPayload = {ok: boolean; dishes: number};

export function fetchHealth(): Promise<HealthPayload> {
  return request<HealthPayload>('/api/health', 5000);
}

/** 上次拉到的菜单：回到点餐页先用它渲染，不必每次进来都等一个网络往返 */
let menuCache: Category[] | null = null;

export function getCachedMenu(): Category[] | null {
  return menuCache;
}

export async function fetchMenu(): Promise<Category[]> {
  const data = await request<{categories: Category[]}>('/api/menu');
  menuCache = data.categories ?? [];
  return menuCache;
}
