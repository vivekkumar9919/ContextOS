import { getCliContext } from '../context.js';
import { logSuccess, logError, logInfo, colors } from '../ui.js';

export interface DecisionCommandOptions {
  subcommand?: string;
  title?: string;
  rationale?: string;
  files?: string;
  old?: string;
  new?: string;
  global?: boolean;
}

export function handleDecision(options: DecisionCommandOptions): void {
  const ctx = getCliContext({ forceGlobal: Boolean(options.global) });
  const sub = options.subcommand || 'list';

  switch (sub) {
    case 'add': {
      if (!options.title || !options.rationale) {
        logError('Adding a decision requires both --title and --rationale flags.');
        console.log(`Example: ${colors.dim('contextos decision add --title "Use WAL Mode" --rationale "Enables concurrent readers"')}`);
        return;
      }

      const relatedFiles = options.files
        ? options.files.split(',').map((f) => f.trim()).filter(Boolean)
        : [];

      const dec = ctx.decisionRepo.create({
        projectId: ctx.project.id,
        title: options.title,
        rationale: options.rationale,
        status: 'ACTIVE',
        relatedFiles,
      });

      logSuccess(`Decision recorded: ${colors.bold(dec.title)} [ID: ${dec.id}]`);
      console.log(`  Rationale: ${dec.rationale}`);
      if (dec.relatedFiles.length > 0) {
        console.log(`  Files:     ${dec.relatedFiles.join(', ')}`);
      }
      break;
    }

    case 'supersede': {
      if (!options.old || !options.new) {
        logError('Superseding a decision requires both --old <old_id> and --new <new_id> flags.');
        return;
      }

      try {
        ctx.decisionRepo.supersede(options.old, options.new);
        logSuccess(`Decision ${colors.dim(options.old)} is now superseded by ${colors.bold(options.new)}.`);
      } catch (err: any) {
        logError(`Failed to supersede decision: ${err.message}`);
      }
      break;
    }

    case 'list':
    default: {
      const decisions = ctx.decisionRepo.listAllByProject(ctx.project.id);
      if (decisions.length === 0) {
        logInfo('No architectural decisions recorded yet for this project.');
        return;
      }

      console.log(`\n${colors.bold('Decisions for Project:')} ${colors.cyan(ctx.projectName)}\n`);
      for (const d of decisions) {
        const statusTag =
          d.status === 'ACTIVE'
            ? colors.green('[ACTIVE]')
            : colors.yellow(`[${d.status}]`);
        console.log(`• ${statusTag} ${colors.bold(d.title)}`);
        console.log(`  ID:        ${colors.dim(d.id)}`);
        console.log(`  Rationale: ${d.rationale}`);
        if (d.relatedFiles.length > 0) {
          console.log(`  Files:     ${d.relatedFiles.join(', ')}`);
        }
        if (d.supersededById) {
          console.log(`  Superseded By: ${colors.dim(d.supersededById)}`);
        }
        console.log('');
      }
      break;
    }
  }
}
