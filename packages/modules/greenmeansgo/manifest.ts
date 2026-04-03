import type { SimvynModule } from "@simvyn/types";
import { greenmeansgoPlugin } from "./index.js";

export const name = "greenmeansgo" as const;

export const register = greenmeansgoPlugin;

const greenmeansgoModule: SimvynModule = {
	name,
	version: "0.1.0",
	description: "iOS compliance scanner",
	icon: "shield-check",

	async register(fastify: any, _opts: any) {
		await fastify.register(greenmeansgoPlugin);
	},
};

export default greenmeansgoModule;
