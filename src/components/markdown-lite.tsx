export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  return <div className="answer-copy">{lines.map((line, index) => {
    const trimmed = line.replace(/^[-*]\s*/, "").replace(/^#{1,3}\s*/, "");
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
    return <p key={index} className={/^[-*]\s/.test(line) ? "answer-bullet" : ""}>
      {parts.map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}
    </p>;
  })}</div>;
}
