import type {
  AuditEvent,
  CompletenessCheckResult,
  PartnerRecord,
  PartnerStatus,
  RequirementRule,
} from '../types/onboarding';

const REFERENCE_DATE_MS = new Date('2026-11-19T00:00:00Z').getTime();

function parseUsdAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  const mMatch = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:m|million)/i);
  if (mMatch) {
    return parseFloat(mMatch[1]) * 1_000_000;
  }
  const numMatch = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  return null;
}

function daysUntilDate(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return Math.round((parsed - REFERENCE_DATE_MS) / (1000 * 60 * 60 * 24));
}

export function evaluatePartnerCompleteness(
  partner: PartnerRecord,
  rules: RequirementRule[],
): CompletenessCheckResult[] {
  const activeRules = rules.filter(
    (r) => r.active && r.requiredForTiers.includes(partner.tier),
  );

  return activeRules.map((rule) => {
    const matchedDocument =
      partner.documents.find((doc) => doc.type === rule.documentType) ?? null;

    if (!matchedDocument) {
      return {
        rule,
        matchedDocument: null,
        missingFields: rule.mandatoryFields,
        coveragePass: rule.minCoverageUsd === null,
        validityPass: rule.minValidityDaysRemaining === null,
        status: 'Missing Document',
        failureReason: `Required ${rule.documentType} has not been uploaded.`,
      };
    }

    const fieldMap = new Map(
      matchedDocument.extractedFields.map((f) => [f.label.toLowerCase(), f.value]),
    );
    const keyMap = new Map(
      matchedDocument.extractedFields.map((f) => [f.key.toLowerCase(), f.value]),
    );

    const missingFields = rule.mandatoryFields.filter((reqField) => {
      const normalized = reqField.toLowerCase();
      for (const [label, val] of fieldMap.entries()) {
        if ((label.includes(normalized) || normalized.includes(label)) && val.trim().length > 0) {
          return false;
        }
      }
      for (const [key, val] of keyMap.entries()) {
        if (key.includes(normalized.replace(/\s+/g, '_')) && val.trim().length > 0) {
          return false;
        }
      }
      return true;
    });

    let coveragePass = true;
    let coverageFailure = '';
    if (rule.minCoverageUsd !== null) {
      const coverageFields = matchedDocument.extractedFields.filter((f) =>
        /coverage|limit|liability|aggregate/i.test(f.label),
      );
      const maxFound = coverageFields.reduce((max, f) => {
        const val = parseUsdAmount(f.value);
        return val !== null && val > max ? val : max;
      }, 0);
      if (coverageFields.length === 0 || maxFound < rule.minCoverageUsd) {
        coveragePass = false;
        coverageFailure = `Detected coverage ($${maxFound.toLocaleString()}) is below minimum $${rule.minCoverageUsd.toLocaleString()}.`;
      }
    }

    let validityPass = true;
    let validityFailure = '';
    if (rule.minValidityDaysRemaining !== null) {
      const expField = matchedDocument.extractedFields.find((f) =>
        /expir|valid through|end date|period end/i.test(f.label),
      );
      const remaining = daysUntilDate(expField?.value);
      if (remaining !== null && remaining < rule.minValidityDaysRemaining) {
        validityPass = false;
        validityFailure =
          remaining < 0
            ? `Document expired ${Math.abs(remaining)} days ago.`
            : `Only ${remaining} days validity remaining (minimum ${rule.minValidityDaysRemaining} days required).`;
      }
    }

    const reasons: string[] = [];
    if (missingFields.length > 0) {
      reasons.push(`Missing fields: ${missingFields.join(', ')}`);
    }
    if (!coveragePass && coverageFailure) reasons.push(coverageFailure);
    if (!validityPass && validityFailure) reasons.push(validityFailure);

    return {
      rule,
      matchedDocument,
      missingFields,
      coveragePass,
      validityPass,
      status: reasons.length === 0 ? 'Satisfied' : 'Incomplete / Failed Rule',
      failureReason: reasons.length > 0 ? reasons.join(' · ') : undefined,
    };
  });
}

