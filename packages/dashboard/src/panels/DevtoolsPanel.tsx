import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, Send, Square, Terminal } from "lucide-react";
import { registerPanel } from "../stores/panel-registry";

// ── Types ────────────────────────────────────────────

interface FileNode {
	name: string;
	type: "dir" | "file";
	children?: FileNode[];
}

interface ProjectInfo {
	name: string;
	path: string;
	setAt: string;
}

interface ToolUseBlock {
	tool: string;
	input: unknown;
	result?: string;
	expanded: boolean;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	toolUses?: ToolUseBlock[];
	isStreaming?: boolean;
}

// ── File Tree ────────────────────────────────────────

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
	const [expanded, setExpanded] = useState(depth < 1);

	return (
		<div>
			<button
				type="button"
				onClick={() => node.type === "dir" && setExpanded((e) => !e)}
				className="flex items-center gap-1 w-full text-left rounded hover:bg-white/5 text-xs text-text-secondary"
				style={{ paddingTop: "2px", paddingBottom: "2px", paddingLeft: `${4 + depth * 14}px`, paddingRight: "4px" }}
			>
				{node.type === "dir" ? (
					<>
						{expanded ? (
							<ChevronDown size={10} className="shrink-0 opacity-50" />
						) : (
							<ChevronRight size={10} className="shrink-0 opacity-50" />
						)}
						<Folder size={12} className="shrink-0 text-amber-400 opacity-70 ml-0.5" />
					</>
				) : (
					<>
						<span className="w-[10px] shrink-0" />
						<File size={12} className="shrink-0 text-text-muted opacity-60 ml-0.5" />
					</>
				)}
				<span className="ml-1 truncate">{node.name}</span>
			</button>
			{node.type === "dir" && expanded && node.children && (
				<div>
					{node.children.map((child) => (
						<TreeNode key={child.name} node={child} depth={depth + 1} />
					))}
				</div>
			)}
		</div>
	);
}

// ── Tool use block ───────────────────────────────────

