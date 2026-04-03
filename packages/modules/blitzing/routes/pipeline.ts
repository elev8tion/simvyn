import type { FastifyPluginAsync } from "fastify";
import { buildBodySchema, buildSigningBodySchema, buildUploadBodySchema, errorSchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const pipelineRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: { teamId?: string } }>(
		"/signing",
		{ schema: { body: buildSigningBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.body.teamId !== undefined) args["teamId"] = req.body.teamId;
				const result = await callTool("app_store_setup_signing", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { scheme?: string; configuration?: string } }>(
		"/",
		{ schema: { body: buildBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.body.scheme !== undefined) args["scheme"] = req.body.scheme;
				if (req.body.configuration !== undefined) args["configuration"] = req.body.configuration;
				const result = await callTool("app_store_build", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { ipaPath?: string; skipPolling?: boolean } }>(
		"/upload",
		{ schema: { body: buildUploadBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.body.ipaPath !== undefined) args["ipaPath"] = req.body.ipaPath;
				if (req.body.skipPolling !== undefined) args["skipPolling"] = req.body.skipPolling;
				const result = await callTool("app_store_upload", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default pipelineRoutes;
