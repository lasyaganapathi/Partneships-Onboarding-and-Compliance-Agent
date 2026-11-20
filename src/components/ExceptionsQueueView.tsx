import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type {
  DiscrepancySeverity,
  PartnerRecord,
  StakeholderRole,
} from '../types/onboarding';
import { DiscrepancyStatusText, SeverityText } from './StatusLabel';

interface ExceptionsQueueViewProps {
  partners: PartnerRecord[];
  activeStakeholder: StakeholderRole;
  onOpenPartner: (partnerId: string) => void;
  onResolveDiscrepancy: (
    partnerId: string,
    discrepancyId: string,
    resolution: 'Resolved' | 'Waived',
    note: string,
  ) => void;
  onReassignDiscrepancy: (
    partnerId: string,
    discrepancyId: string,
    newOwner: StakeholderRole,
  ) => void;
  onApproveGate: (
    partnerId: string,
    stakeholder: StakeholderRole,
    note: string,
  ) => void;
}

const ROLE_FILTERS: Array<'All' | StakeholderRole> = [
  'All',
  'Operations',
  'Compliance',
  'Legal',
  'Partnerships',
  'Account Management',
];

const SEVERITY_FILTERS: Array<'All' | DiscrepancySeverity> = [
  'All',
  'Critical',
  'High',
  'Medium',
];

export function ExceptionsQueueView({
  partners,
  activeStakeholder,
  onOpenPartner,
  onResolveDiscrepancy,
  onReassignDiscrepancy,
  onApproveGate,
}: ExceptionsQueueViewProps) {
  const [roleFilter, setRoleFilter] = useState<'All' | StakeholderRole>('All');
  const [severityFilter, setSeverityFilter] = useState<'All' | DiscrepancySeverity>('All');
  const [showResolved, setShowResolved] = useState(false);

  const discrepancyRows = useMemo(() => {
    return partners.flatMap((partner) =>
      partner.discrepancies
        .filter((d) => {
          if (!showResolved && (d.status === 'Resolved' || d.status === 'Waived')) {
            return false;
          }
          if (roleFilter !== 'All' && d.assignedTo !== roleFilter) return false;
          if (severityFilter !== 'All' && d.severity !== severityFilter) return false;
          return true;
        })
        .map((discrepancy) => ({ partner, discrepancy })),
    );
  }, [partners, roleFilter, severityFilter, showResolved]);

  const pendingApprovals = useMemo(() => {
    return partners.flatMap((partner) =>
      partner.approvals
        .filter((gate) => {
          if (!gate.requiredForTier || gate.status === 'Approved') return false;
          if (roleFilter !== 'All' && gate.stakeholder !== roleFilter) return false;
          return true;
        })
        .map((gate) => ({
          partner,
          gate,
          openExceptionCount: partner.discrepancies.filter(
            (d) =>
              d.assignedTo === gate.stakeholder &&
              (d.status === 'Open' || d.status === 'In Review'),
          ).length,
        })),
    );
  }, [partners, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Routed Exceptions & Pending Approvals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Triage cross-document discrepancies and clear stakeholder sign-off gates across all partners.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRoleFilter(activeStakeholder)}
          className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          Filter to My Queue ({activeStakeholder})
        </button>
      </div>

      {/* Role & Severity Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
          {ROLE_FILTERS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === role
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value as 'All' | DiscrepancySeverity)
            }
            aria-label="Filter by severity"
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            {SEVERITY_FILTERS.map((sev) => (
              <option key={sev} value={sev}>
                {sev === 'All' ? 'All Severities' : `${sev} Severity`}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
            />
            <span>Include resolved</span>
          </label>
        </div>
      </div>

      {/* Routed Exceptions Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Discrepancy Exception Queue ({discrepancyRows.length})
          </h2>
        </div>

        {discrepancyRows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              No discrepancies in this queue
            </p>
            <p className="text-xs text-slate-500 mt-1">
              All routed discrepancies for the selected filters have been resolved or waived.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Partner & Issue</th>
                  <th className="py-3 px-4">Expected vs. Extracted</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Assigned Stakeholder</th>
                  <th className="py-3 px-4 text-right">SLA</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {discrepancyRows.map(({ partner, discrepancy }) => {
                  const isOpen =
                    discrepancy.status === 'Open' ||
                    discrepancy.status === 'In Review';
                  return (
                    <tr key={discrepancy.id} className="align-top hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 max-w-sm">
                        <button
                          type="button"
                          onClick={() => onOpenPartner(partner.id)}
                          className="font-semibold text-blue-700 hover:underline text-left"
                        >
                          {partner.legalName}
                        </button>
                        <div className="font-medium text-slate-900 mt-0.5">
                          {discrepancy.title}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {discrepancy.category} · <DiscrepancyStatusText status={discrepancy.status} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-slate-500">
                          Rule: <span className="font-mono text-slate-800">{discrepancy.expectedValue}</span>
                        </div>
                        <div className="text-red-700 mt-1">
                          Found: <span className="font-mono">{discrepancy.actualValue}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <SeverityText severity={discrepancy.severity} />
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={discrepancy.assignedTo}
                          disabled={!isOpen}
                          onChange={(e) =>
                            onReassignDiscrepancy(
                              partner.id,
                              discrepancy.id,
                              e.target.value as StakeholderRole,
                            )
                          }
                          aria-label="Assigned stakeholder"
                          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800 disabled:bg-slate-50"
                        >
                          {ROLE_FILTERS.filter((r) => r !== 'All').map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {isOpen ? `${discrepancy.slaHoursRemaining}h` : 'Closed'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isOpen ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onResolveDiscrepancy(
                                  partner.id,
                                  discrepancy.id,
                                  'Resolved',
                                  `Resolved in queue by ${activeStakeholder}.`,
                                )
                              }
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors whitespace-nowrap"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onResolveDiscrepancy(
                                  partner.id,
                                  discrepancy.id,
                                  'Waived',
                                  `Exception waived by ${activeStakeholder}.`,
                                )
                              }
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                            >
                              Waive
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenPartner(partner.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending Stakeholder Approval Gates */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-sm font-semibold text-slate-900">
            Pending Stakeholder Sign-Off Gates ({pendingApprovals.length})
          </h2>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No pending stakeholder approvals for the selected role filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {pendingApprovals.map(({ partner, gate, openExceptionCount }) => (
              <div
                key={`${partner.id}-${gate.stakeholder}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onOpenPartner(partner.id)}
                      className="font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {partner.legalName}
                    </button>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-semibold text-blue-700">{gate.stakeholder}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-500">{gate.approverName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {gate.notes || `Awaiting ${gate.stakeholder} review.`}
                    {openExceptionCount > 0 && (
                      <span className="text-red-700 font-medium ml-2">
                        ({openExceptionCount} open exception assigned)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPartner(partner.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                  >
                    Open Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onApproveGate(
                        partner.id,
                        gate.stakeholder,
                        `Signed off from queue by ${activeStakeholder}.`,
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
                  >
                    Approve Gate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
