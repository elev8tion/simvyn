// SDKMessage represents a message in the Claude Code SDK conversation history.
// The full type will be imported from @anthropic-ai/claude-code once claude.ts is wired up.
export type SDKMessage = Record<string, unknown>;

export interface ProjectState {
	name: string;
	path: string; // absolute path — Claude Code's cwd
	setAt: string;
}

export interface GatewayState {
	running: boolean;
	publicUrl: string | null;
	localPort: number;
}

export interface SessionState {
	projectPath: string;
	history: SDKMessage[];
	abortController: AbortController;
}

export interface ChatMessage {
	type: "prompt" | "interrupt";
	text?: string;
}

export type ToolEvent =
	| { type: "session_ready"; project: ProjectState; gatewayUrl: string | null }
	| { type: "text"; content: string; done: boolean }
	| { type: "tool_use"; tool: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool: string; output: string }
	| { type: "error"; message: string }
	| { type: "session_end" };
