import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export type CodeCheck = {
  status: 'Pass' | 'Fail' | 'Pending';
  detail: string;
  cases: number;
  durationMs?: number;
};
export function oracle(a: number[], b: number[]) {
  const x = Math.min(...a),
    y = Math.min(...b);
  return a.reduce((sum, v, i) => sum + Math.max(v - x, b[i] - y), 0);
}
export function testCases() {
  const cases = [
    { a: [1], b: [1] },
    { a: [7, 7], b: [9, 9] },
    { a: [2, 5], b: [4, 1] },
    { a: [1, 1e9, 1e9], b: [1e9, 1, 1e9] },
    {
      a: Array(50)
        .fill(1e9)
        .map((x, i) => (i === 0 ? 1 : x)),
      b: Array(50)
        .fill(1e9)
        .map((x, i) => (i === 1 ? 1 : x)),
    },
  ];
  let seed = 314159;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
  for (let i = 0; i < 95; i++) {
    const n = (rand() % 50) + 1;
    cases.push({
      a: Array.from({ length: n }, () => (rand() % 1000000000) + 1),
      b: Array.from({ length: n }, () => (rand() % 1000000000) + 1),
    });
  }
  return cases;
}
export async function runCode(source: string): Promise<CodeCheck> {
  const cases = testCases(),
    input =
      `${cases.length}\n` +
      cases.map((c) => `${c.a.length}\n${c.a.join(' ')}\n${c.b.join(' ')}\n`).join('');
  const name = `ai-assessment-${randomUUID()}`;
  const image = process.env.PYTHON_IMAGE || 'python:3.12-alpine';
  // No host mounts, credentials or network enter the execution container.
  const harness =
    'import sys,json,io\np=json.load(sys.stdin)\nsys.stdin=io.TextIOWrapper(io.BytesIO(p["input"].encode("utf-8")))\nexec(compile(p["source"],"solution.py","exec"),{"__name__":"__main__"})';
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(
      'docker',
      [
        'run',
        // Keep the timeout-controlled program out of PID 1, whose signal semantics
        // can otherwise prevent BusyBox's watchdog from terminating it.
        '--init',
        '--rm',
        '--pull=never',
        '--name',
        name,
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--pids-limit=32',
        '--memory=96m',
        '--cpus=0.5',
        '--user=65534:65534',
        '--tmpfs=/tmp:rw,noexec,nosuid,size=8m',
        '-i',
        image,
        'timeout',
        '-s',
        'KILL',
        '8s',
        'python',
        '-I',
        '-B',
        '-c',
        harness,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '',
      err = '',
      done = false,
      limited = false;
    const finish = (r: CodeCheck) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ ...r, durationMs: Date.now() - start });
      }
    };
    const killContainer = () => {
      const cleanup = spawn('docker', ['rm', '-f', name], { stdio: 'ignore' });
      cleanup.on('error', () => {});
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => {
      killContainer();
      finish({
        status: 'Pending',
        detail:
          'Execution timed out. Review required to distinguish infrastructure delay from excessive runtime.',
        cases: cases.length,
      });
    }, 15000);
    child.on('error', () =>
      finish({
        status: 'Pending',
        detail:
          'Docker is unavailable. Start Docker Desktop and prepare the Python image, then retry.',
        cases: 0,
      }),
    );
    child.stdout.on('data', (b) => {
      out += b.toString();
      if (out.length > 65536) {
        limited = true;
        killContainer();
      }
    });
    child.stderr.on('data', (b) => {
      err += b.toString();
      if (err.length > 65536) {
        limited = true;
        killContainer();
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ source, input }));
    child.on('close', (code) => {
      if (limited)
        return finish({
          status: 'Fail',
          detail: 'The program exceeded the output limit.',
          cases: cases.length,
        });
      if (
        [125, 126, 127].includes(code ?? -1) ||
        /daemon|permission denied|No such image|Cannot connect/i.test(err)
      )
        return finish({
          status: 'Pending',
          detail:
            'The isolated runner is unavailable. Start Docker Desktop and pull the configured Python image.',
          cases: 0,
        });
      if (code !== 0)
        return finish({
          status: 'Fail',
          detail: 'The submitted program did not finish successfully in the isolated runner.',
          cases: cases.length,
        });
      const got = out.trim().split(/\s+/),
        expected = cases.map((c) => String(oracle(c.a, c.b)));
      const ok =
        got.length === expected.length &&
        got.every((v, i) => /^\d+$/.test(v) && BigInt(v) === BigInt(expected[i]));
      finish({
        status: ok ? 'Pass' : 'Fail',
        detail: ok
          ? `${cases.length} deterministic ordinary, boundary and generated cases passed.`
          : 'Output did not match the trusted oracle or included extra text.',
        cases: cases.length,
      });
    });
  });
}
