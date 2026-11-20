import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  ShieldAlert,
} from 'lucide-react';
import type {
  DiscrepancySeverity,
  DiscrepancyStatus,
  PartnerStatus,
} from '../types/onboarding';

export function PartnerStatusText({ status }: { status: PartnerStatus }) {
  switch (status) {
    case 'Approved':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Approved</span>
        </span>
      );
    case 'Exceptions Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Exceptions Pending</span>
        </span>
      );
    case 'Pending Approvals':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Pending Approvals</span>
        </span>
      );
    case 'Agent Review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <FileSearch className="w-3.5 h-3.5 shrink-0" />
          <span>Agent Review</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
}

export function SeverityText({ severity }: { severity: DiscrepancySeverity }) {
  if (severity === 'Critical') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Critical</span>
      </span>
    );
  }
  if (severity === 'High') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>High</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Medium</span>
    </span>
  );
}

export function DiscrepancyStatusText({ status }: { status: DiscrepancyStatus }) {
  switch (status) {
    case 'Resolved':
      return <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">Resolved</span>;
    case 'Waived':
      return <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Waived</span>;
    case 'In Review':
      return <span className="text-xs font-medium text-amber-700 whitespace-nowrap">In Review</span>;
    default:
      return <span className="text-xs font-medium text-red-700 whitespace-nowrap">Open</span>;
  }
}
