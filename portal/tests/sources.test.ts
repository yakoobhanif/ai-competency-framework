import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSources, crossrefMetadata, fetchSource, sourceUrls } from '../server/sources.js';

const withCrossref = async (reply: () => Response, run: () => Promise<void>) => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => reply();
  try {
    await run();
  } finally {
    globalThis.fetch = fetchBefore;
  }
};
const blocked = async () => {
  throw Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' });
};

test('links wrapped by PDF extraction are rejoined; ordinary line ends are left alone', () => {
  assert.deepEqual(
    sourceUrls(
      [
        'https://arxiv.org/abs/2408.16984 ',
        '[2] https://research.atspotify.',
        'com/publications/causal-models ',
        '[3] https://doi.org/10.1126/science.',
        'abp9364 ',
        'See https://example.org/a.',
        'the next sentence, and https://example.org/b.',
        '2. Second item',
      ].join('\n'),
    ),
    [
      'https://arxiv.org/abs/2408.16984',
      'https://research.atspotify.com/publications/causal-models',
      'https://doi.org/10.1126/science.abp9364',
      'https://example.org/a',
      'https://example.org/b',
    ],
  );
});

test('a redirect chain past the limit is a handled failure, not a crash', async () => {
  await assert.rejects(fetchSource('https://example.org/', 6), /too many redirects/);
  await withCrossref(
    () => Response.json({}, { status: 404 }),
    async () => {
      const [check] = await collectSources('https://example.org/a', (url) => fetchSource(url, 6));
      assert.deepEqual(check, {
        url: 'https://example.org/a',
        text: '',
        status: 'not_retrieved',
        reason: 'too many redirects',
      });
    },
  );
});

test('a blocked DOI falls back to Crossref metadata and keeps the reason', async () => {
  await withCrossref(
    () =>
      Response.json({
        message: {
          title: ['A study'],
          'container-title': ['A journal'],
          abstract: '<jats:p>What it <jats:italic>found</jats:italic>.</jats:p>',
        },
      }),
    async () => {
      const [check] = await collectSources('https://doi.org/10.1000/abc', blocked);
      assert.equal(check.status, 'metadata_only');
      assert.equal(check.reason, 'address not found');
      assert.equal(check.text, 'Title: A study\nPublished in: A journal\nAbstract: What it found.');
    },
  );
});

test('Crossref is only asked about DOIs, and its failures leave the source unretrieved', async () => {
  let calls = 0;
  await withCrossref(
    () => {
      calls++;
      return Response.json({}, { status: 503 });
    },
    async () => {
      assert.equal(await crossrefMetadata('https://example.org/10.1000/abc'), null);
      assert.equal(calls, 0);
      const [check] = await collectSources('https://doi.org/10.1000/abc', blocked);
      assert.equal(calls, 1);
      assert.equal(check.status, 'not_retrieved');
      assert.equal(check.text, '');
    },
  );
});

test('combined source text stays within the limit', async () => {
  const urls = Array.from({ length: 8 }, (_, i) => `https://example.org/${i}`).join('\n');
  const checks = await collectSources(urls, async (url) => ({
    url,
    text: 'x'.repeat(60000),
    status: 'partial',
  }));
  assert.equal(
    checks.reduce((n, c) => n + c.text.length, 0),
    300000,
  );
  assert.equal(checks[4].status, 'partial');
  assert.equal(checks[5].status, 'not_retrieved');
  assert.equal(checks[5].reason, 'the combined source limit was reached');
});
