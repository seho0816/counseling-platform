import type { ReactNode } from 'react';

/** 원문에서 근거가 된 문장을 표시한다. (F-02-4 원문 대조) */
export default function HighlightedText({ text, snippets }: { text: string; snippets: string[] }) {
  const ranges: Array<[number, number]> = [];
  snippets.forEach((snippet) => {
    const start = text.indexOf(snippet);
    if (start >= 0) ranges.push([start, start + snippet.length]);
  });
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={index}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  parts.push(text.slice(cursor));

  return <p className="record-text">{parts}</p>;
}
