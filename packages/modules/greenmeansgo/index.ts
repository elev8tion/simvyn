import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { SubprocessError } from "../shared/subprocess.js";
import {
	runCodescan,
	runIPAScan,
	runPrivacyScan,
	runPreflight,
} from "./service.js";
import {
	codescanBodySchema,
	errorSchema,
	preflightBodySchema,
	privacyBodySchema,
	scanResultSchema,
} from "./types.js";

function classifySubprocessError(err: SubprocessError): {
	status: 500 | 503 | 504;
	body: { error: string; detail?: string };
} {
	if (err.exitCode === null) {
		if (err.message.includes("timed out")) {
			return { status: 504, body: { error: "Scan timed out" } };
		}
		return {
			status: 503,
			body: { error: "green-means-go binary not available" },
		};
	}
	return {
		status: 500,
		body: { error: "Scanner error", detail: err.stderr },
	};
}

export const greenmeansgoPlugin: FastifyPluginAsync = async (
	fastify,
	_opts,
) => {
	await fastify.register(multipart);

	fastify.post<{ Body: { sourcePath: string } }>(
		"/codescan",
		{
			schema: {
				body: codescanBodySchema,
				response: {
					200: scanResultSchema,
					400: errorSchema,
					500: errorSchema,
					503: errorSchema,
					504: errorSchema,
				},
			},
		},
		async (req, reply) => {
			const { sourcePath } = req.body;
			if (!sourcePath) {
				return reply.status(400).send({ error: "sourcePath is required" });
			}
			try {
				const result = await runCodescan(sourcePath);
				return reply.send(result);
			} catch (err) {
				if (err instanceof SubprocessError) {
					const { status, body } = classifySubprocessError(err);
					return reply.status(status).send(body);
				}
				throw err;
			}
		},
	);

	fastify.post(
		"/ipa",
		{
			schema: {
				response: {
					200: scanResultSchema,
					400: errorSchema,
					500: errorSchema,
					503: errorSchema,
					504: errorSchema,
				},
			},
		},
		async (req, reply) => {
			const data = await req.file();
			if (!data) {
				return reply.status(400).send({ error: "ipa file is required" });
			}
			const chunks: Buffer[] = [];
			for await (const chunk of data.file) {
				chunks.push(chunk);
			}
			const ipaBuffer = Buffer.concat(chunks);
			try {
				const result = await runIPAScan(ipaBuffer, data.filename);
				return reply.send(result);
			} catch (err) {
				if (err instanceof SubprocessError) {
					const { status, body } = classifySubprocessError(err);
					return reply.status(status).send(body);
				}
				throw err;
			}
		},
	);

	fastify.post<{ Body: { sourcePath: string } }>(
		"/privacy",
		{
			schema: {
				body: privacyBodySchema,
				response: {
					200: scanResultSchema,
					400: errorSchema,
					500: errorSchema,
					503: errorSchema,
					504: errorSchema,
				},
			},
		},
		async (req, reply) => {
			const { sourcePath } = req.body;
			if (!sourcePath) {
				return reply.status(400).send({ error: "sourcePath is required" });
			}
			try {
				const result = await runPrivacyScan(sourcePath);
				return reply.send(result);
			} catch (err) {
				if (err instanceof SubprocessError) {
					const { status, body } = classifySubprocessError(err);
					return reply.status(status).send(body);
				}
				throw err;
			}
		},
	);

	fastify.post<{ Body: { sourcePath: string; ipaPath?: string } }>(
		"/preflight",
		{
			schema: {
				body: preflightBodySchema,
				response: {
					200: scanResultSchema,
					400: errorSchema,
					500: errorSchema,
					503: errorSchema,
					504: errorSchema,
				},
			},
		},
		async (req, reply) => {
			const { sourcePath, ipaPath } = req.body;
			if (!sourcePath) {
				return reply.status(400).send({ error: "sourcePath is required" });
			}
			try {
				const result = await runPreflight(sourcePath, ipaPath);
				return reply.send(result);
			} catch (err) {
				if (err instanceof SubprocessError) {
					const { status, body } = classifySubprocessError(err);
					return reply.status(status).send(body);
				}
				throw err;
			}
		},
	);
};
