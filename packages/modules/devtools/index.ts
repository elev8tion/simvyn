import * as fs from "node:fs";
import * as nodePath from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { LocalGateway } from "./gateway.js";
import { getProject, setProject, clearProject } from "./project.js";
import { runSession } from "./claude.js";
import { createSession } from "./session.js";
import type { SessionState } from "./session.js";

const gateway = new LocalGateway();
const activeSessions = new Set<WebSocket>();

export const devtoolsPlugin: FastifyPluginAsync = async (fastify, _opts) => {
	fastify.log.info(`devtools: LAN gateway at ${gateway.getPublicUrl()}`);

	// GET /project — return active project or 404
	fastify.get("/project", async (_req, reply) => {
		const project = getProject();
		if (!project) {
			return reply.status(404).send({ error: "No active project" });
		}
		return reply.send(project);
	});

	// POST /project — set active project; 400 if path doesn't exist
	fastify.post<{ Body: { name: string; path: string } }>(
		"/project",
		async (req, reply) => {
			const { name, path } = req.body ?? {};

			if (!name || !path) {
				return reply.status(400).send({ error: "name and path are required" });
			}

			try {
				const project = setProject({ name, path });
				return reply.send(project);
			} catch (err) {
				return reply
					.status(400)
					.send({ error: err instanceof Error ? err.message : "Invalid project path" });
			}
		},
	);

	// DELETE /project — clear active project and close all open WebSocket sessions
	fastify.delete("/project", async (_req, reply) => {
		clearProject();
		for (const ws of activeSessions) {
			ws.close();
		}
		activeSessions.clear();
		return reply.status(200).send({ cleared: true });
	});

	// GET /tree?depth=N — return directory tree for active project (max depth 4)
	fastify.get<{ Querystring: { depth?: string } }>("/tree", async (req, reply) => {
		const project = getProject();
		if (!project) {
			return reply.status(404).send({ error: "No active project" });
		}

		const maxDepth = Math.min(parseInt(req.query.depth ?? "2", 10), 4);

		interface FileNode {
			name: string;
			type: "dir" | "file";
			children?: FileNode[];
		}

		const SKIP = new Set(["node_modules", ".git", ".DS_Store", "dist", "build", ".next", ".nuxt"]);

		function readDir(dirPath: string, depth: number): FileNode[] {
			if (depth <= 0) return [];
			try {
				const entries = fs.readdirSync(dirPath, { withFileTypes: true });
				return entries
					.filter((e) => !e.name.startsWith(".") && !SKIP.has(e.name))
					.sort((a, b) => {
						if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
						return a.name.localeCompare(b.name);
					})
					.map((e) => ({
						name: e.name,
						type: e.isDirectory() ? ("dir" as const) : ("file" as const),
						children: e.isDirectory()
							? readDir(nodePath.join(dirPath, e.name), depth - 1)
							: undefined,
					}));
			} catch {
				return [];
			}
		}

		return reply.send({
			name: project.name,
			path: project.path,
			children: readDir(project.path, maxDepth),
		});
	});

	// GET /gateway — return local gateway state
	fastify.get("/gateway", async (_req, reply) => {
		return reply.send({
			running: gateway.isRunning(),
			publicUrl: gateway.getPublicUrl(),
			localPort: 3847,
		});
	});

	// WS /session — per-connection Claude Code chat session
	fastify.get("/session", { websocket: true }, (socket: WebSocket, _req) => {
		const project = getProject();

		if (!project) {
			socket.send(
				JSON.stringify({
					type: "error",
					message: "No active project — open a project in simvyn first",
				}),
			);
			socket.close();
			return;
		}

		const state: SessionState = createSession(project.path);
		activeSessions.add(socket);

		socket.send(
			JSON.stringify({
				type: "session_ready",
				project,
				gatewayUrl: gateway.getPublicUrl(),
			}),
		);

		socket.on("message", async (data: Buffer) => {
			let msg: { type: string; text?: string };
			try {
				msg = JSON.parse(data.toString());
			} catch {
				socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
				return;
			}

			if (msg.type === "interrupt") {
				state.abortController.abort();
				state.abortController = new AbortController();
				return;
			}

			if (msg.type === "prompt" && typeof msg.text === "string") {
				// Use current project path in case it changed since session opened
				const currentProject = getProject();
				const cwd = currentProject?.path ?? state.projectPath;

				// Append user message to history for conversation continuity
				state.history.push({ role: "user", content: msg.text });

				for await (const event of runSession({
					prompt: msg.text,
					cwd,
					history: state.history,
					signal: state.abortController.signal,
				})) {
					if (socket.readyState !== socket.OPEN) break;
					socket.send(JSON.stringify(event));
				}
			}
		});

		socket.on("close", () => {
			activeSessions.delete(socket);
			state.abortController.abort();
		});
	});
};