export function getCompletenessPercentage(results: CompletenessCheckResult[]): number {
  if (results.length === 0) return 100;
  const satisfied = results.filter((r) => r.status === 'Satisfied').length;
  return Math.round((satisfied / results.length) * 100);
}

export function derivePartnerStatus(
  partner: PartnerRecord,
  completeness: CompletenessCheckResult[],
): PartnerStatus {
  if (partner.documents.length === 0) return 'Intake';

  const openDiscrepancies = partner.discrepancies.filter(
    (d) => d.status === 'Open' || d.status === 'In Review',
  );
  if (openDiscrepancies.length > 0) {
    return 'Exceptions Pending';
  }

  const hasMissingDocs = completeness.some((c) => c.status !== 'Satisfied');
  if (hasMissingDocs) {
    return 'Agent Review';
  }

  const requiredGates = partner.approvals.filter((a) => a.requiredForTier);
  const allApproved = requiredGates.every((a) => a.status === 'Approved');
  if (allApproved) {
    return 'Approved';
  }

  return 'Pending Approvals';
}

export interface SuccessMetricsSummary {
  avgTurnaroundDays: number;
  baselineTurnaroundDays: number;
  avgManualMinutes: number;
  baselineManualMinutes: number;
  avgExceptionResolutionHours: number;
  baselineExceptionResolutionHours: number;
  openExceptionsCount: number;
  pendingApprovalsCount: number;
}

export function computeSuccessMetrics(partners: PartnerRecord[]): SuccessMetricsSummary {
  const count = Math.max(partners.length, 1);
  const avgTurnaroundDays =
    Math.round(
      (partners.reduce((sum, p) => sum + p.turnaroundDays, 0) / count) * 10,
    ) / 10;

  const avgManualMinutes = Math.round(
    partners.reduce((sum, p) => sum + p.manualMinutesSpent, 0) / count,
  );

  const resolvedDiscrepancies = partners
    .flatMap((p) => p.discrepancies)
    .filter((d) => d.status === 'Resolved' || d.status === 'Waived');

  const avgExceptionResolutionHours =
    resolvedDiscrepancies.length > 0
      ? Math.round(
          (resolvedDiscrepancies.reduce((sum, d) => {
            if (!d.resolvedAt) return sum + 6.4;
            const diffHrs =
              (Date.parse(d.resolvedAt) - Date.parse(d.createdAt)) / (1000 * 60 * 60);
            return sum + Math.max(diffHrs, 0.5);
          }, 0) /
            resolvedDiscrepancies.length) *
            10,
        ) / 10
      : 5.8;

  const openExceptionsCount = partners
    .flatMap((p) => p.discrepancies)
    .filter((d) => d.status === 'Open' || d.status === 'In Review').length;

  const pendingApprovalsCount = partners
    .flatMap((p) => p.approvals)
    .filter((a) => a.requiredForTier && a.status !== 'Approved').length;

  return {
    avgTurnaroundDays,
    baselineTurnaroundDays: 11.4,
    avgManualMinutes,
    baselineManualMinutes: 96,
    avgExceptionResolutionHours,
    baselineExceptionResolutionHours: 36.5,
    openExceptionsCount,
    pendingApprovalsCount,
  };
}

export function exportAuditCsv(events: AuditEvent[]): void {
  const headers = [
    'Event ID',
    'Timestamp',
    'Partner',
    'Actor',
    'Actor Role',
    'Action Type',
    'Summary',
    'Details',
    'Reference ID',
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = events.map((ev) =>
    [
      ev.id,
      ev.timestamp,
      ev.partnerName,
      ev.actor,
      ev.actorRole,
      ev.actionType,
      ev.summary,
      ev.details,
      ev.referenceId,
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `accordia-compliance-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
