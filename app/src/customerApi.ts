import AsyncStorage from '@react-native-async-storage/async-storage';
import {getBaseUrl} from './api';

const TOKEN_KEY = 'restaurant.customerToken';
const PHONE_KEY = 'restaurant.customerPhone';

let token = '';
let phone = '';

export async function loadCustomerToken(): Promise<string> {
  try {
    token = (await AsyncStorage.getItem(TOKEN_KEY)) ?? '';
    phone = (await AsyncStorage.getItem(PHONE_KEY)) ?? '';
  } catch {
    token = '';
    phone = '';
  }
  return token;
}

export async function setCustomerToken(next: string, nextPhone?: string): Promise<void> {
  token = next;
  if (nextPhone) {
    phone = nextPhone;
  }
  try {
    await AsyncStorage.setItem(TOKEN_KEY, next);
    if (nextPhone) {
      await AsyncStorage.setItem(PHONE_KEY, nextPhone);
    }
  } catch {}
}

export async function clearCustomerToken(): Promise<void> {
  token = '';
  phone = '';
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(PHONE_KEY);
  } catch {}
}

export function hasCustomerToken(): boolean {
  return !!token;
}

export function getCustomerPhone(): string {
  return phone;
}

export class CustomerApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: {method?: string; body?: unknown; timeoutMs?: number} = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 12000;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
      reject(new CustomerApiError(0, '等待服务器响应超时'));
    }, timeoutMs);
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
      throw new CustomerApiError(res.status, json?.message || `HTTP ${res.status}`);
    }
    return json as T;
  } catch (err: any) {
    if (err instanceof CustomerApiError) {
      throw err;
    }
    throw new CustomerApiError(0, err?.message ?? String(err));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export type CustomerUser = {id: number; phone: string; role: string; name: string};

export async function customerLogin(
  inputPhone: string,
  password: string,
): Promise<{user: CustomerUser; created: boolean}> {
  const data = await request<{token: string; user: CustomerUser; created: boolean}>(
    '/api/auth/customer-login',
    {method: 'POST', body: {phone: inputPhone, password}},
  );
  await setCustomerToken(data.token, data.user.phone);
  return {user: data.user, created: data.created};
}

export type OrderItem = {
  id: number;
  dishId: number;
  name: string;
  image: string;
  priceCents: number;
  quantity: number;
  amountCents: number;
};

export type Order = {
  id: number;
  orderNo: string;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  totalCents: number;
  tableNo: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

export type OrderLineInput = {dishId: number; qty: number};

export async function fetchOpenOrder(): Promise<Order | null> {
  if (!token) {
    return null;
  }
  const data = await request<{order: Order | null}>('/api/orders/open');
  return data.order;
}

export async function submitOrder(
  items: OrderLineInput[],
): Promise<{order: Order; appended: boolean}> {
  return request<{order: Order; appended: boolean}>('/api/orders', {
    method: 'POST',
    body: {items},
  });
}

export async function addItemsToOrder(
  orderId: number,
  items: OrderLineInput[],
): Promise<Order> {
  const data = await request<{order: Order}>(`/api/orders/${orderId}/items`, {
    method: 'POST',
    body: {items},
  });
  return data.order;
}

export async function fetchOrder(orderId: number): Promise<Order> {
  const data = await request<{order: Order}>(`/api/orders/${orderId}`);
  return data.order;
}

export type PayChannel = 'wechat' | 'alipay';

export type Payment = {
  id: number;
  orderId: number;
  channel: PayChannel | 'mock';
  amountCents: number;
  outTradeNo: string;
  tradeNo: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  paidAt: string | null;
};

export async function createPayment(
  orderId: number,
  channel: PayChannel,
): Promise<Payment> {
  const data = await request<{payment: Payment; mode: string}>('/api/payments', {
    method: 'POST',
    body: {orderId, channel},
  });
  return data.payment;
}

/** 模拟支付平台回调（真实接入后换成微信/支付宝 notify） */
export async function confirmPayment(paymentId: number): Promise<{
  payment: Payment;
  order: {id: number; orderNo: string; status: string; paidAt: string | null};
}> {
  return request('/api/payments/' + paymentId + '/confirm', {method: 'POST'});
}
