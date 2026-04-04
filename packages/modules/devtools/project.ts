import * as fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectState } from "./types.js";

const STATE_PATH = join(homedir(), ".simvyn", "devtools", "project.json");

function loadPersistedProject(): ProjectState | null {
	try {
		const raw = fs.readFileSync(STATE_PATH, "utf8");
		const parsed = JSON.parse(raw) as ProjectState;
		// Discard if the path no longer exists on disk
		if (!fs.existsSync(parsed.path)) return null;
		return parsed;
	} catch {
		return null;
	}
}

function persistProject(project: ProjectState | null): void {
	try {
		fs.mkdirSync(join(homedir(), ".simvyn", "devtools"), { recursive: true });
		if (project) {
			fs.writeFileSync(STATE_PATH, JSON.stringify(project, null, 2), "utf8");
		} else {
			fs.rmSync(STATE_PATH, { force: true });
		}
	} catch {
		// non-fatal
	}
}

let activeProject: ProjectState | null = loadPersistedProject();

export function getProject(): ProjectState | null {
	return activeProject;
}

export function setProject(input: { name: string; path: string }): ProjectState {
	if (!fs.existsSync(input.path)) {
		throw new Error(`Project path does not exist: ${input.path}`);
	}

	activeProject = {
		name: input.name,
		path: input.path,
		setAt: new Date().toISOString(),
	};

	persistProject(activeProject);
	return activeProject;
}

export function clearProject(): void {
	activeProject = null;
	persistProject(null);
}
