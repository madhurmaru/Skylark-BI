"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, BarChart3, BriefcaseBusiness, Check, ChevronRight, CircleDollarSign, ClipboardList, Database, FileWarning, Layers3, Menu, MessageSquareText, RefreshCw, Send, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";
import type { BIResult, MondayConfig } from "@/types/bi";
import { MarkdownLite } from "./markdown-lite";
import { Alert, Badge, BoardCard, Button, Card, IconButton, MetricCard, PasswordInput, SectionHeader, Spinner, Textarea, ThemeSelector, Input } from "./ui";

type ChatItem = { role: "user"; text: string } | { role: "assistant"; result: BIResult } | { role: "assistant"; text: string; error?: boolean };
type Config = { ready: boolean; config: Record<string, boolean> };
type TestBoard = { id: string; name: string; accessible: boolean; itemCount: number; columnNames: string[] };
type TestResult = { boards: TestBoard[] };

const defaultPrompts = [
  "Prepare a concise leadership update.",
  "How is our energy sector pipeline looking this quarter?",
  "Where is receivables risk concentrated?",
  "Which work orders are creating execution risk?",
  "What data quality caveats should leadership know?",
  "Compare pipeline and operations risk by sector.",
];

const genericPrompts = [
  "Summarize all connected boards.",
  "Show status distributions and missing data.",
  "Which date fields show upcoming or overdue work?",
  "Compare categories across these boards.",
  "What columns look most useful for analysis?",
  "Where are the largest numeric totals?",
];

function Logo() {
  return <div className="logo" aria-label="Skylark Intelligence"><div className="logo-mark" aria-hidden><span /><span /><span /></div><div><strong>Skylark Intelligence</strong><small>Executive intelligence for Monday.com</small></div></div>;
}

