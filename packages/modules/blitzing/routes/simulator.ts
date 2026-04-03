import type { FastifyPluginAsync } from "fastify";
import { errorSchema, simulatorSelectBodySchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const simulatorRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/devices",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("simulator_list_devices");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { udid: string } }>(
		"/select",
		{ schema: { body: simulatorSelectBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const result = await callTool("simulator_select_device", { udid: req.body.udid });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default simulatorRoutes;
