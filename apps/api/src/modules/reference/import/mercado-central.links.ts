import { shiftDate } from '@indice/shared';

const MONTHS: Record<string, number> = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  SET: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
};

export interface ZipLink {
  url: string;
  fileName: string;
  year: number | null;
  month: number | null;
}

export function extractZipLinks(html: string, pageUrl: string): ZipLink[] {
  const seen = new Set<string>();
  const links: ZipLink[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+\.zip)["']/gi)) {
    const url = new URL(match[1]!, pageUrl).toString();
    const fileName = safeDecode(url.split('/').pop() ?? '');
    if (!/FRUT/i.test(fileName) || seen.has(url)) continue;
    seen.add(url);
    links.push({ url, fileName, ...zipMonth(fileName) });
  }
  return links;
}

export function zipMonth(fileName: string): { year: number | null; month: number | null } {
  const rest = fileName.toUpperCase().replace(/^.*?FRUT[A-Z]*/, '');
  const monthMatch = /(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)/.exec(rest);
  if (!monthMatch) return { year: null, month: null };
  const afterMonth = rest.slice(monthMatch.index + monthMatch[1]!.length);
  const yearMatch = /(?<!\d)(20\d{2}|\d{2})(?!\d)/.exec(afterMonth);
  if (!yearMatch) return { year: null, month: null };
  const year = Number(yearMatch[1]);
  return { year: year < 100 ? 2000 + year : year, month: MONTHS[monthMatch[1]!]! };
}

export function selectRecentZips(links: ZipLink[], today: string): ZipLink[] {
  const wanted = [today, shiftDate(`${today.slice(0, 7)}-01`, -1)].map((d) => ({
    year: Number(d.slice(0, 4)),
    month: Number(d.slice(5, 7)),
  }));
  return links.filter((l) => wanted.some((w) => w.year === l.year && w.month === l.month));
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
