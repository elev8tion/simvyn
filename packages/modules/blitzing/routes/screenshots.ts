import type { FastifyPluginAsync } from "fastify";
import {
	errorSchema,
	screenshotsAddAssetBodySchema,
	screenshotsLocalizationBodySchema,
	screenshotsSaveBodySchema,
	screenshotsSetTrackBodySchema,
} from "../types.js";
import { callTool, mapMCPErrorToHttp } from "../service.js";

const screenshotsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: { locale: string } }>(
		"/localization",
		{ schema: { body: screenshotsLocalizationBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { locale } = req.body;
			if (!locale) return reply.status(400).send({ error: "locale is required" });
			try {
				const result = await callTool("screenshots_switch_localization", { locale });
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { sourcePath: string; fileName?: string } }>(
		"/asset",
		{ schema: { body: screenshotsAddAssetBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { sourcePath, fileName } = req.body;
			if (!sourcePath) return reply.status(400).send({ error: "sourcePath is required" });
			try {
				const args: Record<string, unknown> = { sourcePath };
				if (fileName !== undefined) args["fileName"] = fileName;
				const result = await callTool("screenshots_add_asset", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{
		Body: { assetFileName: string; slotIndex: number; displayType?: string; locale?: string };
	}>(
		"/slot",
		{ schema: { body: screenshotsSetTrackBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			const { assetFileName, slotIndex, displayType, locale } = req.body;
			if (!assetFileName) return reply.status(400).send({ error: "assetFileName is required" });
			if (slotIndex === undefined || slotIndex === null) return reply.status(400).send({ error: "slotIndex is required" });
			try {
				const args: Record<string, unknown> = { assetFileName, slotIndex };
				if (displayType !== undefined) args["displayType"] = displayType;
				if (locale !== undefined) args["locale"] = locale;
				const result = await callTool("screenshots_set_track", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);

	fastify.post<{ Body: { displayType?: string; locale?: string } }>(
		"/save",
		{ schema: { body: screenshotsSaveBodySchema, response: { 400: errorSchema, 503: errorSchema, 504: errorSchema } } },
		async (req, reply) => {
			try {
				const args: Record<string, unknown> = {};
				if (req.body.displayType !== undefined) args["displayType"] = req.body.displayType;
				if (req.body.locale !== undefined) args["locale"] = req.body.locale;
				const result = await callTool("screenshots_save", args);
				return reply.send({ result });
			} catch (err) {
				const { status, body } = mapMCPErrorToHttp(err);
				return reply.status(status).send(body);
			}
		},
	);
};

export default screenshotsRoutes;
