import React, { createContext, useContext, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

/**
 * Provides a shared "collapse" value to the tab bar based on scroll direction.
 * collapse.value: 0 (expanded) -> 1 (collapsed)
 */

const TabBarCtrlContext = createContext(null);

export function TabBarControllerProvider({ children }) {
  const insets = useSafeAreaInsets();
  const collapse = useSharedValue(0); // 0 expanded, 1 collapsed

  // Expose a hook factory that screens can use to wire their onScroll.
  const useCollapsibleTabBar = () => {
    const lastY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
      onBeginDrag: (e) => {
        lastY.value = e.contentOffset.y;
      },
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const dy = y - lastY.value;

        // Negative overscroll => expand
        if (y <= 0) {
          collapse.value = withTiming(0, { duration: 180 });
          lastY.value = y;
          return;
        }

        // Scroll down => collapse ; Scroll up => expand
        const THRESH = 1.5; // small threshold for stability
        if (dy > THRESH) {
          collapse.value = withTiming(1, { duration: 200 });
        } else if (dy < -THRESH) {
          collapse.value = withTiming(0, { duration: 220 });
        }

        lastY.value = y;
      },
    });

    // Extra bottom padding so content isn't hidden by the floating bar.
    const bottomInset = Math.max(insets.bottom, 12) + 70;

    return { onScroll, bottomInset };
  };

  const value = useMemo(() => ({ collapse, useCollapsibleTabBar }), []);
  return (
    <TabBarCtrlContext.Provider value={value}>{children}</TabBarCtrlContext.Provider>
  );
}

export function useTabBarController() {
  const ctx = useContext(TabBarCtrlContext);
  if (!ctx) throw new Error('useTabBarController must be used within TabBarControllerProvider');
  return ctx;
}
