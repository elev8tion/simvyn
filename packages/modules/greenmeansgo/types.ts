export const codescanBodySchema = {
	type: "object",
	required: ["sourcePath"],
	properties: {
		sourcePath: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const privacyBodySchema = {
	type: "object",
	required: ["sourcePath"],
	properties: {
		sourcePath: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const preflightBodySchema = {
	type: "object",
	required: ["sourcePath"],
	properties: {
		sourcePath: { type: "string" },
		ipaPath: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const scanResultSchema = {
	type: "object",
	required: ["passed", "summary", "findings"],
	properties: {
		passed: { type: "boolean" },
		summary: {
			type: "object",
			required: ["total", "critical", "warns", "infos", "elapsed"],
			properties: {
				total: { type: "integer" },
				critical: { type: "integer" },
				warns: { type: "integer" },
				infos: { type: "integer" },
				elapsed: { type: "number" },
			},
		},
		findings: { type: "array", items: { type: "object" } },
	},
} as const;

export const errorSchema = {
	type: "object",
	required: ["error"],
	properties: {
		error: { type: "string" },
		detail: { type: "string" },
	},
} as const;
