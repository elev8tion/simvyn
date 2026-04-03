import type { FastifyPluginAsync } from "fastify";
import { errorSchema, settingsUpdateBodySchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("settings_get");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.patch<{ Body: { showCursor?: boolean; cursorSize?: number } }>(
		"/",
		{ schema: { body: settingsUpdateBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.body.showCursor !== undefined) args["showCursor"] = req.body.showCursor;
				if (req.body.cursorSize !== undefined) args["cursorSize"] = req.body.cursorSize;
				const result = await callTool("settings_update", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post(
		"/save",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("settings_save");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default settingsRoutes;
