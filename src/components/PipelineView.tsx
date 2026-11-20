import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type {
  PartnerRecord,
  PartnerStatus,
  PartnerTier,
  RequirementRule,
} from '../types/onboarding';
import {
  computeSuccessMetrics,
  evaluatePartnerCompleteness,
  getCompletenessPercentage,
} from '../utils/complianceEngine';
import { PartnerStatusText } from './StatusLabel';

interface PipelineViewProps {
  partners: PartnerRecord[];
  rules: RequirementRule[];
  onSelectPartner: (partnerId: string) => void;
  onOpenIntakeModal: () => void;
}

const STATUS_FILTERS: Array<'All' | PartnerStatus> = [
  'All',
  'Exceptions Pending',
  'Pending Approvals',
  'Agent Review',
  'Approved',
];

const TIER_FILTERS: Array<'All' | PartnerTier> = [
  'All',
  'Strategic Reseller',
  'Technology Integration',
  'Managed Service Provider',
  'Regional Distributor',
];

export function PipelineView({
  partners,
  rules,
  onSelectPartner,
  onOpenIntakeModal,
}: PipelineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PartnerStatus>('All');
  const [tierFilter, setTierFilter] = useState<'All' | PartnerTier>('All');

  const metrics = useMemo(() => computeSuccessMetrics(partners), [partners]);

  const enrichedPartners = useMemo(() => {
    return partners.map((partner) => {
      const completenessResults = evaluatePartnerCompleteness(partner, rules);
      const completenessPct = getCompletenessPercentage(completenessResults);
      const openExceptions = partner.discrepancies.filter(
        (d) => d.status === 'Open' || d.status === 'In Review',
      ).length;
      const pendingApprovers = partner.approvals
        .filter((a) => a.requiredForTier && a.status !== 'Approved')
        .map((a) => a.stakeholder);

      return {
        partner,
        completenessPct,
        satisfiedCount: completenessResults.filter((c) => c.status === 'Satisfied').length,
        totalRequired: completenessResults.length,
        openExceptions,
        pendingApprovers,
      };
    });
  }, [partners, rules]);

  const filteredPartners = useMemo(() => {
    return enrichedPartners.filter(({ partner }) => {
      if (statusFilter !== 'All' && partner.status !== statusFilter) return false;
      if (tierFilter !== 'All' && partner.tier !== tierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          partner.legalName.toLowerCase().includes(q) ||
          partner.tradingName.toLowerCase().includes(q) ||
          partner.region.toLowerCase().includes(q) ||
          partner.partnershipOwner.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [enrichedPartners, statusFilter, tierFilter, searchQuery]);

  const turnaroundReductionPct = Math.round(
    ((metrics.baselineTurnaroundDays - metrics.avgTurnaroundDays) /
      metrics.baselineTurnaroundDays) *
      100,
  );
  const manualTimeReductionPct = Math.round(
    ((metrics.baselineManualMinutes - metrics.avgManualMinutes) /
      metrics.baselineManualMinutes) *
      100,
  );
  const exceptionReductionPct = Math.round(
    ((metrics.baselineExceptionResolutionHours -
      metrics.avgExceptionResolutionHours) /
      metrics.baselineExceptionResolutionHours) *
      100,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Partner Onboarding Pipeline
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Automated document extraction, rule verification, exception routing, and cross-team approvals.
          </p>
        </div>
      </div>

      {/* Success Metrics Strip */}
      <section aria-label="Onboarding performance metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Onboarding Turnaround
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {metrics.avgTurnaroundDays}d
            </span>
            <span className="font-mono tabular-nums text-xs font-medium text-emerald-700">
              -{turnaroundReductionPct}% vs {metrics.baselineTurnaroundDays}d baseline
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Intake to multi-stakeholder clearance
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Manual Verification Time
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {metrics.avgManualMinutes}m
            </span>
            <span className="font-mono tabular-nums text-xs font-medium text-emerald-700">
              -{manualTimeReductionPct}% vs {metrics.baselineManualMinutes}m baseline
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Average human review per packet
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Exception Resolution Time
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {metrics.avgExceptionResolutionHours}h
            </span>
            <span className="font-mono tabular-nums text-xs font-medium text-emerald-700">
              -{exceptionReductionPct}% vs {metrics.baselineExceptionResolutionHours}h baseline
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Discrepancy flag to stakeholder sign-off
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Active Queue Load
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {metrics.openExceptionsCount}
            </span>
            <span className="font-mono tabular-nums text-xs font-medium text-slate-600">
              {metrics.pendingApprovalsCount} pending sign-offs
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Open routed exceptions across {partners.length} partners
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
            {STATUS_FILTERS.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner, owner, region..."
                aria-label="Search partners"
                className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
              />
            </div>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as 'All' | PartnerTier)}
              aria-label="Filter by partner tier"
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              {TIER_FILTERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier === 'All' ? 'All Partner Tiers' : tier}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* High-Density Partner Ledger Table */}
        {filteredPartners.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">
              No partner dossiers match your active filters
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your search criteria or initiate a new partner onboarding intake.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setTierFilter('All');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onOpenIntakeModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap"
              >
                New Partner Intake
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Partner Legal Entity</th>
                  <th className="py-3 px-4">Tier & Region</th>
                  <th className="py-3 px-4 text-right">Completeness</th>
                  <th className="py-3 px-4 text-right">Open Exceptions</th>
                  <th className="py-3 px-4">Pending Stakeholders</th>
                  <th className="py-3 px-4 text-right">Turnaround</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredPartners.map(
                  ({
                    partner,
                    completenessPct,
                    satisfiedCount,
                    totalRequired,
                    openExceptions,
                    pendingApprovers,
                  }) => (
                    <tr
                      key={partner.id}
                      onClick={() => onSelectPartner(partner.id)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {partner.legalName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {partner.partnershipOwner} · {partner.documents.length} docs uploaded
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{partner.tier}</div>
                        <div className="text-slate-500 mt-0.5">{partner.region}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                          {completenessPct}%
                        </div>
                        <div className="font-mono tabular-nums text-xs text-slate-500 mt-0.5">
                          {satisfiedCount}/{totalRequired} rules
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                        {openExceptions > 0 ? (
                          <span className="font-semibold text-red-700">
                            {openExceptions} open
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[210px] truncate">
                        {pendingApprovers.length > 0
                          ? pendingApprovers.join(' · ')
                          : 'All gates signed'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {partner.turnaroundDays.toFixed(1)}d
                      </td>
                      <td className="py-3.5 px-4">
                        <PartnerStatusText status={partner.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPartner(partner.id);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors whitespace-nowrap"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
