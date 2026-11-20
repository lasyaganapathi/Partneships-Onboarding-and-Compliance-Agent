import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type {
  AuditActionType,
  AuditEvent,
  PartnerRecord,
  StakeholderRole,
} from '../types/onboarding';
import { exportAuditCsv } from '../utils/complianceEngine';

interface AuditTrailViewProps {
  events: AuditEvent[];
  partners: PartnerRecord[];
  onOpenPartner: (partnerId: string) => void;
}

const ACTION_TYPES: Array<'All' | AuditActionType> = [
  'All',
  'Partner Intake',
  'Document Uploaded',
  'Agent Extraction',
  'Rule Validation',
  'Discrepancy Flagged',
  'Exception Routed',
  'Exception Resolved',
  'Stakeholder Approval',
  'Requirement Updated',
  'Partner Onboarded',
];

const ACTOR_ROLES: Array<'All' | StakeholderRole | 'Compliance Agent'> = [
  'All',
  'Compliance Agent',
  'Operations',
  'Compliance',
  'Legal',
  'Partnerships',
  'Account Management',
];

export function AuditTrailView({
  events,
  partners,
  onOpenPartner,
}: AuditTrailViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState<'All' | StakeholderRole | 'Compliance Agent'>('All');
  const [actionFilter, setActionFilter] = useState<'All' | AuditActionType>('All');

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (partnerFilter !== 'All' && ev.partnerId !== partnerFilter) return false;
      if (roleFilter !== 'All' && ev.actorRole !== roleFilter) return false;
      if (actionFilter !== 'All' && ev.actionType !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          ev.partnerName.toLowerCase().includes(q) ||
          ev.summary.toLowerCase().includes(q) ||
          ev.details.toLowerCase().includes(q) ||
          ev.actor.toLowerCase().includes(q) ||
          ev.referenceId.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [events, partnerFilter, roleFilter, actionFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Compliance & Decision Audit Trail
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Immutable chronological record of document ingestions, agent extractions, exception routings, rule edits, and stakeholder sign-offs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportAuditCsv(filteredEvents)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit CSV ({filteredEvents.length})</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference ID, summary, actor, details..."
            aria-label="Search audit events"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            aria-label="Filter by partner"
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            <option value="All">All Partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.legalName}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as 'All' | StakeholderRole | 'Compliance Agent')
            }
            aria-label="Filter by actor role"
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            {ACTOR_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === 'All' ? 'All Actor Roles' : r}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as 'All' | AuditActionType)}
            aria-label="Filter by action type"
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Action Types' : t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No audit events match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4">Actor & Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Summary & Evidence</th>
                  <th className="py-3 px-4 text-right">Reference ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {ev.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {ev.partnerId === 'system' ? (
                        <span className="text-slate-700 font-medium">{ev.partnerName}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenPartner(ev.partnerId)}
                          className="font-semibold text-blue-700 hover:underline text-left"
                        >
                          {ev.partnerName}
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{ev.actor}</div>
                      <div className="text-slate-500 mt-0.5">{ev.actorRole}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                      {ev.actionType}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-medium text-slate-900">{ev.summary}</div>
                      <div className="text-slate-600 mt-0.5 leading-relaxed">
                        {ev.details}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {ev.referenceId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
