import { getCliContext } from '../context.js';
import type { BypassPolicyType } from '@contextos/core';

export interface PolicyCommandOptions {
  global?: boolean;
  type?: string;
  agents?: string;
  addAgent?: string;
  description?: string;
}

export function handlePolicy(action: string, arg1?: string, options: PolicyCommandOptions = {}): void {
  const forceGlobal = Boolean(options.global);
  const ctx = getCliContext({ forceGlobal });

  switch (action) {
    case 'list': {
      const policies = ctx.policyRepo.listAll();
      console.log(`Bypass Policies (${policies.length}):`);
      for (const p of policies) {
        console.log(`\n[${p.id}] ${p.name} (${p.policyType})`);
        if (p.description) console.log(`  Description:    ${p.description}`);
        const agents = p.allowedAgents.length > 0 ? p.allowedAgents.join(', ') : '(none)';
        console.log(`  Allowed Agents: ${agents}`);
      }
      break;
    }

    case 'add':
    case 'create': {
      const name = arg1;
      if (!name) {
        console.error('Error: Policy name is required.');
        process.exit(1);
      }

      const policyType = (options.type?.toUpperCase() || 'SPECIFIC_AGENTS') as BypassPolicyType;
      const allowedAgents = options.agents ? options.agents.split(',').map((a) => a.trim()) : [];

      const policy = ctx.policyRepo.create({
        name,
        description: options.description,
        policyType,
        allowedAgents,
      });

      console.log(`Bypass Policy created [${policy.id}]:`);
      console.log(`  Name:           ${policy.name}`);
      console.log(`  Type:           ${policy.policyType}`);
      console.log(`  Allowed Agents: ${policy.allowedAgents.join(', ') || '(none)'}`);
      break;
    }

    case 'update': {
      const id = arg1;
      if (!id) {
        console.error('Error: Policy ID is required.');
        process.exit(1);
      }

      const existing = ctx.policyRepo.findById(id);
      if (!existing) {
        console.error(`Error: Policy '${id}' not found.`);
        process.exit(1);
      }

      let allowedAgents = existing.allowedAgents;
      if (options.addAgent) {
        const toAdd = options.addAgent.trim().toLowerCase();
        if (!allowedAgents.map((a) => a.toLowerCase()).includes(toAdd)) {
          allowedAgents = [...allowedAgents, toAdd];
        }
      } else if (options.agents) {
        allowedAgents = options.agents.split(',').map((a) => a.trim());
      }

      const updated = ctx.policyRepo.update(id, {
        description: options.description,
        policyType: options.type ? (options.type.toUpperCase() as BypassPolicyType) : undefined,
        allowedAgents,
      });

      console.log(`Bypass Policy updated [${id}]:`);
      console.log(`  Name:           ${updated?.name}`);
      console.log(`  Type:           ${updated?.policyType}`);
      console.log(`  Allowed Agents: ${updated?.allowedAgents.join(', ') || '(none)'}`);
      break;
    }

    case 'remove':
    case 'delete': {
      const id = arg1;
      if (!id) {
        console.error('Error: Policy ID is required.');
        process.exit(1);
      }

      const deleted = ctx.policyRepo.delete(id);
      if (!deleted) {
        console.error(`Error: Policy '${id}' not found.`);
        process.exit(1);
      }

      console.log(`Bypass Policy '${id}' removed successfully.`);
      break;
    }

    default:
      console.log('Usage: contextos policy <list|add|update|remove> [args] [options]');
      console.log('Options:');
      console.log('  --global             Target machine-wide global storage (~/.contextos)');
      console.log('  --type <type>        NEVER, HUMAN_ONLY, SPECIFIC_AGENTS, or ANY_AGENT');
      console.log('  --agents <a1,a2>     Comma-separated list of allowed agent names');
      console.log('  --add-agent <name>   Add an agent to an existing policy');
      console.log('  --description <desc> Description of the policy purpose');
      break;
  }
}

