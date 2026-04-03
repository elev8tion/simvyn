import type { SimvynModule } from "@simvyn/types";
import { blitzingPlugin } from "./index.js";

export const name = "blitzing" as const;

export const register = blitzingPlugin;

const blitzingModule: SimvynModule = {
	name,
	version: "0.1.0",
	description: "App Store submission proxy",
	icon: "rocket",

	async register(fastify: any, _opts: any) {
		await fastify.register(blitzingPlugin);
	},
};

export default blitzingModule;
