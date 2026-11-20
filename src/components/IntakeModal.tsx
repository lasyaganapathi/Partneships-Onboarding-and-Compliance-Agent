import { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import type { PartnerTier } from '../types/onboarding';

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePartner: (input: {
    legalName: string;
    tradingName: string;
    tier: PartnerTier;
    region: string;
    targetGoLiveDate: string;
    primaryContactName: string;
    primaryContactEmail: string;
    partnershipOwner: string;
    accountManager: string;
    initialFile?: {
      fileName: string;
      mimeType: string;
      fileSizeLabel: string;
      base64Data?: string;
      textContent?: string;
    };
  }) => Promise<void>;
}

const TIERS: PartnerTier[] = [
  'Strategic Reseller',
  'Technology Integration',
  'Regional Distributor',
  'Managed Service Provider',
];

export function IntakeModal({
  isOpen,
  onClose,
  onCreatePartner,
}: IntakeModalProps) {
  const [legalName, setLegalName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [tier, setTier] = useState<PartnerTier>('Strategic Reseller');
  const [region, setRegion] = useState('North America');
  const [targetGoLiveDate, setTargetGoLiveDate] = useState('2026-12-05');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [partnershipOwner, setPartnershipOwner] = useState('Marcus Chen');
  const [accountManager, setAccountManager] = useState('Priya Nair');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      let initialFile:
        | {
            fileName: string;
            mimeType: string;
            fileSizeLabel: string;
            base64Data?: string;
            textContent?: string;
          }
        | undefined;

      if (selectedFile) {
        const sizeLabel =
          selectedFile.size < 1024 * 1024
            ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
            : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`;
        const isText =
          selectedFile.type.startsWith('text/') ||
          /\.(txt|csv|json|md)$/i.test(selectedFile.name);

        if (isText) {
          initialFile = {
            fileName: selectedFile.name,
            mimeType: selectedFile.type || 'text/plain',
            fileSizeLabel: sizeLabel,
            textContent: await selectedFile.text(),
          };
        } else {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read initial file.'));
            reader.readAsDataURL(selectedFile);
          });
          initialFile = {
            fileName: selectedFile.name,
            mimeType: selectedFile.type || 'application/pdf',
            fileSizeLabel: sizeLabel,
            base64Data,
          };
        }
      }

      await onCreatePartner({
        legalName: legalName.trim(),
        tradingName: tradingName.trim() || legalName.trim(),
        tier,
        region,
        targetGoLiveDate,
        primaryContactName: primaryContactName.trim() || 'Partner Representative',
        primaryContactEmail: primaryContactEmail.trim() || 'compliance@partner.com',
        partnershipOwner,
        accountManager,
        initialFile,
      });

      setLegalName('');
      setTradingName('');
      setPrimaryContactName('');
      setPrimaryContactEmail('');
      setSelectedFile(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create partner intake.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-modal-title"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="intake-modal-title" className="text-base font-bold text-slate-900">
              New Partner Onboarding Intake
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Initialize compliance dossier, assign stakeholder gates, and optionally extract an initial document.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Legal Entity Name *
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Apex Freight Systems Inc."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Trading / Brand Name
              </label>
              <input
                type="text"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                placeholder="e.g. Apex Freight"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Partner Tier *
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as PartnerTier)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-blue-700"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Operating Region
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Partner Primary Contact
              </label>
              <input
                type="text"
                value={primaryContactName}
                onChange={(e) => setPrimaryContactName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Partner Contact Email
              </label>
              <input
                type="email"
                value={primaryContactEmail}
                onChange={(e) => setPrimaryContactEmail(e.target.value)}
                placeholder="legal@partner.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Partnerships Owner
              </label>
              <input
                type="text"
                value={partnershipOwner}
                onChange={(e) => setPartnershipOwner(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account Manager & Target Go-Live
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={accountManager}
                  onChange={(e) => setAccountManager(e.target.value)}
                  aria-label="Account manager"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                />
                <input
                  type="date"
                  value={targetGoLiveDate}
                  onChange={(e) => setTargetGoLiveDate(e.target.value)}
                  aria-label="Target go-live date"
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Initial Onboarding Document (Optional — runs AI extraction on intake)
            </label>
            <label className="flex items-center justify-between px-4 py-3 border border-dashed border-slate-300 hover:border-blue-700 rounded-md cursor-pointer bg-slate-50/50">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>
                  {selectedFile
                    ? selectedFile.name
                    : 'Attach W-9, COI, MSA, SOC 2, or KYC file (PDF / Image / TXT)'}
                </span>
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.csv,.json,.md,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {submitting ? 'Initializing & Analyzing...' : 'Create Onboarding Dossier'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
