import type { FastifyPluginAsync } from "fastify";
import { createVersionBodySchema, errorSchema, selectVersionBodySchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const versionsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: { version: string } }>(
		"/select",
		{ schema: { body: selectVersionBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { version } = req.body;
			if (!version) return reply.status(400).send({ error: "version is required" });
			try {
				const result = await callTool("asc_select_version", { version });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{
		Body: {
			versionString: string;
			copyFromVersion?: string;
			copyMetadata?: boolean;
			copyReviewDetail?: boolean;
			attachBuildId?: string;
		};
	}>(
		"/",
		{ schema: { body: createVersionBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { versionString, copyFromVersion, copyMetadata, copyReviewDetail, attachBuildId } = req.body;
			if (!versionString) return reply.status(400).send({ error: "versionString is required" });
			try {
				const args: Record<string, unknown> = { versionString };
				if (copyFromVersion !== undefined) args["copyFromVersion"] = copyFromVersion;
				if (copyMetadata !== undefined) args["copyMetadata"] = copyMetadata;
				if (copyReviewDetail !== undefined) args["copyReviewDetail"] = copyReviewDetail;
				if (attachBuildId !== undefined) args["attachBuildId"] = attachBuildId;
				const result = await callTool("asc_create_version", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post(
		"/submit-preview",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("asc_open_submit_preview");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default versionsRoutes;
