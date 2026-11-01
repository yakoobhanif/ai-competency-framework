import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, request } from 'undici';
import { load } from 'cheerio';

export function isPublicIp(ip: string) {
  if (net.isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export type SourceCheck = {
  url: string;
  text: string;
  status: 'retrieved' | 'partial' | 'metadata_only' | 'not_retrieved';
  reason?: string;
};
const pageLimit = 60000;
const totalLimit = 300000;
class SourceError extends Error {}
const failure = (status: number) =>
  [401, 403, 429].includes(status)
    ? 'blocked by the source site'
    : [404, 410].includes(status)
      ? 'page not found'
      : 'source site returned an error';
function failureReason(error: any) {
  if (error instanceof SourceError) return error.message;
  if (error?.code === 'ENOTFOUND') return 'address not found';
  if (error?.name === 'TimeoutError' || /TIMEOUT/.test(String(error?.code))) return 'timed out';
  return 'could not be reached';
}
export async function fetchSource(raw: string, depth = 0): Promise<SourceCheck> {
  const url = new URL(raw);
  if (depth > 5) throw new SourceError('too many redirects');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new SourceError('link is not a standard public HTTPS address');
  const addresses = await dns.lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((x) => !isPublicIp(x.address)))
    throw new SourceError('link is not a standard public HTTPS address');
  const address = addresses[0].address;
  // Pin the checked DNS address so a rebind cannot reach a local service.
  const agent = new Agent({
    connect: {
      autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    },
  });
  try {
    const response = await request(url, {
      dispatcher: agent,
      headersTimeout: 8000,
      bodyTimeout: 8000,
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'AICompetencyResearch/1.0', accept: 'text/html,text/plain' },
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      await response.body.dump();
      if (!response.headers.location) throw new SourceError('source site returned an error');
      return await fetchSource(new URL(String(response.headers.location), url).href, depth + 1);
    }
    if (response.statusCode !== 200) {
      await response.body.dump();
      throw new SourceError(failure(response.statusCode));
    }
    if (!/text\/(html|plain)/i.test(String(response.headers['content-type']))) {
      await response.body.dump();
      throw new SourceError('source is not a readable web page');
    }
    let html = '';
    for await (const chunk of response.body) {
      html += chunk.toString();
      if (html.length > 1000000) throw new SourceError('page is too large to retrieve');
    }
    const $ = load(html);
    $('script,style,nav,footer').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text.length > pageLimit
      ? {
          url: url.href,
          text: text.slice(0, pageLimit),
          status: 'partial',
          reason: 'only the start of the page is supplied',
        }
      : { url: url.href, text, status: 'retrieved' };
  } finally {
    await agent.close();
  }
}
// Crossref is the public DOI registry, so a blocked publisher page can still be identified.
export async function crossrefMetadata(raw: string): Promise<string | null> {
  const url = new URL(raw);
  const doi = decodeURIComponent(url.pathname.slice(1));
  if (!['doi.org', 'dx.doi.org'].includes(url.hostname) || !/^10\.\d{4,}\/\S+$/.test(doi))
    return null;
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'AICompetencyResearch/1.0' },
    });
    if (!response.ok) return null;
    const { message } = (await response.json()) as { message?: any };
    const title = message?.title?.[0];
    if (typeof title !== 'string' || !title.trim()) return null;
    const details = [`Title: ${title.trim()}`];
    if (message['container-title']?.[0])
      details.push(`Published in: ${message['container-title'][0]}`);
    if (typeof message.abstract === 'string') {
      const abstract = load(message.abstract).text().replace(/\s+/g, ' ').trim();
      if (abstract) details.push(`Abstract: ${abstract.slice(0, 5000)}`);
    }
    return details.join('\n');
  } catch {
    return null;
  }
}
// PDF text breaks long links at the line end; a following word must look like a link's remainder.
export const sourceUrls = (text: string) =>
  [
    ...new Set(
      (
        text
          .replace(
            /(https:\/\/[^\s<>"\])]*[./\-_=?&%#])\r?\n(?=[a-z0-9][^\s<>"\])]*[/\d-])/gi,
            '$1',
          )
          .match(/https:\/\/[^\s<>"\])]+/g) || []
      ).map((s) => s.replace(/[.,;]+$/, '')),
    ),
  ].slice(0, 8);
export async function collectSources(text: string, fetcher = fetchSource) {
  const result: SourceCheck[] = [];
  let remaining = totalLimit;
  for (const url of sourceUrls(text)) {
    let check: SourceCheck;
    try {
      check = await fetcher(url);
    } catch (error) {
      const reason = failureReason(error);
      const metadata = await crossrefMetadata(url).catch(() => null);
      check = metadata
        ? { url, text: metadata, status: 'metadata_only', reason }
        : { url, text: '', status: 'not_retrieved', reason };
    }
    if (check.text.length > remaining) {
      check = {
        ...check,
        text: check.text.slice(0, remaining),
        status: check.text && remaining ? 'partial' : 'not_retrieved',
        reason: 'the combined source limit was reached',
      };
    }
    remaining -= check.text.length;
    result.push(check);
  }
  return result;
}