export function IntelligenceConsole() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [ownBoardsOpen, setOwnBoardsOpen] = useState(false);
  const [temporaryConfig, setTemporaryConfig] = useState<MondayConfig | null>(null);
  const [temporaryBoards, setTemporaryBoards] = useState<TestResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const prompts = temporaryConfig ? genericPrompts : defaultPrompts;

  const refreshStatus = async () => {
    try { const r = await fetch("/api/status", { cache: "no-store" }); setConfig(await r.json()); }
    catch { setConfig({ ready: false, config: {} }); }
  };

  useEffect(() => { refreshStatus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function ask(raw?: string) {
    const text = (raw ?? question).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setLoading(true);
    try {
      const body = temporaryConfig ? { question: text, mondayConfig: temporaryConfig } : { question: text };
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The analysis could not be completed.");
      if (data.clarification) setMessages((m) => [...m, { role: "assistant", text: data.clarification }]);
      else setMessages((m) => [...m, { role: "assistant", result: data }]);
    } catch (error) {
      setMessages((m) => [...m, { role: "assistant", text: error instanceof Error ? error.message : "Something went wrong.", error: true }]);
      if (!config?.ready && !temporaryConfig) setSetupOpen(true);
    } finally { setLoading(false); }
  }

  function clearTemporary() {
    setTemporaryConfig(null);
    setTemporaryBoards(null);
  }

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Primary navigation">
      <div className="sidebar-top"><Logo /><IconButton className="mobile-close" label="Close sidebar" onClick={() => setSidebarOpen(false)}><X size={18}/></IconButton></div>
      <Button className="new-analysis" variant="primary" onClick={() => { setMessages([]); setSidebarOpen(false); }}><Sparkles size={16}/> New analysis</Button>
      <nav>
        <p className="nav-label">Workspace</p>
        <button className="nav-item active"><MessageSquareText size={18}/> Intelligence</button>
        <button className="nav-item" onClick={() => ask("Prepare a concise leadership update.")}><BriefcaseBusiness size={18}/> Leadership brief</button>
        <button className="nav-item" onClick={() => ask("What data quality caveats should leadership know?")}><FileWarning size={18}/> Data quality</button>
        <p className="nav-label second">Data sources</p>
        <SourceRow icon={<CircleDollarSign size={16}/>} title="Deals" subtitle="Configured assignment board" connected={Boolean(config?.config?.dealsBoard)} />
        <SourceRow icon={<ClipboardList size={16}/>} title="Work Orders" subtitle="Configured assignment board" connected={Boolean(config?.config?.workOrdersBoard)} />
        {temporaryBoards && <div className="temporary-source" role="status"><Layers3 size={16}/><span><strong>Using temporary boards</strong><small>{temporaryBoards.boards.map((board) => board.name).join(", ")}</small></span></div>}
      </nav>
      <div className="sidebar-bottom">
        <Button className="try-boards-button" onClick={() => setOwnBoardsOpen(true)}><Database size={16}/><span><strong>{temporaryConfig ? "Manage boards" : "Analyze own boards"}</strong><small>Temporary in this tab</small></span><ChevronRight size={16}/></Button>
        {temporaryConfig && <div className="stack-actions"><Button variant="ghost" onClick={clearTemporary}><X size={15}/> Clear temporary configuration</Button><Button variant="ghost" onClick={clearTemporary}>Return to demo data</Button></div>}
        <Button className="setup-button" onClick={() => setSetupOpen(true)}><Settings2 size={16}/><span><strong>Integration setup</strong><small>{config?.ready ? "All systems ready" : "Configuration required"}</small></span><ChevronRight size={16}/></Button>
        <div className="read-only"><ShieldCheck size={15}/> Read-only Monday access</div>
      </div>
    </aside>
    {sidebarOpen && <button aria-label="Close sidebar" className="scrim" onClick={() => setSidebarOpen(false)}/>}

    <section className="main-panel">
      <header className="topbar">
        <IconButton className="menu-button" label="Open sidebar" onClick={() => setSidebarOpen(true)}><Menu size={20}/></IconButton>
        <div className="topbar-status"><span className={`status-dot ${temporaryConfig || config?.ready ? "" : "warning"}`}/><span>{temporaryConfig ? "Using temporary boards" : config?.ready ? "Live data connected" : "Setup required"}</span><Badge tone="info">Read-only</Badge></div>
        <div className="topbar-actions"><ThemeSelector /></div>
      </header>

      <div className={`conversation ${messages.length ? "has-messages" : ""}`}>
        {!messages.length ? <WelcomeState config={config} temporaryBoards={temporaryBoards} prompts={prompts} onAsk={ask} onSetup={() => setSetupOpen(true)} onBoards={() => setOwnBoardsOpen(true)} onClear={clearTemporary}/> : <div className="message-list">
          {temporaryBoards && <TemporaryBanner boards={temporaryBoards.boards} onManage={() => setOwnBoardsOpen(true)} onClear={clearTemporary}/>}
          {messages.map((m, i) => m.role === "user" ? <div className="user-message" key={i}><span>You asked</span><p>{m.text}</p></div> : "result" in m ? <ResultCard key={i} result={m.result}/> : <AssistantNote key={i} text={m.text} error={m.error}/>)}
          {loading && <div className="thinking" aria-live="polite"><Spinner label="Analyzing"/><div><strong>Building the briefing</strong><span>Fetching boards, normalizing fields, and calculating deterministic metrics.</span></div></div>}
          <div ref={endRef}/>
        </div>}
      </div>
      <Composer question={question} loading={loading} temporary={Boolean(temporaryConfig)} onChange={setQuestion} onAsk={() => ask()}/>
    </section>
    {setupOpen && <SetupModal config={config} onClose={() => setSetupOpen(false)} onRefresh={refreshStatus}/>}
    {ownBoardsOpen && <OwnBoardsModal onClose={() => setOwnBoardsOpen(false)} onUse={(mondayConfig, boards) => { setTemporaryConfig(mondayConfig); setTemporaryBoards(boards); setOwnBoardsOpen(false); }}/>}
  </main>;
}

function SourceRow({ icon, title, subtitle, connected }: { icon: React.ReactNode; title: string; subtitle: string; connected: boolean }) {
  return <div className="source-row"><span className="source-icon">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div><i className={connected ? "connected" : ""}/></div>;
}

function WelcomeState({ config, temporaryBoards, prompts, onAsk, onSetup, onBoards, onClear }: { config: Config | null; temporaryBoards: TestResult | null; prompts: string[]; onAsk: (q: string) => void; onSetup: () => void; onBoards: () => void; onClear: () => void }) {
  return <div className="welcome">
    <div className="eyebrow"><Sparkles size={14}/> Executive intelligence platform</div>
    <h1>Executive intelligence for Monday.com.</h1>
    <p>Skylark turns live Monday.com boards into deterministic KPIs, risk signals, data-quality caveats, and concise leadership briefings.</p>
    <div className="welcome-actions"><Button variant="primary" onClick={() => onAsk(prompts[0])}>Start briefing <ArrowUpRight size={16}/></Button><Button onClick={onBoards}><Database size={16}/> Analyze your own boards</Button></div>
    {temporaryBoards ? <TemporaryBanner boards={temporaryBoards.boards} onManage={onBoards} onClear={onClear}/> : !config?.ready ? <Alert tone="warning"><AlertTriangle size={17}/><span><strong>Integration setup required</strong><small>Add server-side Monday and Hugging Face credentials, or connect temporary boards for this tab.</small></span><Button onClick={onSetup}>Open setup</Button></Alert> : <ConnectedSummary />}
    <div className="prompt-grid">{prompts.map((p) => <button key={p} onClick={() => onAsk(p)}><span><MessageSquareText size={15}/></span><strong>{p}</strong><ArrowUpRight size={16}/></button>)}</div>
  </div>;
}

function ConnectedSummary() {
  return <div className="connected-summary"><BoardCard name="Deals" detail="Pipeline, sector, probability and close-date intelligence"/><BoardCard name="Work Orders" detail="Operations, billing, receivables and delivery execution"/></div>;
}

function TemporaryBanner({ boards, onManage, onClear }: { boards: TestBoard[]; onManage: () => void; onClear: () => void }) {
  return <Card className="temporary-banner"><div><Badge tone="info">Temporary mode</Badge><strong>Using temporary boards: {boards.map((board) => board.name).join(", ")}</strong><small>Your token and board selections remain only in this browser tab and clear on refresh.</small></div><div className="banner-actions"><Button onClick={onManage}>Manage boards</Button><Button variant="ghost" onClick={onClear}>Clear temporary configuration</Button><Button variant="ghost" onClick={onClear}>Return to demo data</Button></div></Card>;
}

function AssistantNote({ text, error }: { text: string; error?: boolean }) {
  return <div className={`assistant-note ${error ? "error" : ""}`}><AlertTriangle size={error ? 17 : 0}/><p>{text}</p></div>;
}

function ResultCard({ result }: { result: BIResult }) {
  return <article className="result-card">
    <div className="result-heading"><div className="ai-avatar"><BarChart3 size={18}/></div><div><span>Executive summary</span><strong>Skylark Intelligence</strong><small>Generated {new Date(result.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>
    <MarkdownLite text={result.answer}/>
    {result.metrics.length > 0 && <section><SectionHeader eyebrow="Deterministic KPIs" title="Metrics"/><div className="metric-grid">{result.metrics.map((m) => <MetricCard key={m.label} label={m.label} value={m.value} detail={m.detail}/>)}</div></section>}
    {result.insights.length > 0 && <section className="insight-section"><SectionHeader eyebrow="Findings" title="What deserves attention"/>{result.insights.map((x) => <p key={x}><ChevronRight size={15}/>{x}</p>)}</section>}
    {result.caveats.length > 0 && <details className="caveats"><summary><FileWarning size={15}/> Data quality and inference notes <span>{result.caveats.length}</span></summary>{result.caveats.map((x) => <p key={x}>{x}</p>)}</details>}
    <footer>{result.sources.map((s) => <span key={s.board}><Check size={13}/>{s.board}: {s.rowsUsed}/{s.rowsAvailable} rows used</span>)}</footer>
  </article>;
}

function Composer({ question, loading, temporary, onChange, onAsk }: { question: string; loading: boolean; temporary: boolean; onChange: (value: string) => void; onAsk: () => void }) {
  return <div className="composer-wrap"><div className="composer"><Textarea aria-label="Business question" value={question} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAsk(); } }} placeholder={temporary ? "Ask about summaries, distributions, missing data, trends, or columns..." : "Ask about pipeline, revenue, sectors, collections, execution, or leadership updates..."} rows={1}/><IconButton label="Send question" disabled={!question.trim() || loading} onClick={onAsk}>{loading ? <Spinner label="Sending"/> : <Send size={18}/>}</IconButton></div><p>Calculations are deterministic; AI explains computed facts. Verify decisions against source records.</p></div>;
}

