"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("max-w-none", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-base font-semibold mt-4 mb-1 text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold mt-4 mb-1 text-foreground uppercase tracking-wide">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h3>,
        p: ({ children }) => <p className="text-sm leading-relaxed text-foreground mb-2">{children}</p>,
        ul: ({ children }) => <ul className="text-sm space-y-1 mb-2 pl-4 list-disc text-foreground">{children}</ul>,
        ol: ({ children }) => <ol className="text-sm space-y-1 mb-2 pl-4 list-decimal text-foreground">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic my-2">{children}</blockquote>
        ),
        code: ({ children, className: codeClass }) => {
          const isBlock = codeClass?.includes("language-")
          return isBlock ? (
            <pre className="bg-secondary border border-border rounded p-3 text-xs overflow-x-auto my-2">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-secondary border border-border px-1 py-0.5 text-xs rounded font-mono">{children}</code>
          )
        },
        hr: () => <hr className="border-border my-3" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:opacity-70">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
