import { runPreflight } from "../greenmeansgo/service.js";
import { callTool, MCPError } from "../blitzing/service.js";
import type { ScanResult } from "../shared/types/greenmeansgo.js";

export interface BuildOpts {
	scheme?: string;
	configuration?: string;
	skipPolling?: boolean;
}

export interface PipelineOpts {
	sourcePath: string;
	ipaPath?: string;
	build?: BuildOpts;
}

export interface ScanGateResult {
	gate: "passed" | "blocked";
	scan: ScanResult;
	message?: string;
}

export interface BuildSteps {
	signing: string;
	build: string;
	upload: string;
}

export interface PipelineResult {
	gate: "passed" | "blocked";
	scan: ScanResult;
	build?: BuildSteps;
}

export async function runScanGate(
	sourcePath: string,
	ipaPath?: string,
): Promise<ScanGateResult> {
	const scan = await runPreflight(sourcePath, ipaPath);

	if (!scan.passed) {
		const count = scan.summary.critical;
		return {
			gate: "blocked",
			scan,
			message: `${count} critical finding(s) must be resolved before submission`,
		};
	}

	return { gate: "passed", scan };
}

export async function runPipeline(opts: PipelineOpts): Promise<PipelineResult> {
	// 1. Run greenmeansgo preflight
	const scan = await runPreflight(opts.sourcePath, opts.ipaPath);

	// 2. Gate check — block on any CRITICAL findings
	if (!scan.passed) {
		return { gate: "blocked", scan };
	}

	// 3. blitzing build pipeline — three sequential tool calls
	try {
		const signing = await callTool("app_store_setup_signing", {});
		const build = await callTool("app_store_build", (opts.build ?? {}) as Record<string, unknown>);
		const upload = await callTool("app_store_upload", {
			skipPolling: opts.build?.skipPolling ?? false,
		});

		return { gate: "passed", scan, build: { signing, build, upload } };
	} catch (err) {
		if (err instanceof MCPError) {
			throw Object.assign(new Error(err.message), { httpStatus: 502 });
		}
		if (err instanceof Error) {
			throw Object.assign(new Error(err.message), { httpStatus: 502 });
		}
		throw err;
	}
}
