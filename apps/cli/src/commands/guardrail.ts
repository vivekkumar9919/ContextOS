import { getCliContext } from '../context.js';
import type { GuardrailType, GuardrailSeverity, GuardrailScope } from '@contextos/core';

export interface GuardrailCommandOptions {
  global?: boolean;
  title?: string;
  type?: string;
  severity?: string;
  pattern?: string;
  remediation?: string;
  policy?: string;
  command?: string;
  files?: string;
  agent?: string;
  bypass?: string;
}

export function handleGuardrail(action: string, arg1?: string, options: GuardrailCommandOptions = {}): void {
  const forceGlobal = Boolean(options.global);
  const ctx = getCliContext({ forceGlobal });

  switch (action) {
    case 'add': {
      const rule = arg1;
      if (!rule) {
        console.error('Error: Guardrail rule description is required.');
        process.exit(1);
      }

      const title = options.title || rule.slice(0, 40);
      const rawType = typeof options.type === 'string' ? options.type : 'INVARIANT';
      const type = (rawType.toUpperCase() || 'INVARIANT') as GuardrailType;
      const rawSeverity = typeof options.severity === 'string' ? options.severity : 'BLOCKER';
      const severity = (rawSeverity.toUpperCase() || 'BLOCKER') as GuardrailSeverity;
      const scope: GuardrailScope = forceGlobal ? 'GLOBAL' : 'LOCAL';
      const policyId = typeof options.policy === 'string' ? options.policy : 'p-human-only';


      const guardrail = ctx.guardrailRepo.create({
        projectId: forceGlobal ? '' : ctx.project.id,
        title,
        rule,
        type,
        severity,
        scope,
        pattern: options.pattern,
        remediation: options.remediation,
        policyId,
      });

      console.log(`Guardrail created [${guardrail.id}]:`);
      console.log(`  Title:       ${guardrail.title}`);
      console.log(`  Rule:        ${guardrail.rule}`);
      console.log(`  Type:        ${guardrail.type}`);
      console.log(`  Severity:    ${guardrail.severity}`);
      console.log(`  Scope:       ${guardrail.scope}`);
      console.log(`  Policy ID:   ${guardrail.policyId}`);
      if (guardrail.pattern) console.log(`  Pattern:     ${guardrail.pattern}`);
      if (guardrail.remediation) console.log(`  Remediation: ${guardrail.remediation}`);
      break;
    }

    case 'list': {
      let guardrails = ctx.guardrailRepo.findByProject(ctx.project.id, true);
      if (forceGlobal) {
        guardrails = guardrails.filter((g) => g.scope === 'GLOBAL');
      }
      if (options.type) {
        guardrails = guardrails.filter((g) => g.type === options.type?.toUpperCase());
      }

      if (guardrails.length === 0) {
        console.log('No guardrails found.');
        return;
      }

      console.log(`Active Guardrails (${guardrails.length}):`);
      for (const g of guardrails) {
        const scopeBadge = g.scope === 'GLOBAL' ? '[GLOBAL]' : '[LOCAL]';
        console.log(`\n${scopeBadge} [${g.id}] ${g.title} (${g.severity})`);
        console.log(`  Rule:        ${g.rule}`);
        console.log(`  Type:        ${g.type} | Policy: ${g.policyId}`);
        if (g.pattern) console.log(`  Pattern:     ${g.pattern}`);
        if (g.remediation) console.log(`  Alternative: ${g.remediation}`);
      }
      break;
    }

    case 'remove':
    case 'delete': {
      const id = arg1;
      if (!id) {
        console.error('Error: Guardrail ID is required.');
        process.exit(1);
      }

      const deleted = ctx.guardrailRepo.delete(id);
      if (!deleted) {
        console.error(`Error: Guardrail '${id}' not found.`);
        process.exit(1);
      }

      console.log(`Guardrail '${id}' removed successfully.`);
      break;
    }

    case 'check': {
      const files = options.files ? options.files.split(',').map((f) => f.trim()) : undefined;
      const result = ctx.guardrailRepo.checkGuardrails({
        command: options.command,
        files,
        agentName: options.agent || 'human',
        isHuman: !options.agent || options.agent.toLowerCase() === 'human',
        bypassReason: options.bypass,
        projectId: ctx.project.id,
      });

      if (result.allowed) {
        console.log(`PASS: ${result.summary}`);
      } else {
        console.error(`BLOCKED: ${result.summary}`);
        for (const v of result.violations) {
          console.error(`  - [${v.severity}] ${v.title}: ${v.message}`);
          if (v.remediation) {
            console.error(`    Remediation: ${v.remediation}`);
          }
        }
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Usage: contextos guardrail <add|list|remove|check> [args] [options]');
      console.log('Options:');
      console.log('  --global           Target machine-wide global storage (~/.contextos)');
      console.log('  --title <title>    Title for the guardrail');
      console.log('  --type <type>      INVARIANT, ACTION_BLOCK, or VERIFICATION_GATE');
      console.log('  --severity <lvl>   BLOCKER, WARNING, or INFO');
      console.log('  --pattern <regex>  Regex pattern for matching commands or files');
      console.log('  --remediation <msg> Remediation guidance explaining what to do instead');
      console.log('  --policy <id>      Policy ID (e.g. p-never, p-human-only, p-trusted-agents)');
      console.log('  --command <cmd>    Command to check');
      console.log('  --files <paths>    Comma-separated file paths to check');
      console.log('  --agent <name>     Agent name for check permission evaluation');
      console.log('  --bypass <reason>  Human bypass rationale');
      break;
  }
}
