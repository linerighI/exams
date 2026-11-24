/**
 * GitHub Plain-Text Tunnel Registry & Automatic Server Self-Healing for App #2.
 * Fetches the active Cloudflare Tunnel URL from `linerighI/exams` (`schoolsync/tunnel-url.txt`)
 * so Windows WebView2, Capacitor Android, and GitHub Pages clients follow server restarts automatically.
 */
export const DEFAULT_REGISTRY = {
  owner: 'linerighI',
  repo: 'exams',
  branch: 'master',
  filePath: 'schoolsync/tunnel-url.txt',
};

export const SERVER_URL_KEY = 'schoolsync-server-url';
export const REGISTRY_URL_KEY = 'schoolsync-registry-url';
export const AUTO_DISCOVER_KEY = 'schoolsync-auto-discover';
export const LAST_SYNC_AT_KEY = 'schoolsync-last-sync-at';
export const SERVER_UPDATED_EVENT = 'schoolsync-server-updated';

export interface DiscoveryProbeResult {
  ok: boolean;
  schoolName: string;
  tunnelUrl: string | null;
  demo: boolean;
  url: string;
}

export interface DiscoveryOutcome {
  ok: boolean;
  switched: boolean;
  url?: string;
  probe?: DiscoveryProbeResult;
  reason?: string;
}

let inflightDiscovery: Promise<DiscoveryOutcome> | null = null;
let lastDiscoveryAttemptAt = 0;

/** Detect whether the app is running inside the Capacitor native Android runtime. */
export function isCapacitorNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Detect whether the app is running inside the Windows WebView2 Desktop Client shell. */
export function isDesktopWebView2(): boolean {
  const win = window as unknown as { __SCHOOLSYNC_DESKTOP__?: boolean };
  return Boolean(win.__SCHOOLSYNC_DESKTOP__) || location.hostname === 'app.schoolsync.invalid';
}

/** Detect whether this client runs standalone (not directly hosted on the school PC Fastify origin). */
export function isStandaloneClient(): boolean {
  return (
    isCapacitorNative() ||
    isDesktopWebView2() ||
    location.hostname.endsWith('.github.io') ||
    location.protocol === 'file:'
  );
}

/** Return true unless the user explicitly disabled automatic GitHub tunnel discovery. */
export function getAutoDiscoverEnabled(): boolean {
  return localStorage.getItem(AUTO_DISCOVER_KEY) !== 'false';
}

/** Persist the automatic GitHub tunnel discovery preference. */
export function setAutoDiscoverEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_DISCOVER_KEY, enabled ? 'true' : 'false');
}

/** Return any custom plain-text registry URL override, or empty string to use the default GitHub repo. */
export function getCustomRegistryUrl(): string {
  return (localStorage.getItem(REGISTRY_URL_KEY) || '').trim();
}

/** Persist or clear a custom plain-text registry URL override. */
export function setCustomRegistryUrl(url: string): void {
  const clean = url.trim();
  if (clean) localStorage.setItem(REGISTRY_URL_KEY, clean);
  else localStorage.removeItem(REGISTRY_URL_KEY);
}

/** Human-readable registry descriptor for the Connection Orb dialog. */
export function getRegistryLabel(): string {
  return (
    getCustomRegistryUrl() ||
    `${DEFAULT_REGISTRY.owner}/${DEFAULT_REGISTRY.repo} (${DEFAULT_REGISTRY.branch}) · ${DEFAULT_REGISTRY.filePath}`
  );
}

/** Return ISO timestamp of the last successful GitHub URL discovery, if any. */
export function getLastSyncAt(): string {
  return localStorage.getItem(LAST_SYNC_AT_KEY) || '';
}

/** Extract the first valid `http(s)://...` server URL from plain text, ignoring `#` comments. */
export function parseTunnelUrlFromText(text: string): string {
  if (!text) return '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(https?:\/\/[^\s#]+)/i);
    if (!match) continue;
    try {
      const parsed = new URL(match[1]);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin + parsed.pathname.replace(/\/+$/, '');
      }
    } catch {
      // Ignore invalid URL lines.
    }
  }
  return '';
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the active tunnel URL from GitHub (`raw.githubusercontent.com` first for speed,
 * falling back to `api.github.com/repos/.../contents/...` to bypass raw CDN cache).
 */
