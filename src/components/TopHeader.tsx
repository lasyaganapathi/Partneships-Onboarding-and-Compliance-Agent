import { Menu, Plus } from 'lucide-react';

interface TopHeaderProps {
  breadcrumbs: string[];
  onOpenIntakeModal: () => void;
  onOpenMobileNav: () => void;
}

export function TopHeader({
  breadcrumbs,
  onOpenIntakeModal,
  onOpenMobileNav,
}: TopHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb}-${index}`} className="flex items-center gap-2 min-w-0">
                {index > 0 && (
                  <span className="text-slate-300 select-none" aria-hidden="true">
                    /
                  </span>
                )}
                <span
                  className={`truncate ${
                    isLast ? 'font-semibold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {crumb}
                </span>
              </span>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenIntakeModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>New Partner Intake</span>
        </button>
      </div>
    </header>
  );
}
