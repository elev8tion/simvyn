import type { SimvynModule } from "@simvyn/types";
import { devtoolsPlugin } from "./index.js";

const devtoolsModule: SimvynModule = {
	name: "devtools",
	version: "0.1.0",
	description: "Project-scoped Claude Code chat interface with Cloudflare tunnel gateway",
	icon: "terminal",

	async register(fastify: any, _opts: any) {
		await fastify.register(devtoolsPlugin);
	},
};

export default devtoolsModule;
