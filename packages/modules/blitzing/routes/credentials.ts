import type { FastifyPluginAsync } from "fastify";
import { credentialsBodySchema, errorSchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const credentialsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: { issuerId: string; keyId: string; privateKeyPath: string } }>(
		"/",
		{ schema: { body: credentialsBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const result = await callTool("asc_set_credentials", {
					issuerId: req.body.issuerId,
					keyId: req.body.keyId,
					privateKeyPath: req.body.privateKeyPath,
				});
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post(
		"/web-auth",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("asc_web_auth");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default credentialsRoutes;