function ToolUseItem({
	block,
	onToggle,
}: {
	block: ToolUseBlock;
	onToggle: () => void;
}) {
	return (
		<div className="my-1 border border-white/10 rounded-md overflow-hidden text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-1.5 w-full px-2 py-1 bg-white/5 hover:bg-white/[0.08] text-left text-text-secondary"
			>
				{block.expanded ? (
					<ChevronDown size={10} />
				) : (
					<ChevronRight size={10} />
				)}
				<Terminal size={10} className="text-amber-400" />
				<span className="font-mono">{block.tool}</span>
				{block.result !== undefined && (
					<span className="ml-auto opacity-50 text-[10px]">result attached</span>
				)}
			</button>
			{block.expanded && (
				<div className="p-2 font-mono text-[10px] text-text-muted whitespace-pre-wrap break-all bg-black/20 max-h-48 overflow-auto">
					<div className="text-amber-300/70 mb-1">Input:</div>
					{JSON.stringify(block.input, null, 2)}
					{block.result !== undefined && (
						<>
							<div className="text-emerald-400/70 mt-2 mb-1">Result:</div>
							<div className="text-text-secondary">{block.result}</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}

// ── Chat message ─────────────────────────────────────

function Message({
	msg,
	onToggleTool,
}: {
	msg: ChatMessage;
	onToggleTool: (msgId: string, toolIdx: number) => void;
}) {
	if (msg.role === "system") {
		return (
			<div className="text-center text-xs text-text-muted py-2 italic">{msg.content}</div>
		);
	}

	const isUser = msg.role === "user";

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
			<div
				className={`max-w-[85%] rounded-lg px-3 py-2 ${
					isUser
						? "bg-accent-blue/20 border border-accent-blue/30"
						: "bg-white/5 border border-white/10"
				}`}
			>
				{msg.content && (
					<p className="text-sm text-text-primary whitespace-pre-wrap">{msg.content}</p>
				)}
				{msg.toolUses?.map((block, i) => (
					<ToolUseItem
						key={`${msg.id}-tool-${i}`}
						block={block}
						onToggle={() => onToggleTool(msg.id, i)}
					/>
				))}
				{msg.isStreaming && (
					<span className="inline-block w-1.5 h-3.5 bg-accent-blue/70 animate-pulse ml-0.5 align-middle" />
				)}
			</div>
		</div>
	);
}

// ── Main Panel ───────────────────────────────────────

function DevtoolsPanel() {
	const [project, setProject] = useState<ProjectInfo | null>(null);
	const [projectLoading, setProjectLoading] = useState(true);
	const [tree, setTree] = useState<FileNode[] | null>(null);
	const [newName, setNewName] = useState("");
	const [newPath, setNewPath] = useState("");
	const [settingProject, setSettingProject] = useState(false);

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputText, setInputText] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [wsConnected, setWsConnected] = useState(false);
	const [errorBanner, setErrorBanner] = useState<string | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const currentAssistantMsgIdRef = useRef<string | null>(null);

	// ── Project & tree ───────────────────────────────

	const fetchProject = useCallback(async () => {
		setProjectLoading(true);
		try {
			const res = await fetch("/api/modules/devtools/project");
			if (res.ok) {
				const data = (await res.json()) as ProjectInfo;
				setProject(data);
				const treeRes = await fetch("/api/modules/devtools/tree?depth=3");
				if (treeRes.ok) {
					const td = (await treeRes.json()) as { children: FileNode[] };
					setTree(td.children ?? []);
				} else {
					setTree([]);
				}
			} else {
				setProject(null);
				setTree(null);
			}
		} catch {
			setProject(null);
		} finally {
			setProjectLoading(false);
		}
	}, []);

	const handleSetProject = async () => {
		if (!newName.trim() || !newPath.trim()) return;
		setSettingProject(true);
		try {
			const res = await fetch("/api/modules/devtools/project", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim(), path: newPath.trim() }),
			});
			if (res.ok) {
				setNewName("");
				setNewPath("");
				await fetchProject();
				// reconnect WS so session_ready fires for new project
				wsRef.current?.close();
				setTimeout(connectWs, 200);
			} else {
				const err = (await res.json()) as { error: string };
				setErrorBanner(err.error ?? "Failed to set project");
			}
		} catch {
			setErrorBanner("Failed to set project");
		} finally {
			setSettingProject(false);
		}
	};

	// ── WebSocket message handler ─────────────────────

	const handleWsMessage = useCallback((msg: Record<string, unknown>) => {
		const type = msg.type as string;

		if (type === "session_ready") {
			const proj = msg.project as ProjectInfo | undefined;
			const gatewayUrl = msg.gatewayUrl as string | undefined;
			const parts = ["Session ready"];
			if (proj) parts.push(`Project: ${proj.name}`);
			if (gatewayUrl) parts.push(`Gateway: ${gatewayUrl}`);
			setMessages((prev) => [
				...prev,
				{ id: crypto.randomUUID(), role: "system", content: parts.join(" · ") },
			]);
			setIsRunning(false);
		} else if (type === "text") {
			const content = (msg.content as string) ?? "";
			const done = (msg.done as boolean) ?? false;
			setMessages((prev) => {
				const existingId = currentAssistantMsgIdRef.current;
				const existing = existingId ? prev.find((m) => m.id === existingId) : null;
				if (existing) {
					return prev.map((m) =>
						m.id === existingId
							? { ...m, content: m.content + content, isStreaming: !done }
							: m,
					);
				}
				const newId = crypto.randomUUID();
				currentAssistantMsgIdRef.current = newId;
				return [
					...prev,
					{ id: newId, role: "assistant", content, toolUses: [], isStreaming: !done },
				];
			});
			if (done) currentAssistantMsgIdRef.current = null;
		} else if (type === "tool_use") {
			const tool = (msg.tool as string) ?? "Unknown";
			const input = msg.input;
			setMessages((prev) => {
				const existingId = currentAssistantMsgIdRef.current;
				if (existingId) {
					return prev.map((m) =>
						m.id === existingId
							? {
									...m,
									toolUses: [...(m.toolUses ?? []), { tool, input, expanded: false }],
								}
							: m,
					);
				}
				const newId = crypto.randomUUID();
				currentAssistantMsgIdRef.current = newId;
				return [
					...prev,
					{
						id: newId,
						role: "assistant",
						content: "",
						toolUses: [{ tool, input, expanded: false }],
						isStreaming: true,
					},
				];
			});
		} else if (type === "tool_result") {
			const tool = (msg.tool as string) ?? "";
			const output = (msg.output as string) ?? "";
			setMessages((prev) =>
				prev.map((m) => {
					if (!m.toolUses?.length) return m;
					// find last matching tool use
					const idx = [...m.toolUses]
						.reverse()
						.findIndex((t) => t.tool === tool && t.result === undefined);
					if (idx === -1) return m;
					const realIdx = m.toolUses.length - 1 - idx;
					const updated = [...m.toolUses];
					updated[realIdx] = { ...updated[realIdx], result: output };
					return { ...m, toolUses: updated };
				}),
			);
		} else if (type === "error") {
			setErrorBanner((msg.message as string) ?? "An error occurred");
			setIsRunning(false);
		} else if (type === "session_end") {
			setIsRunning(false);
			currentAssistantMsgIdRef.current = null;
			setMessages((prev) => prev.map((m) => ({ ...m, isStreaming: false })));
		}
	}, []);

	// ── WebSocket connection ──────────────────────────

	const connectWs = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return;
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const url = `${protocol}//${window.location.host}/api/modules/devtools/session`;
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => setWsConnected(true);
		ws.onclose = () => {
			setWsConnected(false);
			setIsRunning(false);
			wsRef.current = null;
		};
		ws.onerror = () => ws.close();
		ws.onmessage = (event) => {
			try {
				handleWsMessage(JSON.parse(event.data as string) as Record<string, unknown>);
			} catch {
				// ignore malformed
			}
		};
	}, [handleWsMessage]);

	// ── Lifecycle ─────────────────────────────────────

	useEffect(() => {
		fetchProject();
		connectWs();
		return () => {
			wsRef.current?.close();
		};
	}, [fetchProject, connectWs]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// ── Send / interrupt ──────────────────────────────

	const sendPrompt = () => {
		const text = inputText.trim();
		if (!text || isRunning) return;
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;

		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "user", content: text, toolUses: [] },
		]);
		setInputText("");
		setIsRunning(true);
		currentAssistantMsgIdRef.current = null;
		ws.send(JSON.stringify({ type: "prompt", text }));
	};

	const sendInterrupt = () => {
		const ws = wsRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "interrupt" }));
		}
	};

	const toggleTool = useCallback((msgId: string, toolIdx: number) => {
		setMessages((prev) =>
			prev.map((m) => {
				if (m.id !== msgId || !m.toolUses) return m;
				const updated = [...m.toolUses];
				updated[toolIdx] = { ...updated[toolIdx], expanded: !updated[toolIdx].expanded };
				return { ...m, toolUses: updated };
			}),
		);
	}, []);

	// ── Render ────────────────────────────────────────

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
				<h1 className="text-base font-medium text-text-primary">Devtools</h1>
				<span
					className={`text-xs px-2 py-0.5 rounded-full border ${
						wsConnected
							? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
							: "bg-red-500/15 border-red-500/30 text-red-400"
					}`}
				>
					{wsConnected ? "connected" : "disconnected"}
				</span>
			</div>

			{/* Error banner */}
			{errorBanner && (
				<div className="mx-4 mt-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center justify-between shrink-0">
					<span>{errorBanner}</span>
					<button
						type="button"
						onClick={() => setErrorBanner(null)}
						className="ml-3 opacity-60 hover:opacity-100"
					>
						✕
					</button>
				</div>
			)}

			{/* Body: left file tree + right chat */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left: File tree */}
				<div className="w-52 shrink-0 border-r border-border/30 flex flex-col overflow-hidden">
					<div className="px-3 py-2 text-[10px] font-medium text-text-muted uppercase tracking-wider border-b border-border/20 shrink-0">
						Project
					</div>

					{projectLoading ? (
						<div className="flex-1 flex items-center justify-center text-xs text-text-muted">
							Loading…
						</div>
					) : project ? (
						<div className="flex-1 overflow-auto py-1">
							<div className="px-3 py-1 text-xs font-medium text-amber-400/80 truncate mb-0.5">
								{project.name}
							</div>
							{tree ? (
								<div className="px-1">
									{tree.map((node) => (
										<TreeNode key={node.name} node={node} depth={0} />
									))}
								</div>
							) : (
								<div className="text-xs text-text-muted px-3">Loading tree…</div>
							)}
						</div>
					) : (
						<div className="flex-1 p-3 space-y-2 overflow-auto">
							<p className="text-xs text-text-muted">No active project</p>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Project name"
								className="glass-input text-xs w-full"
							/>
							<input
								type="text"
								value={newPath}
								onChange={(e) => setNewPath(e.target.value)}
								placeholder="/path/to/project"
								className="glass-input text-xs w-full font-mono"
								onKeyDown={(e) => e.key === "Enter" && handleSetProject()}
							/>
							<button
								type="button"
								onClick={handleSetProject}
								disabled={settingProject || !newName.trim() || !newPath.trim()}
								className="glass-button-primary text-xs w-full"
							>
								{settingProject ? "Setting…" : "Set Project"}
							</button>
						</div>
					)}
				</div>

				{/* Right: Chat */}
				<div className="flex flex-col flex-1 overflow-hidden">
					{/* Messages */}
					<div className="flex-1 overflow-auto px-4 py-4">
						{messages.length === 0 && (
							<div className="flex h-full items-center justify-center text-sm text-text-muted">
								{project
									? "Ask Claude anything about this project…"
									: "Set a project to start a session"}
							</div>
						)}
						{messages.map((msg) => (
							<Message key={msg.id} msg={msg} onToggleTool={toggleTool} />
						))}
						<div ref={messagesEndRef} />
					</div>

					{/* Input bar */}
					<div className="border-t border-border/30 px-4 py-3 flex items-center gap-2 shrink-0">
						<input
							type="text"
							value={inputText}
							onChange={(e) => setInputText(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendPrompt()}
							placeholder={isRunning ? "Claude is responding…" : "Ask Claude…"}
							disabled={isRunning || !wsConnected}
							className="glass-input flex-1 text-sm"
						/>
						{isRunning ? (
							<button
								type="button"
								onClick={sendInterrupt}
								className="glass-button text-xs flex items-center gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/10 shrink-0"
							>
								<Square size={12} />
								Stop
							</button>
						) : (
							<button
								type="button"
								onClick={sendPrompt}
								disabled={!inputText.trim() || !wsConnected}
								className="glass-button-primary text-xs flex items-center gap-1.5 shrink-0"
							>
								<Send size={12} />
								Send
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

registerPanel("devtools", DevtoolsPanel);

export default DevtoolsPanel;
