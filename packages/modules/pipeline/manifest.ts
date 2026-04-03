import type { SimvynModule } from "@simvyn/types";
import { pipelinePlugin } from "./index.js";

const pipelineModule: SimvynModule = {
	name: "pipeline",
	version: "0.1.0",
	description: "Compliance-gated App Store submission orchestrator",
	icon: "git-branch",

	async register(fastify: any, _opts: any) {
		await fastify.register(pipelinePlugin);
	},
};

export default pipelineModule;
