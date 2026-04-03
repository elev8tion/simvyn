import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class SubprocessError extends Error {
	readonly exitCode: number | null;
	readonly stderr: string;

	constructor(message: string, exitCode: number | null, stderr: string) {
		super(message);
		this.name = "SubprocessError";
		this.exitCode = exitCode;
		this.stderr = stderr;
	}
}

export async function runProcess(
	binary: string,
	args: string[],
	timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	try {
		const result = await execFileAsync(binary, args, {
			timeout: timeoutMs,
			maxBuffer: 64 * 1024 * 1024,
		});
		return {
			stdout: result.stdout as string,
			stderr: result.stderr as string,
			exitCode: 0,
		};
	} catch (err: unknown) {
		const error = err as NodeJS.ErrnoException & {
			stdout?: string;
			stderr?: string;
			code?: string | number;
			killed?: boolean;
		};

		// Timeout
		if (error.killed || error.code === "ETIMEDOUT") {
			throw new SubprocessError(
				`Process timed out after ${timeoutMs}ms: ${binary}`,
				null,
				error.stderr ?? "",
			);
		}

		const exitCode = typeof error.code === "number" ? error.code : null;

		// Exit code 1 = compliance findings present — not an error, return normally
		if (exitCode === 1) {
			return {
				stdout: error.stdout ?? "",
				stderr: error.stderr ?? "",
				exitCode: 1,
			};
		}

		// Exit code 2 = usage error, or any other unexpected failure
		throw new SubprocessError(
			`Process exited with code ${exitCode ?? "unknown"}: ${binary}`,
			exitCode,
			error.stderr ?? "",
		);
	}
}
