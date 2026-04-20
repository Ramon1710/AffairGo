import { createContext, useContext, useMemo, useState } from 'react';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ initialRouteName = 'Landing', children }) => {
  const [stack, setStack] = useState([{ name: initialRouteName, params: undefined }]);

  const currentRoute = stack[stack.length - 1] || { name: initialRouteName, params: undefined };

  const navigation = useMemo(
    () => ({
      navigate: (name, params) => {
        setStack((previous) => [...previous, { name, params }]);
      },
      goBack: () => {
        setStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
      },
      reset: ({ routes, index = 0 }) => {
        const nextRoutes = (routes || []).map((route) => ({ name: route.name, params: route.params }));
        if (!nextRoutes.length) {
          return;
        }
        const safeIndex = Math.min(Math.max(index, 0), nextRoutes.length - 1);
        setStack(nextRoutes.slice(0, safeIndex + 1));
      },
      replace: (name, params) => {
        setStack((previous) => {
          if (!previous.length) {
            return [{ name, params }];
          }
          return [...previous.slice(0, -1), { name, params }];
        });
      },
    }),
    []
  );

  const value = useMemo(() => ({ navigation, route: currentRoute }), [navigation, currentRoute]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.navigation;
};

export const useRoute = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useRoute muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.route;
};

export const useCurrentRoute = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useCurrentRoute muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.route;
};