import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useAffairGo } from '../context/AffairGoContext';

const NavigationContext = createContext(null);
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

const ROUTE_PATHS = {
  Landing: '/',
  Login: '/login',
  Register: '/registrierung',
  Onboarding: '/onboarding',
  Dashboard: '/dashboard',
  Profil: '/profil',
  MatchingMap: '/matching-map',
  Swipe: '/swipe',
  Chat: '/chat',
  Event: '/event',
  Explore: '/explore',
  TravelPlanner: '/reiseplaner',
};

const PATH_TO_ROUTE = {
  '/': 'Landing',
  '/landing': 'Landing',
  '/login': 'Login',
  '/register': 'Register',
  '/registration': 'Register',
  '/registrierung': 'Register',
  '/onboarding': 'Onboarding',
  '/dashboard': 'Dashboard',
  '/profil': 'Profil',
  '/profile': 'Profil',
  '/matching-map': 'MatchingMap',
  '/swipe': 'Swipe',
  '/chat': 'Chat',
  '/event': 'Event',
  '/explore': 'Explore',
  '/travel-planner': 'TravelPlanner',
  '/reiseplaner': 'TravelPlanner',
};

const normalizePathname = (pathname = '/') => {
  const compactPathname = String(pathname).trim() || '/';
  const withLeadingSlash = compactPathname.startsWith('/') ? compactPathname : `/${compactPathname}`;
  const normalized = withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '');

  return normalized ? normalized.toLowerCase() : '/';
};

const serializeRouteParam = (value) => {
  if (typeof value === 'number') {
    return `n:${value}`;
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return `j:${JSON.stringify(value)}`;
};

const deserializeRouteParam = (value) => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value.startsWith('n:')) {
    const parsedNumber = Number(value.slice(2));
    return Number.isNaN(parsedNumber) ? value : parsedNumber;
  }

  if (value.startsWith('j:')) {
    try {
      return JSON.parse(value.slice(2));
    } catch {
      return value;
    }
  }

  return value;
};

const getSearchFromParams = (params) => {
  if (!params || typeof params !== 'object') {
    return '';
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        searchParams.append(key, serializeRouteParam(entry));
      });
      return;
    }

    searchParams.set(key, serializeRouteParam(value));
  });

  const search = searchParams.toString();
  return search ? `?${search}` : '';
};

const getParamsFromSearch = (search) => {
  if (!search) {
    return undefined;
  }

  const searchParams = new URLSearchParams(search);
  const params = {};

  searchParams.forEach((value, key) => {
    const parsedValue = deserializeRouteParam(value);

    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const currentValue = params[key];
      params[key] = Array.isArray(currentValue) ? [...currentValue, parsedValue] : [currentValue, parsedValue];
      return;
    }

    params[key] = parsedValue;
  });

  return Object.keys(params).length ? params : undefined;
};

const getRouteUrl = (route) => {
  const pathname = ROUTE_PATHS[route?.name] || '/';
  return `${pathname}${getSearchFromParams(route?.params)}`;
};

const getRouteFromLocation = (initialRouteName) => {
  if (!isWeb) {
    return { name: initialRouteName, params: undefined };
  }

  const pathname = normalizePathname(window.location.pathname);

  return {
    name: PATH_TO_ROUTE[pathname] || initialRouteName,
    params: getParamsFromSearch(window.location.search),
  };
};

export const NavigationProvider = ({ initialRouteName = 'Landing', children }) => {
  const [stack, setStack] = useState(() => [getRouteFromLocation(initialRouteName)]);
  const stackRef = useRef(stack);
  const pendingHistoryActionRef = useRef('replace');
  const { isAuthenticated } = useAffairGo();

  const currentRoute = stack[stack.length - 1] || { name: initialRouteName, params: undefined };

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }

    const syncRouteFromBrowser = () => {
      pendingHistoryActionRef.current = 'pop';
      setStack([getRouteFromLocation(initialRouteName)]);
    };

    window.addEventListener('popstate', syncRouteFromBrowser);

    return () => {
      window.removeEventListener('popstate', syncRouteFromBrowser);
    };
  }, [initialRouteName]);

  useEffect(() => {
    if (!isWeb) {
      return;
    }

    const nextUrl = getRouteUrl(currentRoute);
    const currentUrl = `${normalizePathname(window.location.pathname)}${window.location.search || ''}`;

    if (currentUrl === nextUrl) {
      pendingHistoryActionRef.current = 'replace';
      return;
    }

    if (pendingHistoryActionRef.current === 'push') {
      window.history.pushState({ route: currentRoute }, '', nextUrl);
    } else {
      window.history.replaceState({ route: currentRoute }, '', nextUrl);
    }

    pendingHistoryActionRef.current = 'replace';
  }, [currentRoute]);

  const getAuthenticatedBackStack = (currentStack) => {
    const dashboardIndex = currentStack.findIndex((route) => route.name === 'Dashboard');

    if (dashboardIndex >= 0) {
      return currentStack.slice(0, dashboardIndex + 1);
    }

    return [{ name: 'Dashboard', params: undefined }];
  };

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const currentStack = stackRef.current;
      const currentTopRoute = currentStack[currentStack.length - 1]?.name;

      if (isAuthenticated) {
        if (currentTopRoute !== 'Dashboard' || currentStack.length !== 1) {
          setStack(getAuthenticatedBackStack(currentStack));
        }
        return true;
      }

      if (currentStack.length > 1) {
        setStack((previous) => previous.slice(0, -1));
      }

      return true;
    });

    return () => {
      backSubscription.remove();
    };
  }, [isAuthenticated]);

  const navigation = useMemo(
    () => ({
      navigate: (name, params) => {
        pendingHistoryActionRef.current = 'push';
        setStack((previous) => [...previous, { name, params }]);
      },
      canGoBack: () => stack.length > 1,
      goBack: () => {
        pendingHistoryActionRef.current = 'replace';
        setStack((previous) => {
          if (isAuthenticated) {
            return getAuthenticatedBackStack(previous);
          }

          return previous.length > 1 ? previous.slice(0, -1) : previous;
        });
      },
      reset: ({ routes, index = 0 }) => {
        const nextRoutes = (routes || []).map((route) => ({ name: route.name, params: route.params }));
        if (!nextRoutes.length) {
          return;
        }
        const safeIndex = Math.min(Math.max(index, 0), nextRoutes.length - 1);
        pendingHistoryActionRef.current = 'replace';
        setStack(nextRoutes.slice(0, safeIndex + 1));
      },
      replace: (name, params) => {
        pendingHistoryActionRef.current = 'replace';
        setStack((previous) => {
          if (!previous.length) {
            return [{ name, params }];
          }
          return [...previous.slice(0, -1), { name, params }];
        });
      },
    }),
    [isAuthenticated, stack.length]
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