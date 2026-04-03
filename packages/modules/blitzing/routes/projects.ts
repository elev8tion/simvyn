import type { FastifyPluginAsync } from "fastify";
import {
	errorSchema,
	projectCreateBodySchema,
	projectImportBodySchema,
	projectOpenBodySchema,
} from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("project_list");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.get(
		"/active",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("project_get_active");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { projectId: string } }>(
		"/open",
		{ schema: { body: projectOpenBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const result = await callTool("project_open", { projectId: req.body.projectId });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { name: string; type: string; platform?: string } }>(
		"/create",
		{ schema: { body: projectCreateBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = { name: req.body.name, type: req.body.type };
				if (req.body.platform) args["platform"] = req.body.platform;
				const result = await callTool("project_create", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { path: string; type: string; platform?: string } }>(
		"/import",
		{ schema: { body: projectImportBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = { path: req.body.path, type: req.body.type };
				if (req.body.platform) args["platform"] = req.body.platform;
				const result = await callTool("project_import", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.delete(
		"/active",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("project_close");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default projectsRoutes;
