import type { SDKMessage } from "./types.js";

export interface SessionState {
	projectPath: string;
	history: SDKMessage[];
	abortController: AbortController;
}

export function createSession(projectPath: string): SessionState {
	return {
		projectPath,
		history: [],
		abortController: new AbortController(),
	};
}
