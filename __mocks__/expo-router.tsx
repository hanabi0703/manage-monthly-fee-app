import { useEffect } from "react";

/**
 * Manual jest mock for expo-router, used by component tests
 * (app/**\/__tests__). Real navigation isn't under test here — screens are
 * rendered standalone, so this just gives each hook test-friendly behavior:
 * useFocusEffect runs like a mount effect, and the router/search-params
 * hooks are jest.fn()s/plain objects a test can inspect or override.
 */

export const __router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
};

let params: Record<string, string | undefined> = {};

export function __setParams(next: Record<string, string | undefined>) {
  params = next;
}

export function __resetRouterMock() {
  __router.push.mockClear();
  __router.replace.mockClear();
  __router.back.mockClear();
  __router.setParams.mockClear();
  params = {};
}

export function useRouter() {
  return __router;
}

export function useLocalSearchParams() {
  return params;
}

export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(() => callback(), [callback]);
}

export const Stack = {
  Screen: () => null,
};
