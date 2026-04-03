import type { FastifyPluginAsync } from "fastify";
import { appPriceBodySchema, errorSchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const monetizationRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post(
		"/iap",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("asc_create_iap");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post(
		"/subscription",
		{ schema: { response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (_req, reply) => {
			try {
				const result = await callTool("asc_create_subscription");
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { price: string; effectiveDate?: string } }>(
		"/price",
		{ schema: { body: appPriceBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { price, effectiveDate } = req.body;
			if (!price) return reply.status(400).send({ error: "price is required" });
			try {
				const args: Record<string, unknown> = { price };
				if (effectiveDate !== undefined) args["effectiveDate"] = effectiveDate;
				const result = await callTool("asc_set_app_price", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default monetizationRoutes;
