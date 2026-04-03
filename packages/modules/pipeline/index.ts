import type { FastifyPluginAsync } from "fastify";
import { SubprocessError } from "../shared/subprocess.js";
import { runScanGate, runPipeline } from "./service.js";
import type { BuildOpts, ScanGateResult } from "./service.js";
import { socketExists } from "../blitzing/service.js";

export const pipelinePlugin: FastifyPluginAsync = async (fastify, _opts) => {
	fastify.post<{ Body: { sourcePath: string; ipaPath?: string } }>(
		"/scan-gate",
		async (req, reply) => {
			const { sourcePath, ipaPath } = req.body ?? {};

			if (!sourcePath) {
				return reply.status(400).send({ error: "sourcePath is required" });
			}

			try {
				const result = await runScanGate(sourcePath, ipaPath);

				if (result.gate === "blocked") {
					return reply.status(422).send(result);
				}

				return reply.send(result);
			} catch (err) {
				if (err instanceof SubprocessError) {
					if (err.exitCode === null) {
						if (err.message.includes("timed out")) {
							return reply.status(504).send({ error: "Scan timed out" });
						}
						return reply
							.status(503)
							.send({ error: "green-means-go binary not available" });
					}
					return reply
						.status(500)
						.send({ error: "Scanner error", detail: err.stderr });
				}
				throw err;
			}
		},
	);

	fastify.post<{
		Body: { sourcePath: string; ipaPath?: string; build?: BuildOpts };
	}>("/submit", async (req, reply) => {
		const { sourcePath, ipaPath, build } = req.body ?? {};

		if (!sourcePath) {
			return reply.status(400).send({ error: "sourcePath is required" });
		}

		// Run the scan gate first so we have the scan result available for all
		// error responses (503/502 must include the passing scan).
		let gateResult: ScanGateResult;
		try {
			gateResult = await runScanGate(sourcePath, ipaPath);
		} catch (err) {
			if (err instanceof SubprocessError) {
				if (err.exitCode === null) {
					if (err.message.includes("timed out")) {
						return reply.status(504).send({ error: "Scan timed out" });
					}
					return reply
						.status(503)
						.send({ error: "green-means-go binary not available" });
				}
				return reply
					.status(500)
					.send({ error: "Scanner error", detail: err.stderr });
			}
			throw err;
		}

		if (gateResult.gate === "blocked") {
			return reply.status(422).send({
				gate: "blocked",
				scan: gateResult.scan,
				message: "Submission blocked: resolve critical findings first",
			});
		}

		// Scan passed — attempt the full build pipeline.
		try {
			const result = await runPipeline({ sourcePath, ipaPath, build });
			if (result.gate === "blocked") {
				return reply.status(422).send({
					gate: "blocked",
					scan: result.scan,
					message: "Submission blocked: resolve critical findings first",
				});
			}
			return reply.send(result);
		} catch (err) {
			if (!socketExists()) {
				return reply.status(503).send({
					gate: "passed",
					scan: gateResult.scan,
					error: "Blitz.app is not running — scan passed but build could not start",
				});
			}
			return reply.status(502).send({
				gate: "passed",
				scan: gateResult.scan,
				error: err instanceof Error ? err.message : "Build pipeline error",
			});
		}
	});
};