export async function fetchRegistryTunnelUrl({
  bypassCdn = false,
}: { bypassCdn?: boolean } = {}): Promise<string> {
  const custom = getCustomRegistryUrl();
  if (custom) {
    try {
      const sep = custom.includes('?') ? '&' : '?';
      const res = await fetchWithTimeout(`${custom}${sep}t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) return parseTunnelUrlFromText(await res.text());
    } catch {
      return '';
    }
    return '';
  }

  const { owner, repo, branch, filePath } = DEFAULT_REGISTRY;
  if (!bypassCdn) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}?t=${Date.now()}`;
      const res = await fetchWithTimeout(rawUrl, { cache: 'no-store' });
      if (res.ok) {
        const parsed = parseTunnelUrlFromText(await res.text());
        if (parsed) return parsed;
      }
    } catch {
      // Fall back to GitHub Contents API below.
    }
  }

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetchWithTimeout(apiUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return '';
    const json = (await res.json()) as { content?: string };
    if (typeof json?.content !== 'string') return '';
    return parseTunnelUrlFromText(decodeBase64Utf8(json.content));
  } catch {
    return '';
  }
}

async function defaultProbeCandidate(candidateUrl: string): Promise<DiscoveryProbeResult> {
  const clean = candidateUrl.trim().replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${clean}/api/config`, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'X-SchoolSync-Client': 'capacitor',
    },
  }, 5000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { schoolName?: string; tunnelUrl?: string | null; demo?: boolean };
  return {
    ok: true,
    schoolName: body.schoolName || 'مدرسة محمد الشريقي الثانوية للبنين',
    tunnelUrl: body.tunnelUrl || null,
    demo: Boolean(body.demo),
    url: clean,
  };
}

/**
 * Look up the active server URL from GitHub, verify `/api/config`, persist it in
 * `localStorage`, and notify active hooks/WebSockets to switch seamlessly.
 */
export async function discoverAndSwitchServer(options: {
  force?: boolean;
  forceBypassCdn?: boolean;
  currentUrl?: string;
  probeFn?: (url: string) => Promise<DiscoveryProbeResult>;
  onSwitched?: (url: string, probe: DiscoveryProbeResult) => void;
} = {}): Promise<DiscoveryOutcome> {
  const { force = false, forceBypassCdn = false, currentUrl = '', probeFn, onSwitched } = options;

  if (!force && !getAutoDiscoverEnabled()) {
    return { ok: false, switched: false, reason: 'disabled' };
  }
  if (!force && inflightDiscovery) return inflightDiscovery;
  if (!force && Date.now() - lastDiscoveryAttemptAt < 8000) {
    return { ok: false, switched: false, reason: 'cooldown' };
  }

  lastDiscoveryAttemptAt = Date.now();
  const task = (async (): Promise<DiscoveryOutcome> => {
    const currentClean = currentUrl.trim().replace(/\/+$/, '');
    let candidate = await fetchRegistryTunnelUrl({ bypassCdn: forceBypassCdn });
    if (!forceBypassCdn && (!candidate || (currentClean && candidate === currentClean))) {
      const fresh = await fetchRegistryTunnelUrl({ bypassCdn: true });
      if (fresh) candidate = fresh;
    }
    if (!candidate) {
      return { ok: false, switched: false, reason: 'no-url' };
    }

    try {
      const probe = await (probeFn || defaultProbeCandidate)(candidate);
      localStorage.setItem(SERVER_URL_KEY, candidate);
      localStorage.setItem(LAST_SYNC_AT_KEY, new Date().toISOString());
      onSwitched?.(candidate, probe);
      window.dispatchEvent(
        new CustomEvent(SERVER_UPDATED_EVENT, { detail: { url: candidate, probe } }),
      );
      return {
        ok: true,
        switched: candidate !== currentClean,
        url: candidate,
        probe,
      };
    } catch {
      return { ok: false, switched: false, url: candidate, reason: 'unreachable' };
    }
  })();

  if (!force) {
    inflightDiscovery = task;
    task.finally(() => {
      if (inflightDiscovery === task) inflightDiscovery = null;
    });
  }
  return task;
}
