import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Skylark Intelligence",
  description: "Executive intelligence for Monday.com.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#09111f" },
  ],
};

const themeScript = `
try {
  const key = "skylark-theme";
  const saved = localStorage.getItem(key);
  const mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.classList.add("theme-ready");
} catch {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body className={`${inter.variable} ${manrope.variable}`}>{children}</body></html>;
}
