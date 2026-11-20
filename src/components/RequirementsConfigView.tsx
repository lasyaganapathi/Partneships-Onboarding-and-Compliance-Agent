import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type {
  DocumentType,
  PartnerTier,
  RequirementRule,
  StakeholderRole,
} from '../types/onboarding';

interface RequirementsConfigViewProps {
  rules: RequirementRule[];
  onUpdateRule: (rule: RequirementRule) => void;
  onAddRule: (rule: RequirementRule) => void;
  onReevaluateAllPartners: () => void;
}

const ALL_TIERS: PartnerTier[] = [
  'Strategic Reseller',
  'Technology Integration',
  'Regional Distributor',
  'Managed Service Provider',
];

const ALL_DOC_TYPES: DocumentType[] = [
  'W-9 / Tax Form',
  'Certificate of Insurance',
  'Master Services Agreement',
  'SOC 2 Type II Report',
  'KYC / Beneficial Ownership',
  'Data Processing Addendum',
];

const ALL_OWNERS: StakeholderRole[] = [
  'Operations',
  'Compliance',
  'Legal',
  'Partnerships',
  'Account Management',
];

export function RequirementsConfigView({
  rules,
  onUpdateRule,
  onAddRule,
  onReevaluateAllPartners,
}: RequirementsConfigViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDocType, setNewDocType] = useState<DocumentType>('KYC / Beneficial Ownership');
  const [newOwner, setNewOwner] = useState<StakeholderRole>('Compliance');
  const [newFields, setNewFields] = useState('Legal Entity Name, Jurisdiction');
  const [newMinCoverage, setNewMinCoverage] = useState('');
  const [newMinValidity, setNewMinValidity] = useState('');
  const [newTiers, setNewTiers] = useState<PartnerTier[]>([
    'Strategic Reseller',
    'Managed Service Provider',
  ]);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const rule: RequirementRule = {
      id: `rule-${Date.now()}`,
      name: newName.trim(),
      documentType: newDocType,
      requiredForTiers: newTiers.length > 0 ? newTiers : ALL_TIERS,
      mandatoryFields: newFields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      minCoverageUsd: newMinCoverage ? Number(newMinCoverage) : null,
      minValidityDaysRemaining: newMinValidity ? Number(newMinValidity) : null,
      defaultOwner: newOwner,
      active: true,
      description: `Custom compliance rule for ${newDocType} routed to ${newOwner}.`,
    };
    onAddRule(rule);
    setNewName('');
    setNewMinCoverage('');
    setNewMinValidity('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Configurable Onboarding Requirements
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Define required document types, mandatory extracted fields, insurance/validity thresholds, and exception routing owners.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              onReevaluateAllPartners();
              setRecalcMessage(
                'Re-evaluated completeness and rule thresholds across all active partner dossiers.',
              );
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-evaluate Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Requirement Rule</span>
          </button>
        </div>
      </div>

      {recalcMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
          {recalcMessage}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleCreateRule}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="text-sm font-semibold text-slate-900">
            New Configurable Compliance Rule
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Enhanced Sanctions Attestation"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Target Document Type
              </label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as DocumentType)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
              >
                {ALL_DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Default Exception Owner
              </label>
              <select
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value as StakeholderRole)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
              >
                {ALL_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mandatory Fields (comma-separated)
              </label>
              <input
                type="text"
                value={newFields}
                onChange={(e) => setNewFields(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Min Coverage USD (optional)
              </label>
              <input
                type="number"
                value={newMinCoverage}
                onChange={(e) => setNewMinCoverage(e.target.value)}
                placeholder="e.g. 5000000"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Min Validity Days Remaining (optional)
              </label>
              <input
                type="number"
                value={newMinValidity}
                onChange={(e) => setNewMinValidity(e.target.value)}
                placeholder="e.g. 30"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1.5">
              Applies to Partner Tiers
            </div>
            <div className="flex flex-wrap gap-3">
              {ALL_TIERS.map((tier) => {
                const checked = newTiers.includes(tier);
                return (
                  <label
                    key={tier}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setNewTiers((prev) =>
                          checked ? prev.filter((t) => t !== tier) : [...prev, tier],
                        )
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    <span>{tier}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
            >
              Save Requirement Rule
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {rules.map((rule) => (
          <div key={rule.id} className="p-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-sm font-semibold text-slate-900">
                    {rule.name}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-slate-600">{rule.documentType}</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span
                    className={
                      rule.active
                        ? 'font-semibold text-emerald-700'
                        : 'font-medium text-slate-400'
                    }
                  >
                    {rule.active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.active}
                    onChange={(e) =>
                      onUpdateRule({ ...rule, active: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-700"
                  />
                  <span>Enforce Rule</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">
                  Default Routing Stakeholder
                </label>
                <select
                  value={rule.defaultOwner}
                  onChange={(e) =>
                    onUpdateRule({
                      ...rule,
                      defaultOwner: e.target.value as StakeholderRole,
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-800"
                >
                  {ALL_OWNERS.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  Min Coverage USD
                </label>
                <input
                  type="number"
                  value={rule.minCoverageUsd ?? ''}
                  placeholder="Not enforced"
                  onChange={(e) =>
                    onUpdateRule({
                      ...rule,
                      minCoverageUsd: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-white border border-slate-200 rounded text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  Min Validity Buffer (Days)
                </label>
                <input
                  type="number"
                  value={rule.minValidityDaysRemaining ?? ''}
                  placeholder="Not enforced"
                  onChange={(e) =>
                    onUpdateRule({
                      ...rule,
                      minValidityDaysRemaining: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-white border border-slate-200 rounded text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  Mandatory Extracted Fields
                </label>
                <input
                  type="text"
                  value={rule.mandatoryFields.join(', ')}
                  onChange={(e) =>
                    onUpdateRule({
                      ...rule,
                      mandatoryFields: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>Required for tiers:</span>
              {ALL_TIERS.map((tier) => {
                const active = rule.requiredForTiers.includes(tier);
                return (
                  <label
                    key={tier}
                    className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        onUpdateRule({
                          ...rule,
                          requiredForTiers: active
                            ? rule.requiredForTiers.filter((t) => t !== tier)
                            : [...rule.requiredForTiers, tier],
                        })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    <span>{tier}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
