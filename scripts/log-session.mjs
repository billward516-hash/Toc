import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, platform, tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const USAGE = `usage: node scripts/log-session.mjs <start|end|note|week> ["text"] [--device="..."] [--reason="..."]
       node scripts/log-session.mjs show`;
const TITLES = { start: 'Session start', end: 'Session end', note: 'Note', week: 'Weekly checkpoint' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const root = run('git', ['rev-parse', '--show-toplevel']).trim();
const logDir = join(root, 'independence');
const entriesDir = join(logDir, 'entries');
const config = JSON.parse(readFileSync(join(logDir, 'config.json'), 'utf8'));

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [key, ...value] = a.slice(2).split('=');
    return [key, value.join('=')];
  }),
);
const [kind, ...words] = args.filter((a) => !a.startsWith('--'));
const text = words.join(' ').trim();

if (kind === 'show') {
  show();
} else if (!Object.hasOwn(TITLES, kind)) {
  fail(USAGE);
} else if (kind !== 'start' && !text) {
  fail(`"${kind}" needs a description.\n${USAGE}`);
} else {
  record();
}

function record() {
  const now = new Date();
  const iso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const local = localParts(now);
  const hours = employerHours(local);
  const sessionId = process.env.CLAUDE_CODE_REMOTE_SESSION_ID;
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const head = run('git', ['rev-parse', 'HEAD']).trim();
  const dirty = run('git', ['status', '--porcelain']).trim() !== '';
  const localTime = config.timezone
    ? new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, dateStyle: 'full', timeStyle: 'long' }).format(now)
    : 'timezone not configured';

  const lines = [
    `# ${TITLES[kind]} · ${iso.replace('T', ' ').replace('Z', ' UTC')} · ${week(local.date)}`,
    '',
    `- **Recorded (UTC):** ${iso}`,
    `- **${config.timezone ? `Time in ${config.timezone}` : 'Local time'}:** ${localTime}`,
    `- **Employer hours:** ${hours.line}`,
    `- **Where the work runs:** ${where()}`,
    ...(sessionId ? [`- **Claude session:** https://claude.ai/code/session_${sessionId.replace(/^cse_/, '')}`] : []),
    `- **Access device (owner-attested):** ${flags.device || config.defaultDevice || 'not specified'}`,
    `- **Repository:** \`${branch}\` at \`${head}\`, ${dirty ? 'with uncommitted changes' : 'working tree clean'}`,
    ...(text ? ['', text] : []),
    '',
  ];

  mkdirSync(entriesDir, { recursive: true });
  const file = join(entriesDir, `${iso.replace(/[-:]/g, '')}-${kind}.md`);
  // 'wx' refuses to overwrite an existing file: entries are append-only.
  writeFileSync(file, lines.join('\n'), { flag: 'wx' });

  console.log(`Wrote ${relative(root, file)}`);
  console.log(`Independent timestamp: ${timestamp(file)}`);
  if (hours.flagged) console.error('FLAG: this entry falls inside configured employer hours. Record why (--reason, or a note entry).');
  console.log("Next: commit independence/ and push now, so GitHub's push time corroborates this entry.");
}

function localParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone || 'UTC',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS.indexOf(parts.weekday) + 1,
  };
}

function week(localDate) {
  const days = (Date.parse(localDate) - Date.parse(config.projectStart)) / 86_400_000;
  return days < 0 ? 'before project start' : `Week ${Math.floor(days / 7) + 1}`;
}

function employerHours({ date, weekday, time }) {
  const hours = config.employerHours;
  if (!hours || !config.timezone) {
    return { line: 'not configured (set timezone and employerHours in independence/config.json)' };
  }
  const span = `${hours.days.map((d) => WEEKDAYS[d - 1]).join(', ')} ${hours.start}–${hours.end} ${config.timezone}`;
  if (!hours.days.includes(weekday) || time < hours.start || time >= hours.end) {
    return { line: `outside (${span})` };
  }
  const off = (config.timeOff ?? []).find((t) => date >= t.from && date <= t.to);
  if (off) return { line: `inside usual hours (${span}), on time off: ${off.reason}, ${off.from} to ${off.to}` };
  return {
    flagged: true,
    line: `FLAG, inside configured employer hours (${span}). Reason: ${flags.reason || 'not given; add a note entry'}`,
  };
}

function where() {
  if (process.env.CLAUDE_CODE_REMOTE !== 'true') return `local machine \`${hostname()}\` (${platform()})`;
  const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT;
  const via = entrypoint === 'remote_mobile' ? 'the Claude mobile app' : entrypoint || 'an unknown client';
  const spawned = Number(process.env.CCR_SPAWN_TIMESTAMP_MS);
  const started = spawned ? new Date(spawned).toISOString().replace(/\.\d{3}Z$/, 'Z') : 'unknown';
  return `Claude Code cloud session, opened via ${via}; container started ${started}`;
}

function timestamp(file) {
  if (!config.tsaUrl) return 'skipped (no tsaUrl in config)';
  const tmp = mkdtempSync(join(tmpdir(), 'tsq-'));
  const query = join(tmp, 'request.tsq');
  const token = `${file}.tsr`;
  try {
    run('openssl', ['ts', '-query', '-data', file, '-sha256', '-cert', '-out', query]);
    run('curl', ['-sSf', '-m', '30', '-H', 'Content-Type: application/timestamp-query', '--data-binary', `@${query}`, '-o', token, config.tsaUrl]);
    const reply = run('openssl', ['ts', '-reply', '-in', token, '-text']);
    if (!reply.includes('Status: Granted')) throw new Error('the authority did not grant the request');
    return `${reply.match(/Time stamp: (.+)/)[1]} from ${config.tsaUrl}, saved as ${relative(root, token)}`;
  } catch (error) {
    rmSync(token, { force: true });
    return `unavailable (${String(error.stderr || error.message).trim().split('\n').pop()})`;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function show() {
  const sections = [readFileSync(join(logDir, 'README.md'), 'utf8')];
  const names = existsSync(entriesDir) ? readdirSync(entriesDir).filter((n) => n.endsWith('.md')).sort() : [];
  for (const name of names) {
    const stamped = existsSync(join(entriesDir, `${name}.tsr`)) ? 'independent timestamp attached' : 'no independent timestamp';
    sections.push(`${readFileSync(join(entriesDir, name), 'utf8')}\n_${name}: ${stamped}_\n`);
  }
  process.stdout.write(sections.join('\n---\n\n'));
}

function run(command, commandArgs) {
  return execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
