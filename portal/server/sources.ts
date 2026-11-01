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
export async function fetchSource(
  raw: string,
  depth = 0,
): Promise<{ url: string; text: string; status: string }> {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    depth > 3
  )
    throw new Error('Unsupported source URL.');
  const addresses = await dns.lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((x) => !isPublicIp(x.address)))
    throw new Error('Only public HTTPS sources are permitted.');
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
      if (!response.headers.location) throw new Error('Source redirect has no destination.');
      return await fetchSource(new URL(String(response.headers.location), url).href, depth + 1);
    }
    if (
      response.statusCode !== 200 ||
      !/text\/(html|plain)/i.test(String(response.headers['content-type']))
    ) {
      await response.body.dump();
      throw new Error('Source is unavailable or needs manual review.');
    }
    let html = '';
    for await (const chunk of response.body) {
      html += chunk.toString();
      if (html.length > 1000000) throw new Error('Source exceeds the retrieval limit.');
    }
    const $ = load(html);
    $('script,style,nav,footer').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text.length > 60000)
      throw new Error('Full source exceeds context limit; reviewer should inspect it.');
    return { url: url.href, text, status: 'retrieved' };
  } finally {
    await agent.close();
  }
}
export async function collectSources(text: string) {
  const urls = [...new Set(text.match(/https:\/\/[^\s<>"\])]+/g) || [])]
    .map((s) => s.replace(/[.,;]+$/, ''))
    .slice(0, 8);
  const result = [];
  for (const url of urls) {
    try {
      result.push(await fetchSource(url));
    } catch {
      result.push({
        url,
        text: '',
        status: 'Review needed: source could not be independently retrieved.',
      });
    }
  }
  return result;
}
