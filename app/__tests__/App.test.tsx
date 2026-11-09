/**
 * 无真机时的冒烟测试：确认 App 能从「未配置地址」走到「点餐页」，
 * 并把后端返回的分区 / 菜名渲染出来。
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({didCancel: true})),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const api = {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    clear: async () => {
      store.clear();
    },
    getAllKeys: async () => Array.from(store.keys()),
  };
  return {__esModule: true, default: api, ...api};
});

const MENU = {
  categories: [
    {
      id: 1,
      name: '热菜',
      dishes: [
        {
          id: 1,
          name: '宫保鸡丁',
          image: '',
          priceCents: 3800,
          description: '鸡腿肉、花生米',
          available: true,
        },
      ],
    },
    {id: 2, name: '凉菜', dishes: []},
  ],
};

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) {
      return;
    }
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.children) {
      n.children.forEach(walk);
    }
  };
  walk(node);
  return out;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('App', () => {
  it('没配置服务器地址时停在设置页，并要求选择身份', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ok: true, dishes: 1}),
    })) as unknown as typeof fetch;

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<App />);
    });
    const texts = textsOf(tree!.toJSON());
    expect(texts).toContain('服务器地址');
    expect(texts).toContain('我是顾客');
    expect(texts).toContain('我是店主');
  });

  it('已配置地址时仍先停在身份选择页，并把地址带出来', async () => {
    await AsyncStorage.setItem('restaurant.apiBaseUrl', 'https://demo.trycloudflare.com');

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<App />);
    });

    const texts = textsOf(tree!.toJSON());
    expect(texts).toContain('我是顾客');
    expect(texts).toContain('我是店主');
    expect(texts).not.toContain('热菜');

    const input = tree!.root.findAllByProps({testID: 'server-url'})[0];
    expect(input.props.value).toBe('https://demo.trycloudflare.com');
  });

  it('没登录时选「我是顾客」先去手机号登录', async () => {
    await AsyncStorage.setItem('restaurant.apiBaseUrl', 'https://demo.trycloudflare.com');
    global.fetch = jest.fn(async (url: any) => {
      const body = String(url).includes('/api/orders/open') ? {order: null} : {ok: true, dishes: 1};
      return {ok: true, status: 200, text: async () => JSON.stringify(body)};
    }) as unknown as typeof fetch;

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<App />);
    });

    const button = tree!.root.findAllByProps({testID: 'role-customer'})[0];
    await act(async () => {
      button.props.onPress();
      await new Promise(r => setTimeout(r, 0));
    });

    const texts = textsOf(tree!.toJSON());
    expect(texts).toContain('手机号登录');
    expect(texts).toContain('登录 / 注册');
  });

  it('已登录的顾客选「我是顾客」直接进点餐页并渲染菜单', async () => {
    await AsyncStorage.setItem('restaurant.apiBaseUrl', 'https://demo.trycloudflare.com');
    await AsyncStorage.setItem('restaurant.customerToken', 'fake-token');
    global.fetch = jest.fn(async (url: any) => {
      const path = String(url);
      const body = path.includes('/api/menu')
        ? MENU
        : path.includes('/api/orders/open')
        ? {order: null}
        : {ok: true, dishes: 1};
      return {ok: true, status: 200, text: async () => JSON.stringify(body)};
    }) as unknown as typeof fetch;

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<App />);
    });

    const button = tree!.root.findAllByProps({testID: 'role-customer'})[0];
    await act(async () => {
      button.props.onPress();
      await new Promise(r => setTimeout(r, 0));
    });

    const texts = textsOf(tree!.toJSON());
    expect(texts).toContain('热菜');
    expect(texts).toContain('宫保鸡丁');
    expect(texts).toContain('凉菜');
  });
});
