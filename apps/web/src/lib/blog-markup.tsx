import Link from "next/link";
import type { ReactNode } from "react";

// A very small subset of Markdown: headings, lists, bold and links. It builds React
// elements, never HTML, so nothing typed into a post can run as code on the page.

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (chunk.startsWith("### ")) blocks.push({ kind: "h3", text: chunk.slice(4).trim() });
    else if (chunk.startsWith("## ")) blocks.push({ kind: "h2", text: chunk.slice(3).trim() });
    else if (chunk.split("\n").every((line) => line.trim().startsWith("- "))) {
      blocks.push({ kind: "ul", items: chunk.split("\n").map((line) => line.trim().slice(2).trim()) });
    } else blocks.push({ kind: "p", text: chunk });
  }
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    const key = `${index}`;
    if (match[1]) {
      nodes.push(<strong key={key} className="font-medium text-bone-50">{match[1]}</strong>);
    } else if (match[3].startsWith("/") && !match[3].startsWith("//")) {
      nodes.push(<Link key={key} href={match[3]} className="text-copper-400 underline underline-offset-4">{match[2]}</Link>);
    } else if (/^https:\/\//.test(match[3])) {
      nodes.push(<a key={key} href={match[3]} target="_blank" rel="noopener noreferrer" className="text-copper-400 underline underline-offset-4">{match[2]}</a>);
    } else {
      // Anything else, such as a script link, stays as its plain words.
      nodes.push(match[2]);
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function BlogBody({ body }: { body: string }) {
  return (
    <div className="mt-8 space-y-5 text-lg leading-relaxed text-bone-100">
      {parseBlocks(body).map((block, index) => {
        if (block.kind === "h2") return <h2 key={index} className="pt-6 text-3xl leading-tight text-bone-50 md:text-4xl">{block.text}</h2>;
        if (block.kind === "h3") return <h3 key={index} className="pt-2 text-xl text-bone-50 md:text-2xl">{block.text}</h3>;
        if (block.kind === "ul") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 marker:text-copper-400">
              {block.items.map((item) => <li key={item}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

const plainText = (text: string) =>
  text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");

/** Questions under a "Frequently asked questions" heading, which are visible on the page. */
export function extractFaqs(body: string): { question: string; answer: string }[] {
  const blocks = parseBlocks(body);
  const start = blocks.findIndex((block) => block.kind === "h2" && /frequently asked questions/i.test(block.text));
  if (start < 0) return [];
  const faqs: { question: string; answer: string }[] = [];
  for (const block of blocks.slice(start + 1)) {
    if (block.kind === "h2") break;
    if (block.kind === "h3") faqs.push({ question: block.text, answer: "" });
    else if (block.kind === "p" && faqs.length > 0) {
      const current = faqs[faqs.length - 1];
      current.answer = [current.answer, plainText(block.text)].filter(Boolean).join(" ");
    }
  }
  return faqs.filter(({ answer }) => answer);
}
