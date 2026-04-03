export type Severity = "INFO" | "WARN" | "BLOCK" | "CRITICAL";

export interface CodescanFinding {
	severity: Severity;
	title: string;
	guideline: string;
	detail: string;
	ruleCode: string;
	filePath: string;
	lineNumber: number;
	snippet?: string;
}

export interface IpaFinding {
	severity: Severity;
	title: string;
	guideline: string;
	detail: string;
	component: string;
	frameworkName?: string;
}

export interface PrivacyFinding {
	severity: Severity;
	title: string;
	guideline: string;
	detail: string;
	apiCategory?: string;
	sdkName?: string;
	detectedIn: string;
}

export interface ScanSummary {
	total: number;
	critical: number;
	warns: number;
	infos: number;
	elapsed: number;
}

export interface ScanResult {
	passed: boolean;
	summary: ScanSummary;
	findings: Array<CodescanFinding | IpaFinding | PrivacyFinding>;
}
