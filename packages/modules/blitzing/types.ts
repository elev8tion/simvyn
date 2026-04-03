export const errorSchema = {
	type: "object",
	required: ["error"],
	properties: {
		error: { type: "string" },
	},
} as const;

// app-state
export const tabBodySchema = {
	type: "object",
	properties: {
		tab: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const navSwitchTabBodySchema = {
	type: "object",
	required: ["tab"],
	properties: {
		tab: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const rejectionQuerySchema = {
	type: "object",
	properties: {
		version: { type: "string" },
	},
	additionalProperties: false,
} as const;

// projects
export const projectOpenBodySchema = {
	type: "object",
	required: ["projectId"],
	properties: {
		projectId: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const projectCreateBodySchema = {
	type: "object",
	required: ["name", "type"],
	properties: {
		name: { type: "string" },
		type: { type: "string" },
		platform: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const projectImportBodySchema = {
	type: "object",
	required: ["path", "type"],
	properties: {
		path: { type: "string" },
		type: { type: "string" },
		platform: { type: "string" },
	},
	additionalProperties: false,
} as const;

// simulator
export const simulatorSelectBodySchema = {
	type: "object",
	required: ["udid"],
	properties: {
		udid: { type: "string" },
	},
	additionalProperties: false,
} as const;

// settings
export const settingsUpdateBodySchema = {
	type: "object",
	properties: {
		showCursor: { type: "boolean" },
		cursorSize: { type: "number" },
	},
	additionalProperties: false,
} as const;

// credentials
export const credentialsBodySchema = {
	type: "object",
	required: ["issuerId", "keyId", "privateKeyPath"],
	properties: {
		issuerId: { type: "string" },
		keyId: { type: "string" },
		privateKeyPath: { type: "string" },
	},
	additionalProperties: false,
} as const;

// forms
export const fillFormBodySchema = {
	type: "object",
	required: ["tab", "fields"],
	properties: {
		tab: { type: "string" },
		locale: { type: "string" },
		fields: { type: "object", additionalProperties: true },
	},
	additionalProperties: false,
} as const;

export const localizationBodySchema = {
	type: "object",
	required: ["locale"],
	properties: {
		locale: { type: "string" },
	},
	additionalProperties: false,
} as const;

// versions
export const selectVersionBodySchema = {
	type: "object",
	required: ["version"],
	properties: {
		version: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const createVersionBodySchema = {
	type: "object",
	required: ["versionString"],
	properties: {
		versionString: { type: "string" },
		copyFromVersion: { type: "string" },
		copyMetadata: { type: "boolean" },
		copyReviewDetail: { type: "boolean" },
		attachBuildId: { type: "string" },
	},
	additionalProperties: false,
} as const;

// screenshots
export const screenshotsLocalizationBodySchema = {
	type: "object",
	required: ["locale"],
	properties: {
		locale: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const screenshotsAddAssetBodySchema = {
	type: "object",
	required: ["sourcePath"],
	properties: {
		sourcePath: { type: "string" },
		fileName: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const screenshotsSetTrackBodySchema = {
	type: "object",
	required: ["assetFileName", "slotIndex"],
	properties: {
		assetFileName: { type: "string" },
		slotIndex: { type: "integer" },
		displayType: { type: "string" },
		locale: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const screenshotsSaveBodySchema = {
	type: "object",
	properties: {
		displayType: { type: "string" },
		locale: { type: "string" },
	},
	additionalProperties: false,
} as const;

// monetization
export const appPriceBodySchema = {
	type: "object",
	required: ["price"],
	properties: {
		price: { type: "string" },
		effectiveDate: { type: "string" },
	},
	additionalProperties: false,
} as const;

// build-pipeline
export const buildSigningBodySchema = {
	type: "object",
	properties: {
		teamId: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const buildBodySchema = {
	type: "object",
	properties: {
		scheme: { type: "string" },
		configuration: { type: "string" },
	},
	additionalProperties: false,
} as const;

export const buildUploadBodySchema = {
	type: "object",
	properties: {
		ipaPath: { type: "string" },
		skipPolling: { type: "boolean" },
	},
	additionalProperties: false,
} as const;
