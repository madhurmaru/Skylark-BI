"use client";

import { Eye, EyeOff, Loader2, Moon, Monitor, Sun } from "lucide-react";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useState } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ className = "", variant = "secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`ui-button ${variant} ${className}`} {...props} />;
}

export function IconButton({ label, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`ui-input ${className}`} {...props} />;
});

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return <div className="password-wrap"><Input ref={ref} {...props} type={visible ? "text" : "password"} /><IconButton type="button" label={visible ? "Hide token" : "Reveal token"} onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</IconButton></div>;
});

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-textarea ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return <div className={`alert ${tone}`} role="status">{children}</div>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label}><Loader2 size={16}/></span>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-header"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function BoardCard({ name, detail, columns }: { name: string; detail: string; columns?: string[] }) {
  return <div className="board-card"><strong>{name}</strong><small>{detail}</small>{columns?.length ? <p>{columns.slice(0, 6).join(", ")}{columns.length > 6 ? "..." : ""}</p> : null}</div>;
}

type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "skylark-theme";

function applyTheme(mode: ThemeMode) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? systemDark ? "dark" : "light" : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  document.querySelector<HTMLMetaElement>("meta[name='theme-color']")?.setAttribute("content", resolved === "dark" ? "#09111f" : "#f7f5f0");
}

export function ThemeSelector() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setMode(initial);
    applyTheme(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => initial === "system" && applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  function choose(next: ThemeMode) {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }
  return <div className="theme-selector" role="group" aria-label="Theme">
    <IconButton label="Use light theme" aria-pressed={mode === "light"} onClick={() => choose("light")}><Sun size={16}/></IconButton>
    <IconButton label="Use dark theme" aria-pressed={mode === "dark"} onClick={() => choose("dark")}><Moon size={16}/></IconButton>
    <IconButton label="Use system theme" aria-pressed={mode === "system"} onClick={() => choose("system")}><Monitor size={16}/></IconButton>
  </div>;
}
