import {
  ClipboardCheck,
  FileCheck2,
  FolderKanban,
  History,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { StakeholderRole } from '../types/onboarding';

export type WorkspaceSection =
  | 'pipeline'
  | 'workspace'
  | 'exceptions'
  | 'rules'
  | 'audit';

interface SidebarProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  activeStakeholder: StakeholderRole;
  onSelectStakeholder: (role: StakeholderRole) => void;
  openExceptionsByRole: Record<StakeholderRole, number>;
  pendingApprovalsByRole: Record<StakeholderRole, number>;
  totalOpenExceptions: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const STAKEHOLDER_ROLES: StakeholderRole[] = [
  'Operations',
  'Compliance',
  'Legal',
  'Partnerships',
  'Account Management',
];

export function Sidebar({
  activeSection,
  onSelectSection,
  activeStakeholder,
  onSelectStakeholder,
  openExceptionsByRole,
  pendingApprovalsByRole,
  totalOpenExceptions,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: Array<{
    id: WorkspaceSection;
    label: string;
    icon: typeof FolderKanban;
    count?: number;
  }> = [
    { id: 'pipeline', label: 'Onboarding Pipeline', icon: FolderKanban },
    { id: 'workspace', label: 'Partner Workspace', icon: FileCheck2 },
    {
      id: 'exceptions',
      label: 'Exceptions & Approvals',
      icon: ClipboardCheck,
      count: totalOpenExceptions,
    },
    { id: 'rules', label: 'Requirements Config', icon: SlidersHorizontal },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 shrink-0">
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Accordia
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Workspace sections">
        <div className="px-2 pb-1.5 text-xs font-medium text-slate-500">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700 ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={`font-mono tabular-nums text-xs ${
                    isActive ? 'text-slate-200' : 'text-red-700 font-semibold'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-6 px-2 pb-1.5 text-xs font-medium text-slate-500 border-t border-slate-200 mt-5">
          Acting Stakeholder
        </div>
        <div className="space-y-0.5">
          {STAKEHOLDER_ROLES.map((role) => {
            const isSelected = activeStakeholder === role;
            const actionCount =
              (openExceptionsByRole[role] || 0) + (pendingApprovalsByRole[role] || 0);
            return (
              <button
                key={role}
                type="button"
                onClick={() => onSelectStakeholder(role)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  isSelected
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <span className="truncate">{role}</span>
                <span className="font-mono tabular-nums text-xs text-slate-500">
                  {actionCount}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500">
        Active reviewer role determines stakeholder sign-offs and audit attribution.
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-full">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
