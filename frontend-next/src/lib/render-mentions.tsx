import type { ReactNode } from "react";

/** Split chat body into text + highlighted @mentions */
export function renderMessageWithMentions(body: string): ReactNode[] {
  const parts = body.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span key={i} className="font-medium text-emerald-300/95">
          {part}
        </span>
      );
    }
    return part;
  });
}
