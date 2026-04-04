import { spawn } from "node:child_process";
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
	// Build prompt with history context prepended
	let fullPrompt = opts.prompt;
	if (opts.history.length > 1) {
		const historyLines = opts.history
			.slice(0, -1) // exclude the current message (already in prompt)
			.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
			.join("\n");
		fullPrompt = `Prior conversation context:\n${historyLines}\n\nCurrent message: ${opts.prompt}`;
	}

	const proc = spawn(
		"claude",
		["-p", fullPrompt, "--output-format", "stream-json", "--verbose", "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep"],
		{
			cwd: opts.cwd,
			env: { ...process.env },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	if (opts.signal.aborted) {
		proc.kill("SIGTERM");
		return;
	}

	const onAbort = () => proc.kill("SIGTERM");
	opts.signal.addEventListener("abort", onAbort, { once: true });

	try {
		// Drain stderr concurrently so the pipe buffer never fills and deadlocks stdout.
		const stderrChunks: Buffer[] = [];
		proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		let buffer = "";

		for await (const chunk of proc.stdout!) {
			buffer += (chunk as Buffer).toString("utf8");
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				let event: Record<string, unknown>;
				try {
					event = JSON.parse(trimmed);
				} catch {
					continue;
				}

				if (event["type"] === "assistant") {
					const msg = event["message"] as { content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }> } | undefined;
					for (const block of msg?.content ?? []) {
						if (block.type === "text" && block.text) {
							yield { type: "text", content: block.text, done: false };
						} else if (block.type === "tool_use") {
							yield { type: "tool_use", tool: block.name ?? "", input: block.input ?? {} };
						}
					}
				} else if (event["type"] === "result") {
					// Final result — signal done
					yield { type: "text", content: "", done: true };
					yield { type: "session_end" };
				}
			}
		}

		const exitCode = await new Promise<number>((resolve) => {
			proc.on("close", resolve);
		});

		if (exitCode !== 0 && !opts.signal.aborted) {
			const errMsg = Buffer.concat(stderrChunks).toString("utf8").trim();
			yield { type: "error", message: errMsg || `claude exited with code ${exitCode}` };
		}
	} catch (err) {
		if (!opts.signal.aborted) {
			yield { type: "error", message: err instanceof Error ? err.message : String(err) };
		}
	} finally {
		opts.signal.removeEventListener("abort", onAbort);
	}
}
