import { parseArgs } from 'node:util';
import { handleInit } from './commands/init.js';
import { handleStatus } from './commands/status.js';
import { handleTask } from './commands/task.js';
import { handleDecision } from './commands/decision.js';
import { handleHandoff } from './commands/handoff.js';
import { handleClean } from './commands/clean.js';
import { banner, colors } from './ui.js';

export function printHelp(): void {
  console.log(banner());
  console.log(`${colors.bold('USAGE:')}`);
  console.log(`  $ contextos <command> [subcommand] [options]\n`);

  console.log(`${colors.bold('COMMANDS:')}`);
  console.log(`  ${colors.green('init')} [--local]`);
  console.log(`      Initialize ContextOS storage (global in ~/.contextos or local in .contextos).\n`);

  console.log(`  ${colors.green('status')}`);
  console.log(`      Display active project, task progress, git working tree, and decisions.\n`);

  console.log(`  ${colors.green('task')} <create|update|complete|clear|list>`);
  console.log(`      Manage task lifecycle, constraints, checklists, and blockers.`);
  console.log(`      Options: --title, --goal, --status, --constraints, --remaining, --item, --blocker\n`);

  console.log(`  ${colors.green('decision')} <add|supersede|list>`);
  console.log(`      Record architectural invariants and manage supersession DAG.`);
  console.log(`      Options: --title, --rationale, --files, --old, --new\n`);

  console.log(`  ${colors.green('handoff')} [--from <agent>] [--to <agent>] [--phase <phase>] [--no-copy]`);
  console.log(`      Compile bounded Markdown handoff to .contextos/handoffs/latest.md and clipboard.\n`);

  console.log(`  ${colors.green('clean')} [--project|--all]`);
  console.log(`      Wipe the active project or remove local ContextOS files.\n`);

  console.log(`  ${colors.green('help')} | ${colors.green('--help')}`);
  console.log(`      Display this help documentation.\n`);
}

export function runCli(argv: string[] = process.argv.slice(2)): void {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
    printHelp();
    return;
  }

  if (argv.includes('--version') || argv.includes('-v')) {
    console.log('contextos v1.0.0');
    return;
  }

  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      local: { type: 'boolean' },
      project: { type: 'boolean' },
      all: { type: 'boolean' },
      from: { type: 'string' },
      to: { type: 'string' },
      phase: { type: 'string' },
      noCopy: { type: 'boolean' },
      title: { type: 'string' },
      goal: { type: 'string' },
      status: { type: 'string' },
      blocker: { type: 'string' },
      clearBlocker: { type: 'boolean' },
      constraints: { type: 'string' },
      remaining: { type: 'string' },
      item: { type: 'string' },
      id: { type: 'string' },
      rationale: { type: 'string' },
      files: { type: 'string' },
      old: { type: 'string' },
      new: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0];
  const subcommand = positionals[1];

  switch (command) {
    case 'init':
      handleInit({ local: Boolean(values.local) });
      break;

    case 'status':
      handleStatus();
      break;

    case 'task':
      handleTask({
        subcommand,
        id: values.id as string,
        title: values.title as string,
        goal: values.goal as string,
        status: values.status as string,
        blocker: values.blocker as string,
        clearBlocker: Boolean(values.clearBlocker),
        constraints: values.constraints as string,
        remaining: values.remaining as string,
        item: values.item as string,
      });
      break;

    case 'decision':
      handleDecision({
        subcommand,
        title: values.title as string,
        rationale: values.rationale as string,
        files: values.files as string,
        old: values.old as string,
        new: values.new as string,
      });
      break;

    case 'handoff':
      handleHandoff({
        from: values.from as string,
        to: values.to as string,
        phase: values.phase as string,
        noCopy: Boolean(values.noCopy),
      });
      break;

    case 'clean':
      handleClean({
        project: Boolean(values.project),
        all: Boolean(values.all),
      });
      break;

    default:
      console.error(colors.red(`Unknown command: '${command}'`));
      console.log(`Run ${colors.bold('contextos --help')} for available commands.`);
      process.exitCode = 1;
      break;
  }
}
