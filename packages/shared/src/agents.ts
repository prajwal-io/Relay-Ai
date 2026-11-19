export const AGENT_IDS = ["codex", "opencode", "kiro", "kiro-cli", "cursor", "antigravity", "freebuff"] as const;

export type AgentId = (typeof AGENT_IDS)[number];
export type AgentSupport = "verified" | "manual" | "experimental" | "unsupported";

export interface AgentCapabilities {
  canDetectInstallation: boolean;
  canDiscoverSessions: boolean;
  canReadSessions: boolean;
  canReceiveMcp: boolean;
  canAutoConfigureMcp: boolean;
  canLaunch: boolean;
  canOpenProject: boolean;
  requiresManualSetup: boolean;
  requiresUserAuthorization: boolean;
}

export interface AgentDescriptor {
  id: AgentId;
  name: string;
  capabilities: AgentCapabilities;
  sourceSupport: AgentSupport;
  destinationSupport: AgentSupport;
  setup: string;
}

export interface AgentInstallation {
  installed: boolean;
  version?: string;
  detail?: string;
}

export interface AgentSession {
  id: string;
  agent: AgentId;
  title: string;
  projectPath?: string;
  updatedAt?: string;
}

export interface AgentSessionContent {
  sessionId: string;
  text: string;
  omittedAttachments?: number;
}

export interface AgentAdapter {
  readonly manifest: AgentDescriptor;
  detectInstallation(): Promise<AgentInstallation>;
  discoverSessions?(projectPath?: string): Promise<AgentSession[]>;
  readSession?(sessionId: string): Promise<AgentSessionContent>;
  configureMcp?(): Promise<{ configured: boolean; detail: string }>;
  launch?(projectPath: string, handoffId: string): Promise<{ launched: boolean; detail: string }>;
  openProject?(projectPath: string): Promise<{ opened: boolean; detail: string }>;
}

const unavailable = {
  canDetectInstallation: false,
  canDiscoverSessions: false,
  canReadSessions: false,
  canReceiveMcp: false,
  canAutoConfigureMcp: false,
  canLaunch: false,
  canOpenProject: false,
  requiresManualSetup: true,
  requiresUserAuthorization: true,
} satisfies AgentCapabilities;

export const AGENT_REGISTRY: readonly AgentDescriptor[] = [
  {
    id: "codex", name: "Codex",
    capabilities: { ...unavailable, canDetectInstallation: true, canDiscoverSessions: true, canReadSessions: true },
    sourceSupport: "verified", destinationSupport: "manual",
    setup: "Codex chats can be selected through the local app-server. Receiving context requires a configured Relay MCP connection.",
  },
  {
    id: "opencode", name: "OpenCode",
    capabilities: { ...unavailable, canDetectInstallation: true, canReceiveMcp: true, canAutoConfigureMcp: true, canLaunch: true, canOpenProject: true, requiresManualSetup: false },
    sourceSupport: "manual", destinationSupport: "verified",
    setup: "Relay can open the project and configure a handoff-scoped MCP server. OpenCode session history is not imported yet.",
  },
  { id: "kiro", name: "Kiro IDE", capabilities: unavailable, sourceSupport: "manual", destinationSupport: "manual", setup: "Use a reviewed transcript or Relay memory. MCP setup is manual; Relay does not configure or launch Kiro yet." },
  { id: "kiro-cli", name: "Kiro CLI", capabilities: unavailable, sourceSupport: "manual", destinationSupport: "manual", setup: "Use a reviewed transcript or Relay memory. MCP setup is manual; Relay does not configure or launch Kiro CLI yet." },
  { id: "cursor", name: "Cursor", capabilities: unavailable, sourceSupport: "manual", destinationSupport: "manual", setup: "Use a reviewed transcript or Relay memory. MCP setup is manual; Relay does not configure or launch Cursor yet." },
  { id: "antigravity", name: "Antigravity", capabilities: unavailable, sourceSupport: "manual", destinationSupport: "manual", setup: "Use a reviewed transcript or Relay memory. MCP setup is manual; Relay does not configure or launch Antigravity yet." },
  { id: "freebuff", name: "Freebuff", capabilities: unavailable, sourceSupport: "manual", destinationSupport: "manual", setup: "Use a reviewed transcript or Relay memory. Freebuff's public docs show MCP client configuration, but Relay has no tested adapter or launch integration yet." },
];

export const getAgent = (id: string) => AGENT_REGISTRY.find((agent) => agent.id === id);
