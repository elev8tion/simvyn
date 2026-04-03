import * as fs from "node:fs";
import * as os from "node:os";
import { MCPClient } from "../shared/mcp-client.js";
import { MCPError } from "../shared/types/blitzing.js";
export { MCPError };

export function getSocketPath(): string {
	const env = process.env["BLITZSOCKETPATH"];
	if (env) return env;
	const uid = process.getuid?.() ?? os.userInfo().uid;
	return `/tmp/blitz-mcp-${uid}.sock`;
}

export function socketExists(): boolean {
	return fs.existsSync(getSocketPath());
}

export async function callTool(
	toolName: string,
	args: Record<string, unknown> = {},
): Promise<string> {
	const client = new MCPClient(getSocketPath());
	try {
		await client.connect();
		return await client.call(toolName, args);
	} finally {
		client.disconnect();
	}
}

export function mapMCPErrorToHttp(err: unknown): { status: 400 | 503 | 504; body: { error: string } } {
	if (err instanceof MCPError && err.code === -32000) {
		return { status: 400, body: { error: err.message } };
	}
	if (err instanceof Error) {
		if (err.message.includes("timed out")) {
			return { status: 504, body: { error: "Blitz.app connection timed out" } };
		}
		const nodeErr = err as NodeJS.ErrnoException;
		if (nodeErr.code === "ENOENT" || nodeErr.code === "ECONNREFUSED") {
			return { status: 503, body: { error: "Blitz.app is not running" } };
		}
	}
	return { status: 503, body: { error: "Blitz.app is not running" } };
}
