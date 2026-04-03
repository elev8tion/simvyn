import * as fs from "node:fs";
import type { ProjectState } from "./types.js";

let activeProject: ProjectState | null = null;

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

	return activeProject;
}

export function clearProject(): void {
	activeProject = null;
}
