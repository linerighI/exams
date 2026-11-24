/**
 * HTTP, HTTPS Cloud Tunnel & WebSocket transport adapter for browser/PWA sessions,
 * Windows WebView2 Desktop Clients, and Capacitor Android containers.
 */
import {
  discoverAndSwitchServer,
  getAutoDiscoverEnabled,
  isCapacitorNative,
  isDesktopWebView2,
  isStandaloneClient,
  SERVER_URL_KEY,
} from './registry';

const NATIVE_TOKEN_KEY = 'schoolsync-native-token';
const DEFAULT_NATIVE_SERVER =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ||
  'http://127.0.0.1:4320';
const TUNNEL_DOWN_STATUSES = new Set([502, 503, 521, 522, 524, 530]);

export { isCapacitorNative, isDesktopWebView2, isStandaloneClient };

export interface ServerProbeResult {
  ok: boolean;
  schoolName: string;
  tunnelUrl: string | null;
  demo: boolean;
  url: string;
}

/** Return the normalized custom server URL stored by the user, or empty string if unset. */
export function getCustomServerBase(): string {
  return (localStorage.getItem(SERVER_URL_KEY) || '').trim().replace(/\/+$/, '');
}

/** Return true if a custom remote or tunnel server URL override is configured. */
export function hasCustomServerBase(): boolean {
  return getCustomServerBase().length > 0;
}

/** Return true when bearer-token auth + CORS mode should be used instead of same-origin cookies. */
export function usesRemoteBearerAuth(): boolean {
  return isStandaloneClient() || hasCustomServerBase();
}

/** Resolve the effective API base URL (custom/discovered tunnel override, native default, or same-origin). */
export function getServerBase(): string {
  const custom = getCustomServerBase();
  if (custom) return custom;
  if (!isStandaloneClient()) return '';
  return DEFAULT_NATIVE_SERVER.replace(/\/+$/, '');
}

/** Persist or clear the user-configured or auto-discovered remote/tunnel server URL. */
export function setServerBase(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) localStorage.setItem(SERVER_URL_KEY, clean);
  else localStorage.removeItem(SERVER_URL_KEY);
}

/** Build authentication and tunnel-bypass headers for native or remote-tunnel sessions. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
  const useBearer = usesRemoteBearerAuth();
  if (!useBearer) return headers;
  const token = localStorage.getItem(NATIVE_TOKEN_KEY);
  return {
    ...headers,
    'X-SchoolSync-Client': 'capacitor',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Resolve a full `/api/...` endpoint URL against the active server base. */
export function apiUrl(path: string): string {
  return `${getServerBase()}/api${path}`;
}

/** Resolve a WebSocket `/api/...` URL against the active local or cloud tunnel server. */
export function wsUrl(path: string): string {
  const base = getServerBase();
  const origin = base ? new URL(base) : location;
  const proto = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  const useBearer = usesRemoteBearerAuth();
  const token = useBearer ? localStorage.getItem(NATIVE_TOKEN_KEY) : '';
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${proto}//${origin.host}/api${path}${suffix}`;
}

/** Probe `/api/config` on the active or candidate server URL with a 5s timeout for the Login Orb. */
export async function probeServer(candidateUrl?: string): Promise<ServerProbeResult> {
  const clean = (candidateUrl ?? getServerBase()).trim().replace(/\/+$/, '');
  const endpoint = `${clean}/api/config`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const useRemote = Boolean(clean) || isStandaloneClient();
    const res = await fetch(endpoint, {
      method: 'GET',
      credentials: useRemote ? 'omit' : 'same-origin',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...(useRemote ? { 'X-SchoolSync-Client': 'capacitor' } : {}),
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { schoolName?: string; tunnelUrl?: string | null; demo?: boolean };
    return {
      ok: true,
      schoolName: body.schoolName || 'مدرسة محمد الشريقي الثانوية للبنين',
      tunnelUrl: body.tunnelUrl || null,
      demo: Boolean(body.demo),
      url: clean || location.origin,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApiOnce(url: string, body?: unknown): Promise<Response> {
  const useBearer = usesRemoteBearerAuth();
  return fetch(apiUrl(url), {
    method: body === undefined ? 'GET' : 'POST',
    credentials: useBearer ? 'omit' : 'same-origin',
    headers: {
      ...authHeaders(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Execute an authenticated JSON request against the active SchoolSync server.
 * On standalone/remote clients, automatically checks GitHub for a rotated tunnel URL
 * and retries once if the previous Cloudflare tunnel went offline.
 */
export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  const canAutoHeal = () => usesRemoteBearerAuth() && getAutoDiscoverEnabled();
  let response: Response | undefined;
  let networkError: unknown;
  let needsHeal = false;

  try {
    response = await fetchApiOnce(url, body);
    const contentType = response.headers.get('content-type') || '';
    const isTunnelProxyError =
      response.status === 530 ||
      (TUNNEL_DOWN_STATUSES.has(response.status) && !contentType.includes('application/json'));
    if (isTunnelProxyError && canAutoHeal()) needsHeal = true;
  } catch (err) {
    if (!canAutoHeal()) throw err;
    networkError = err;
    needsHeal = true;
  }

  if (needsHeal) {
    const healed = await discoverAndSwitchServer({
      forceBypassCdn: true,
      currentUrl: getServerBase(),
    });
    if (healed.ok) {
      response = await fetchApiOnce(url, body);
    } else if (networkError) {
      throw networkError;
    }
  }

  if (!response) throw networkError || new Error('Unable to connect');

  const useBearer = usesRemoteBearerAuth();
  const result = await response.json();
  if (!response.ok) {
    if (useBearer && response.status === 401) localStorage.removeItem(NATIVE_TOKEN_KEY);
    throw Object.assign(new Error(result.error || 'Unable to connect'), {
      status: response.status,
    });
  }
  if (useBearer && result && typeof result === 'object') {
    if (typeof result.token === 'string') localStorage.setItem(NATIVE_TOKEN_KEY, result.token);
    if (url === '/logout') localStorage.removeItem(NATIVE_TOKEN_KEY);
  }
  return result;
}
