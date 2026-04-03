import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runProcess } from "../shared/subprocess.js";
import type { ScanResult } from "../shared/types/greenmeansgo.js";

function resolveBinary(): string {
	return process.env["GREENMEANSGO_BINARY"] ?? "green-means-go";
}

function resolveTimeout(): number {
	const raw = process.env["GREENMEANSGO_TIMEOUT_MS"];
	if (raw) {
		const ms = parseInt(raw, 10);
		if (!isNaN(ms) && ms > 0) return ms;
	}
	return 30000;
}

export function parseScanOutput(stdout: string): ScanResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stdout);
	} catch {
		throw new Error(
			`Failed to parse scanner output as JSON: ${stdout.slice(0, 200)}`,
		);
	}
	return parsed as ScanResult;
}

export async function runCodescan(sourcePath: string): Promise<ScanResult> {
	const binary = resolveBinary();
	const timeout = resolveTimeout();
	const result = await runProcess(
		binary,
		["codescan", "--path", sourcePath, "--format", "json"],
		timeout,
	);
	return parseScanOutput(result.stdout);
}

export async function runIPAScan(
	ipaBuffer: Buffer,
	_originalName: string,
): Promise<ScanResult> {
	const binary = resolveBinary();
	const timeout = resolveTimeout();
	const tmpPath = join(tmpdir(), `${randomUUID()}.ipa`);

	try {
		await writeFile(tmpPath, ipaBuffer);
		const result = await runProcess(
			binary,
			["ipa", "--ipa", tmpPath, "--format", "json"],
			timeout,
		);
		return parseScanOutput(result.stdout);
	} finally {
		await unlink(tmpPath).catch(() => {});
	}
}

export async function runPrivacyScan(sourcePath: string): Promise<ScanResult> {
	const binary = resolveBinary();
	const timeout = resolveTimeout();
	const result = await runProcess(
		binary,
		["privacy", "--path", sourcePath, "--format", "json"],
		timeout,
	);
	return parseScanOutput(result.stdout);
}

export async function runPreflight(
	sourcePath: string,
	ipaPath?: string,
): Promise<ScanResult> {
	const binary = resolveBinary();
	const timeout = resolveTimeout();
	const args = ["preflight", "--path", sourcePath];
	if (ipaPath) {
		args.push("--ipa", ipaPath);
	}
	args.push("--format", "json");
	const result = await runProcess(binary, args, timeout);
	return parseScanOutput(result.stdout);
}
