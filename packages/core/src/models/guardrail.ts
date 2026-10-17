export type GuardrailType = 'INVARIANT' | 'ACTION_BLOCK' | 'VERIFICATION_GATE';

export type GuardrailSeverity = 'BLOCKER' | 'WARNING' | 'INFO';

export type GuardrailScope = 'GLOBAL' | 'LOCAL';

export type BypassPolicyType = 'NEVER' | 'HUMAN_ONLY' | 'SPECIFIC_AGENTS' | 'ANY_AGENT';

export interface BypassPolicy {
  id: string;
  name: string;
  description?: string;
  policyType: BypassPolicyType;
  allowedAgents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Guardrail {
  id: string;
  projectId: string;
  title: string;
  rule: string;
  type: GuardrailType;
  severity: GuardrailSeverity;
  scope: GuardrailScope;
  pattern?: string;
  remediation?: string;
  policyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuardrailInput {
  id?: string;
  projectId?: string;
  title: string;
  rule: string;
  type?: GuardrailType;
  severity?: GuardrailSeverity;
  scope?: GuardrailScope;
  pattern?: string;
  remediation?: string;
  policyId?: string;
}

export interface UpdateGuardrailInput {
  title?: string;
  rule?: string;
  type?: GuardrailType;
  severity?: GuardrailSeverity;
  pattern?: string;
  remediation?: string;
  policyId?: string;
}

export interface GuardrailViolation {
  guardrailId: string;
  title: string;
  rule: string;
  type: GuardrailType;
  severity: GuardrailSeverity;
  policyId: string;
  policyType: BypassPolicyType;
  message: string;
  remediation?: string;
  bypassed?: boolean;
  bypassReason?: string;
  authorizedBy?: string;
}

export interface GuardrailCheckResult {
  allowed: boolean;
  violations: GuardrailViolation[];
  bypassed: boolean;
  summary: string;
}
