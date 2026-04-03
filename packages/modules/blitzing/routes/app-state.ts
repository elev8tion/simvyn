import type { FastifyPluginAsync } from "fastify";
import {
	errorSchema,
	navSwitchTabBodySchema,
	rejectionQuerySchema,
	tabBodySchema,
} from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const appStateRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/state",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("app_get_state");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.get(
		"/screenshot",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("get_blitz_screenshot");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { tab?: string } }>(
		"/tab",
		{ schema: { body: tabBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const result = await callTool("get_tab_state", req.body.tab ? { tab: req.body.tab } : {});
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.get<{ Querystring: { version?: string } }>(
		"/rejection",
		{ schema: { querystring: rejectionQuerySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.query.version) args["version"] = req.query.version;
				const result = await callTool("get_rejection_feedback", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { tab: string } }>(
		"/nav",
		{ schema: { body: navSwitchTabBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const result = await callTool("nav_switch_tab", { tab: req.body.tab });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.get(
		"/tabs",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("nav_list_tabs");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default appStateRoutes;
