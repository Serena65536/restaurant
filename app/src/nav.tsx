import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';

export type Route =
  | {name: 'menu'}
  | {name: 'setup'}
  | {name: 'ownerLogin'}
  | {name: 'customerLogin'}
  | {name: 'adminHome'}
  | {name: 'order'; orderId: number}
  | {name: 'payment'; orderId: number}
  | {name: 'paymentSuccess'; orderId: number; orderNo: string; amountCents: number; channel: string}
  | {name: 'dishList'; categoryId: number; categoryName: string}
  | {name: 'dishEdit'; categoryId: number; dishId?: number};

type NavApi = {
  route: Route;
  canGoBack: boolean;
  focusTick: number;
  push: (route: Route) => void;
  back: () => void;
  reset: (route: Route) => void;
};

const NavContext = createContext<NavApi | null>(null);

export function NavProvider({
  initial,
  children,
}: {
  initial: Route;
  children: React.ReactNode;
}): React.JSX.Element {
  const [stack, setStack] = useState<Route[]>([initial]);
  const [focusTick, setFocusTick] = useState(0);

  const push = useCallback((route: Route) => {
    setStack(prev => [...prev, route]);
    setFocusTick(t => t + 1);
  }, []);

  const back = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    setFocusTick(t => t + 1);
  }, []);

  const reset = useCallback((route: Route) => {
    setStack([route]);
    setFocusTick(t => t + 1);
  }, []);

  const value = useMemo(
    () => ({
      route: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      focusTick,
      push,
      back,
      reset,
    }),
    [stack, focusTick, push, back, reset],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavApi {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error('useNav must be used inside NavProvider');
  }
  return ctx;
}
