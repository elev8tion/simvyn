import * as fs from "node:fs";
import type { FastifyPluginAsync } from "fastify";
import { getSocketPath } from "./service.js";
import appStateRoutes from "./routes/app-state.js";
import projectsRoutes from "./routes/projects.js";
import simulatorRoutes from "./routes/simulator.js";
import settingsRoutes from "./routes/settings.js";
import credentialsRoutes from "./routes/credentials.js";
import formsRoutes from "./routes/forms.js";
import versionsRoutes from "./routes/versions.js";
import screenshotsRoutes from "./routes/screenshots.js";
import monetizationRoutes from "./routes/monetization.js";
import pipelineRoutes from "./routes/pipeline.js";

export const blitzingPlugin: FastifyPluginAsync = async (fastify, _opts) => {
	if (!fs.existsSync(getSocketPath())) {
		fastify.log.warn(
			`blitzing: socket not found at '${getSocketPath()}' — Blitz.app may not be running`,
		);
	}

	await fastify.register(appStateRoutes, { prefix: "/app-state" });
	await fastify.register(projectsRoutes, { prefix: "/projects" });
	await fastify.register(simulatorRoutes, { prefix: "/simulator" });
	await fastify.register(settingsRoutes, { prefix: "/settings" });
	await fastify.register(credentialsRoutes, { prefix: "/credentials" });
	await fastify.register(formsRoutes, { prefix: "/forms" });
	await fastify.register(versionsRoutes, { prefix: "/versions" });
	await fastify.register(screenshotsRoutes, { prefix: "/screenshots" });
	await fastify.register(monetizationRoutes, { prefix: "/monetization" });
	await fastify.register(pipelineRoutes, { prefix: "/build" });
};
