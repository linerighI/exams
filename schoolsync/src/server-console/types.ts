/**
 * TypeScript contracts for the SchoolSync Server Console Daemon (`/api/console/*`).
 */
export interface ConsoleLogEntry {
  ts: string;
  source: 'server' | 'tunnel' | 'git' | 'db' | string;
  level: 'info' | 'warn' | 'error' | string;
  message: string;
}

export interface ConsoleConfig {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubFilePath: string;
  hasGithubToken: boolean;
  githubTokenPreview: string;
  tokenSource: 'config' | 'env' | 'none';
  autoSyncToGitHub: boolean;
  useLocalGitFallback: boolean;
  driftCheckSeconds: number;
  autoStartServer: boolean;
  autoStartTunnel: boolean;
  tunnelProvider: 'cloudflared' | 'ngrok';
  serverPort: number;
}

export interface ConsoleBackupItem {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ConsoleStatus {
  server: {
    running: boolean;
    pid: number | null;
    port: number;
    startedAt: string | null;
    lastExitCode: number | null;
    localUrl: string;
    lanUrls: string[];
  };
  tunnel: {
    running: boolean;
    pid: number | null;
    provider: 'cloudflared' | 'ngrok';
    port: number;
    url: string | null;
    startedAt: string | null;
    binaryFound: boolean;
    binaryPath: string;
    lastError: string | null;
  };
  gitSync: {
    syncing: boolean;
    lastSyncAt: string | null;
    lastResult: {
      ok: boolean;
      method: string;
      changed?: boolean;
      url?: string;
      syncedAt?: string;
      error?: string;
    } | null;
    remoteUrl: string | null;
    remoteCheckedAt: string | null;
    inSync: boolean;
    error: string | null;
  };
  config: ConsoleConfig;
  db: {
    path: string;
    exists: boolean;
    sizeBytes: number;
    updatedAt: string | null;
    schoolName: string | null;
    counts: {
      students: number;
      teachers: number;
      classes: number;
      subjects: number;
      lessons: number;
      announcements: number;
      sessions: number;
    };
    backups: ConsoleBackupItem[];
  };
  logs: ConsoleLogEntry[];
}
