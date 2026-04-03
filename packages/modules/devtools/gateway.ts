import { execSync } from "node:child_process";

function getLocalHostname(): string {
	try {
		return execSync("scutil --get LocalHostName", { encoding: "utf8" })
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");
	} catch {
		return "localhost";
	}
}

/**
 * LocalGateway — exposes simvyn to home network devices via mDNS.
 * No subprocesses. Caddy (running separately on port 8080) handles the
 * actual LAN-accessible reverse proxy. This class just computes and
 * surfaces the URL that other devices should use.
 */
export class LocalGateway {
	private readonly url: string;

	constructor(caddy_port = 8080) {
		const hostname = getLocalHostname();
		this.url = `http://${hostname}.local:${caddy_port}`;
	}

	// No-op — gateway is always available (Caddy runs as a brew service)
	async start(): Promise<void> {}
	async stop(): Promise<void> {}

	isRunning(): boolean {
		return true;
	}

	getPublicUrl(): string {
		return this.url;
	}
}
