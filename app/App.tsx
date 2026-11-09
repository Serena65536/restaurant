import React, {useEffect, useState} from 'react';
import {ActivityIndicator, AppState, BackHandler, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {getBaseUrl, loadStoredBaseUrl} from './src/api';
import {loadOwnerToken} from './src/adminApi';
import {hasCustomerToken, loadCustomerToken} from './src/customerApi';
import {CartProvider} from './src/cart';
import {NavProvider, useNav} from './src/nav';
import type {Route} from './src/nav';
import {AdminHomeScreen} from './src/screens/AdminHomeScreen';
import {CustomerLoginScreen} from './src/screens/CustomerLoginScreen';
import {DishEditScreen} from './src/screens/DishEditScreen';
import {DishListScreen} from './src/screens/DishListScreen';
import {MenuScreen} from './src/screens/MenuScreen';
import {OrderScreen} from './src/screens/OrderScreen';
import {OwnerLoginScreen} from './src/screens/OwnerLoginScreen';
import {PaymentScreen} from './src/screens/PaymentScreen';
import {PaymentSuccessScreen} from './src/screens/PaymentSuccessScreen';
import {SetupScreen} from './src/screens/SetupScreen';
import {colors} from './src/theme';

function AppShell(): React.JSX.Element {
  const nav = useNav();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (nav.canGoBack) {
        nav.back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [nav]);

  switch (nav.route.name) {
    case 'setup':
      return (
        <SetupScreen
          initialUrl={getBaseUrl()}
          onConnected={role => {
            if (role === 'owner') {
              nav.reset({name: 'ownerLogin'});
            } else {
              nav.reset(hasCustomerToken() ? {name: 'menu'} : {name: 'customerLogin'});
            }
          }}
        />
      );
    case 'customerLogin':
      return <CustomerLoginScreen />;
    case 'order':
      return <OrderScreen orderId={nav.route.orderId} />;
    case 'payment':
      return <PaymentScreen orderId={nav.route.orderId} />;
    case 'paymentSuccess':
      return (
        <PaymentSuccessScreen
          orderNo={nav.route.orderNo}
          amountCents={nav.route.amountCents}
          channel={nav.route.channel}
        />
      );
    case 'ownerLogin':
      return <OwnerLoginScreen />;
    case 'adminHome':
      return <AdminHomeScreen />;
    case 'dishList':
      return (
        <DishListScreen
          categoryId={nav.route.categoryId}
          categoryName={nav.route.categoryName}
        />
      );
    case 'dishEdit':
      return (
        <DishEditScreen categoryId={nav.route.categoryId} dishId={nav.route.dishId} />
      );
    case 'menu':
    default:
      return <MenuScreen onOpenSettings={() => nav.push({name: 'setup'})} />;
  }
}

export default function App(): React.JSX.Element {
  const [booting, setBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<Route>({name: 'setup'});
  // 换 key 会让 NavProvider 整个重挂载，等于回到初始路由
  const [navKey, setNavKey] = useState(0);

  useEffect(() => {
    let alive = true;
    // 本地存储万一卡住，2.5 秒后也要往前走
    const fallback = new Promise<string>(resolve => setTimeout(() => resolve(''), 2500));
    Promise.race([loadStoredBaseUrl().catch(() => ''), fallback])
      .then(async () => {
        // 先把两边登录态都读出来，选身份时才知道该不该要求登录
        await Promise.all([loadOwnerToken().catch(() => ''), loadCustomerToken().catch(() => '')]);
        if (!alive) {
          return;
        }
        // 每次冷启动都先回到身份选择页：地址会被带出来，只需再点一次身份
        setInitialRoute({name: 'setup'});
      })
      .catch(() => alive && setInitialRoute({name: 'setup'}))
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, []);

  // 有些机型从后台切回来进程没死，等于"重新进入"却停在原页面；
  // 离开超过 60 秒就重新回到身份选择（选图之类几秒钟的操作不受影响）。
  useEffect(() => {
    let backgroundAt = 0;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        backgroundAt = Date.now();
        return;
      }
      if (next === 'active' && backgroundAt && Date.now() - backgroundAt > 60000) {
        setNavKey(k => k + 1);
      }
      if (next === 'active') {
        backgroundAt = 0;
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      {booting ? (
        <View style={styles.booting}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <CartProvider>
          <NavProvider key={navKey} initial={initialRoute}>
            <AppShell />
          </NavProvider>
        </CartProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  booting: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
});