function SetupModal({ config, onClose, onRefresh }: { config: Config | null; onClose: () => void; onRefresh: () => void }) {
  const rows = [["Monday API token", "mondayToken"], ["Deals board ID", "dealsBoard"], ["Work Orders board ID", "workOrdersBoard"], ["Hugging Face token", "hfToken"]] as const;
  return <Dialog title="Connect live business data" eyebrow="Integration health" onClose={onClose}>
    <p className="modal-intro">Secrets stay server-side. The app requests board data at query time and never writes back to Monday.com.</p>
    <div className="config-list">{rows.map(([label, id]) => <div key={id}><span className={config?.config?.[id] ? "ok" : "missing"}>{config?.config?.[id] ? <Check size={14}/> : "!"}</span><strong>{label}</strong><small>{config?.config?.[id] ? "Configured" : "Missing environment variable"}</small></div>)}</div>
    <div className="setup-steps"><h3>Required environment variables</h3><code>MONDAY_API_TOKEN</code><code>MONDAY_DEALS_BOARD_ID</code><code>MONDAY_WORK_ORDERS_BOARD_ID</code><code>HF_TOKEN</code><p>Configure these in Vercel Project Settings, then redeploy.</p></div>
    <div className="modal-actions"><Button onClick={onRefresh}><RefreshCw size={16}/> Check again</Button><Button variant="primary" onClick={onClose}>Done</Button></div>
  </Dialog>;
}

