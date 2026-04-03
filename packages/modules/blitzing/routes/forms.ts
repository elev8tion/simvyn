import type { FastifyPluginAsync } from "fastify";
import { errorSchema, fillFormBodySchema, localizationBodySchema } from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const formsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: { tab: string; locale?: string; fields: Record<string, string> } }>(
		"/fill",
		{ schema: { body: fillFormBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { tab, locale, fields } = req.body;
			if (!tab) return reply.status(400).send({ error: "tab is required" });
			if (!fields) return reply.status(400).send({ error: "fields is required" });
			try {
				const args: Record<string, unknown> = { tab, fields };
				if (locale) args["locale"] = locale;
				const result = await callTool("asc_fill_form", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { locale: string } }>(
		"/localization",
		{ schema: { body: localizationBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { locale } = req.body;
			if (!locale) return reply.status(400).send({ error: "locale is required" });
			try {
				const result = await callTool("store_listing_switch_localization", { locale });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default formsRoutes;
