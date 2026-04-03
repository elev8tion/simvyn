/// <reference path="./claude-code.d.ts" />
import { query } from "@anthropic-ai/claude-code";
import type { SDKMessage } from "./types.js";

export type MappedEvent =
	| { type: "text"; content: string; done: boolean }
	| { type: "tool_use"; tool: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool: string; output: string }
	| { type: "error"; message: string }
	| { type: "session_end" };

export async function* runSession(opts: {
	prompt: string;
	cwd: string;
	history: SDKMessage[];
	signal: AbortSignal;
}): AsyncGenerator<MappedEvent> {
	try {
		for await (const event of query({
			prompt: opts.prompt,
			cwd: opts.cwd,
			abortController: { signal: opts.signal },
			options: { maxTurns: parseInt(process.env["DEVTOOLS_MAX_TURNS"] ?? "10") },
			messages: opts.history,
		})) {
			if (event.type === "text") {
				yield { type: "text", content: event.content ?? "", done: false };
			} else if (event.type === "tool_use") {
				yield { type: "tool_use", tool: event.name ?? "", input: event.input ?? {} };
			} else if (event.type === "tool_result") {
				yield { type: "tool_result", tool: event.name ?? "", output: event.output ?? "" };
			}
		}
		yield { type: "text", content: "", done: true };
		yield { type: "session_end" };
	} catch (err) {
		yield { type: "error", message: err instanceof Error ? err.message : String(err) };
	}
}