function OwnBoardsModal({ onClose, onUse }: { onClose: () => void; onUse: (config: MondayConfig, boards: TestResult) => void }) {
  const [token, setToken] = useState("");
  const [boardInputs, setBoardInputs] = useState([""]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const normalizedBoardIds = useMemo(() => boardInputs.map(extractBoardId).filter((id): id is string => Boolean(id)), [boardInputs]);
  const duplicateIds = new Set(normalizedBoardIds.filter((id, index) => normalizedBoardIds.indexOf(id) !== index));
  const mondayConfig = { token: token.trim(), boardIds: boardInputs.map((input) => input.trim()) };
  const validBoards = boardInputs.every((input) => Boolean(extractBoardId(input))) && !duplicateIds.size;
  const canTest = mondayConfig.token.length >= 10 && mondayConfig.token.length <= 300 && boardInputs.length >= 1 && boardInputs.length <= 10 && validBoards;

  useEffect(() => { tokenRef.current?.focus(); }, []);

  async function testConnection() {
    if (!canTest || testing) return;
    setTesting(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/monday/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mondayConfig) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to verify these Monday boards.");
      setResult({ boards: data.boards });
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Unable to verify these Monday boards.");
    } finally {
      setTesting(false);
    }
  }

  return <Dialog title="Analyze your own Monday boards" eyebrow="Temporary data source" onClose={onClose} locked={testing}>
    <p className="modal-intro">Connect one or more Monday boards. The agent will inspect their columns and adapt its analysis to the available data.</p>
    <Alert tone="info"><ShieldCheck size={16}/><span>Your token and board selections remain only in this browser tab&apos;s memory and are cleared when the page refreshes.</span></Alert>
    <div className="field-grid">
      <label><span>Monday API token</span><PasswordInput ref={tokenRef} autoComplete="off" value={token} maxLength={300} onChange={(e) => { setToken(e.target.value); setResult(null); setError(""); }} /></label>
      <div className="board-list" aria-label="Boards">
        <span>Boards</span>
        {boardInputs.map((value, index) => {
          const id = extractBoardId(value);
          const duplicate = id ? duplicateIds.has(id) : false;
          return <div className="board-input-row" key={index}>
            <Input aria-label={`Board ID or URL ${index + 1}`} inputMode="url" value={value} maxLength={300} placeholder="Board ID or Monday URL" onChange={(e) => { setBoardInputs((items) => items.map((item, i) => i === index ? e.target.value : item)); setResult(null); setError(""); }} />
            <Button type="button" disabled={testing || boardInputs.length === 1} onClick={() => { setBoardInputs((items) => items.filter((_, i) => i !== index)); setResult(null); setError(""); }}>Remove</Button>
            {value && !id && <small>Enter digits or a Monday URL containing /boards/123.</small>}
            {duplicate && <small>Duplicate board ID.</small>}
          </div>;
        })}
        <Button className="add-board-button" type="button" disabled={testing || boardInputs.length >= 10} onClick={() => setBoardInputs((items) => [...items, ""])}>Add another board</Button>
      </div>
    </div>
    <div className={`connection-status ${error ? "error" : result ? "success" : ""}`} role="status" aria-live="polite">
      {testing ? <><Spinner label="Testing"/> Testing read-only access...</> : error ? <><AlertTriangle size={16}/> {error}</> : result ? <><Check size={16}/> Connected to {result.boards.length} board{result.boards.length === 1 ? "" : "s"}.</> : "Test the connection before using these boards."}
    </div>
    {result && <div className="detected-boards">{result.boards.map((board) => <BoardCard key={board.id} name={board.name} detail={`${board.itemCount} items · Board ID ${board.id}`} columns={board.columnNames}/>)}</div>}
    {!validBoards && boardInputs.some(Boolean) && <p className="field-help">{duplicateIds.size ? "Duplicate board IDs are not allowed." : "Board entries must be numeric IDs or Monday board URLs."}</p>}
    <div className="modal-actions"><Button disabled={testing} onClick={onClose}>Cancel</Button><Button disabled={!canTest || testing} onClick={testConnection}>{testing ? <Spinner label="Testing"/> : <RefreshCw size={16}/>} Test connection</Button><Button variant="primary" disabled={!result || testing} onClick={() => result && onUse({ token: token.trim(), boardIds: normalizedBoardIds }, result)}>Use these boards</Button></div>
  </Dialog>;
}

function Dialog({ title, eyebrow, children, onClose, locked = false }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void; locked?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>("button,[href],input,textarea,select,[tabindex]:not([tabindex='-1'])");
    focusables?.[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
      if (event.key === "Tab" && focusables?.length) {
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
  }, [locked, onClose]);
  return <div className="modal-backdrop" onMouseDown={() => !locked && onClose()}><div className="setup-modal" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modal-title"><div><span>{eyebrow}</span><h2 id="dialog-title">{title}</h2></div><IconButton label="Close dialog" disabled={locked} onClick={onClose}><X size={20}/></IconButton></div>
    {children}
  </div></div>;
}

function extractBoardId(input: string) {
  const value = input.trim();
  const match = value.match(/\/boards\/(\d{1,20})(?:\D|$)/);
  if (match) return match[1];
  return /^\d{1,20}$/.test(value) ? value : null;
}
