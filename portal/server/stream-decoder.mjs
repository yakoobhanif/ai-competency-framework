import { parentPort, workerData } from 'node:worker_threads';
import { decode } from 'turbo-stream';

try {
  // This compatibility decoder only needs JSON containers and deferred values.
  // Reject arbitrary constructors, prototype keys and oversized reference tables.
  let slots = 0;
  for (const line of workerData.split('\n').filter(Boolean)) {
    const payload = line.replace(/^[PE]\d+:/, '');
    const entries = JSON.parse(payload);
    if (!Array.isArray(entries)) throw new Error('Unsupported stream record.');
    slots += entries.length;
    if (slots > 50000) throw new Error('Stream exceeds the structural limit.');
    for (const entry of entries) {
      if (typeof entry === 'string' && ['__proto__', 'constructor', 'prototype'].includes(entry))
        throw new Error('Unsupported stream key.');
      if (
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        !['P', 'Z', 'D'].includes(entry[0])
      )
        throw new Error('Unsupported stream value type.');
      if (
        Array.isArray(entry) &&
        ['P', 'Z'].includes(entry[0]) &&
        (!Number.isSafeInteger(entry[1]) || entry[1] < 0 || entry[1] > 50000)
      )
        throw new Error('Invalid stream reference.');
    }
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(workerData));
      controller.close();
    },
  });
  const decoded = await decode(stream);
  await decoded.done;
  const queue = [decoded.value],
    seen = new Set(),
    found = [];
  for (let i = 0; i < queue.length; i++) {
    if (i > 50000) throw new Error('Stream exceeds the structural limit.');
    const value = await queue[i];
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (value.mapping || value.linear_conversation) found.push(value);
    else queue.push(...Object.values(value));
  }
  if (found.length !== 1) throw new Error('No unique conversation found.');
  parentPort.postMessage({ value: found[0] });
} catch {
  parentPort.postMessage({
    error:
      'The streamed conversation could not be decoded safely. Upload a transcript file instead.',
  });
}
