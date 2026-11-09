import AsyncStorage from '@react-native-async-storage/async-storage';
import {getBaseUrl} from './api';

const TOKEN_KEY = 'restaurant.ownerToken';

let token = '';

export async function loadOwnerToken(): Promise<string> {
  try {
    token = (await AsyncStorage.getItem(TOKEN_KEY)) ?? '';
  } catch {
    token = '';
  }
  return token;
}

export async function setOwnerToken(next: string): Promise<void> {
  token = next;
  try {
    await AsyncStorage.setItem(TOKEN_KEY, next);
  } catch {}
}

export async function clearOwnerToken(): Promise<void> {
  token = '';
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function hasOwnerToken(): boolean {
  return !!token;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function adminRequest<T>(
  path: string,
  options: {method?: string; body?: unknown} = {},
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
      reject(new ApiError(0, '等待服务器响应超时'));
    }, 12000);
  });

  try {
    const res = await Promise.race([
      fetch(`${getBaseUrl()}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.body !== undefined ? {'content-type': 'application/json'} : {}),
          ...(token ? {authorization: `Bearer ${token}`} : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      }),
      timeout,
    ]);

    const text = await Promise.race([res.text(), timeout]);
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new ApiError(res.status, json?.message || `HTTP ${res.status}`);
    }
    return json as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, err?.message ?? String(err));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export type Owner = {id: number; phone: string; role: string; name: string};

export async function loginOwner(
  phone: string,
  password: string,
): Promise<{user: Owner; created: boolean}> {
  const data = await adminRequest<{token: string; user: Owner; created?: boolean}>(
    '/api/auth/login',
    {
      method: 'POST',
      body: {phone, password},
    },
  );
  await setOwnerToken(data.token);
  return {user: data.user, created: !!data.created};
}

export type AdminCategory = {
  id: number;
  name: string;
  sortOrder: number;
  visible: boolean;
  dishCount: number;
};

export type AdminDish = {
  id: number;
  categoryId: number;
  name: string;
  image: string;
  priceCents: number;
  description: string;
  available: boolean;
  soldOut: boolean;
  sortOrder: number;
};

export async function fetchCategories(): Promise<AdminCategory[]> {
  const data = await adminRequest<{categories: AdminCategory[]}>('/api/admin/categories');
  return data.categories;
}

export async function createCategory(name: string): Promise<AdminCategory> {
  const data = await adminRequest<{category: AdminCategory}>('/api/admin/categories', {
    method: 'POST',
    body: {name},
  });
  return data.category;
}

export async function updateCategory(
  id: number,
  patch: Partial<{name: string; sortOrder: number; visible: boolean}>,
): Promise<void> {
  await adminRequest(`/api/admin/categories/${id}`, {method: 'PATCH', body: patch});
}

export async function deleteCategory(id: number): Promise<void> {
  await adminRequest(`/api/admin/categories/${id}`, {method: 'DELETE'});
}

export async function fetchAdminDishes(categoryId: number): Promise<AdminDish[]> {
  const data = await adminRequest<{dishes: AdminDish[]}>(
    `/api/admin/dishes?categoryId=${categoryId}`,
  );
  return data.dishes;
}

export async function createDish(payload: {
  categoryId: number;
  name: string;
  priceCents: number;
  description?: string;
  image?: string;
}): Promise<AdminDish> {
  const data = await adminRequest<{dish: AdminDish}>('/api/admin/dishes', {
    method: 'POST',
    body: payload,
  });
  return data.dish;
}

export async function updateDish(
  id: number,
  patch: Partial<{
    categoryId: number;
    name: string;
    priceCents: number;
    description: string;
    image: string;
    available: boolean;
    soldOut: boolean;
  }>,
): Promise<void> {
  await adminRequest(`/api/admin/dishes/${id}`, {method: 'PATCH', body: patch});
}

export async function deleteDish(id: number): Promise<void> {
  await adminRequest(`/api/admin/dishes/${id}`, {method: 'DELETE'});
}

export type AdminSummary = {
  revenueCents: number;
  revenueCount: number;
  revenueSince: string | null;
  todayRevenueCents: number;
  todayPaidCount: number;
  openOrderCount: number;
  todayOrderCount: number;
};

export async function fetchSummary(): Promise<AdminSummary> {
  return adminRequest<AdminSummary>('/api/admin/summary');
}

/** 清零累计营业额（历史订单和流水保留，只是重新开始计数） */
export async function resetRevenue(): Promise<{revenueSince: string}> {
  return adminRequest<{revenueSince: string}>('/api/admin/revenue/reset', {method: 'POST'});
}

export type AdminOrderRow = {
  id: number;
  orderNo: string;
  phone: string;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  totalCents: number;
  createdAt: string;
  paidAt: string | null;
  itemRows: number;
  itemQty: number;
  payChannel: string | null;
  payStatus: string | null;
  outTradeNo: string | null;
};

export async function fetchAdminOrders(limit = 20): Promise<AdminOrderRow[]> {
  const data = await adminRequest<{orders: AdminOrderRow[]}>(
    `/api/admin/orders?limit=${limit}`,
  );
  return data.orders;
}

/** 店主首页专用：分区 + 概况 + 最近订单，一次请求拿全（隧道/代理下少两个往返） */
export async function fetchDashboard(): Promise<{
  categories: AdminCategory[];
  summary: AdminSummary;
  orders: AdminOrderRow[];
}> {
  return adminRequest('/api/admin/dashboard');
}

/**
 * 从相册选的图传给后端，返回可直接使用的 /uploads/xxx 路径。
 * 用 XHR 而不是 fetch：能拿到上传进度、能设硬超时——否则大图在慢链路上会一直转圈，
 * 用户完全不知道是在传还是已经卡死。
 */
export function uploadDishImage(
  uri: string,
  mimeType?: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const fallbackName = uri.split('/').pop() || 'photo.jpg';
  const type =
    mimeType ||
    (/\.png$/i.test(fallbackName) ? 'image/png' : /\.webp$/i.test(fallbackName) ? 'image/webp' : 'image/jpeg');

  const form = new FormData();
  form.append('file', {
    uri,
    name: fallbackName,
    type,
  } as unknown as Blob);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getBaseUrl()}/api/admin/upload`);
    if (token) {
      xhr.setRequestHeader('authorization', `Bearer ${token}`);
    }
    xhr.timeout = 90000;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = event => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      };
    }

    xhr.onload = () => {
      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && json?.url) {
        onProgress?.(1);
        resolve(json.url as string);
      } else {
        reject(new ApiError(xhr.status, json?.message || `上传失败 HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, '上传失败：连不上服务器'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（90 秒），图片可能太大或网络太慢'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消'));

    xhr.send(form as unknown as any);
  });
}
