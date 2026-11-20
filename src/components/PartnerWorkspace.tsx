import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/seedData';
import type {
  Discrepancy,
  OnboardingDocument,
  PartnerRecord,
  RequirementRule,
  StakeholderRole,
} from '../types/onboarding';
import {
  evaluatePartnerCompleteness,
  getCompletenessPercentage,
} from '../utils/complianceEngine';
import {
  DiscrepancyStatusText,
  PartnerStatusText,
  SeverityText,
} from './StatusLabel';

type WorkspaceTab = 'documents' | 'completeness' | 'discrepancies' | 'approvals';

interface PartnerWorkspaceProps {
  partner: PartnerRecord;
  allPartners: PartnerRecord[];
  rules: RequirementRule[];
  activeStakeholder: StakeholderRole;
  onSelectPartner: (partnerId: string) => void;
  onBackToPipeline: () => void;
  onUploadAndAnalyze: (
    partnerId: string,
    payload: {
      fileName: string;
      mimeType: string;
      fileSizeLabel: string;
      base64Data?: string;
      textContent?: string;
    },
  ) => Promise<void>;
  onReconcilePartner: (partnerId: string) => Promise<void>;
  onToggleFieldVerified: (
    partnerId: string,
    documentId: string,
    fieldKey: string,
  ) => void;
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
  onUpdateApprovalGate: (
    partnerId: string,
    stakeholder: StakeholderRole,
    status: 'Approved' | 'Changes Requested',
    note: string,
  ) => void;
}

const STAKEHOLDERS: StakeholderRole[] = [
  'Partnerships',
  'Account Management',
  'Legal',
  'Compliance',
  'Operations',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PartnerWorkspace({
  partner,
  allPartners,
  rules,
  activeStakeholder,
  onSelectPartner,
  onBackToPipeline,
  onUploadAndAnalyze,
  onReconcilePartner,
  onToggleFieldVerified,
  onResolveDiscrepancy,
  onReassignDiscrepancy,
  onUpdateApprovalGate,
}: PartnerWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('documents');
  const [selectedDocId, setSelectedDocId] = useState<string>(
    partner.documents[0]?.id ?? '',
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentNotice, setAgentNotice] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const completenessResults = useMemo(
    () => evaluatePartnerCompleteness(partner, rules),
    [partner, rules],
  );
  const completenessPct = useMemo(
    () => getCompletenessPercentage(completenessResults),
    [completenessResults],
  );

  const openDiscrepancies = partner.discrepancies.filter(
    (d) => d.status === 'Open' || d.status === 'In Review',
  );
  const pendingGates = partner.approvals.filter(
    (a) => a.requiredForTier && a.status !== 'Approved',
  );

  const selectedDoc: OnboardingDocument | undefined =
    partner.documents.find((d) => d.id === selectedDocId) ?? partner.documents[0];

  const handleFileSelected = async (file: File) => {
    setAgentError(null);
    setAgentNotice(null);
    setIsAnalyzing(true);
    try {
      const isText =
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.md');

      if (isText) {
        const textContent = await file.text();
        await onUploadAndAnalyze(partner.id, {
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          fileSizeLabel: formatFileSize(file.size),
          textContent,
        });
      } else {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read selected file.'));
          reader.readAsDataURL(file);
        });
        await onUploadAndAnalyze(partner.id, {
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileSizeLabel: formatFileSize(file.size),
          base64Data,
        });
      }
      setAgentNotice(`Extracted and cross-checked ${file.name} against active compliance rules.`);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Document analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSampleRun = async (sampleId: string) => {
    const sample = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId);
    if (!sample) return;
    setAgentError(null);
    setAgentNotice(null);
    setIsAnalyzing(true);
    try {
      await onUploadAndAnalyze(partner.id, {
        fileName: sample.fileName,
        mimeType: 'text/plain',
        fileSizeLabel: `${Math.max(1, Math.round(sample.content.length / 1024))} KB`,
        textContent: sample.content,
      });
      setAgentNotice(`Agent analyzed ${sample.fileName} and updated completeness & discrepancies.`);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Sample analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReconcile = async () => {
    setAgentError(null);
    setAgentNotice(null);
    setIsReconciling(true);
    try {
      await onReconcilePartner(partner.id);
      setAgentNotice('Completed full cross-document compliance audit against active rules.');
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Reconciliation audit failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Partner Navigation & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToPipeline}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <PartnerStatusText status={partner.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {partner.legalName}
            </h1>
            <select
              value={partner.id}
              onChange={(e) => {
                onSelectPartner(e.target.value);
                setAgentError(null);
                setAgentNotice(null);
              }}
              aria-label="Switch active partner"
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              {allPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  Switch: {p.tradingName}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            {partner.tier} · {partner.region} · Partnerships Lead: {partner.partnershipOwner} · Account Manager: {partner.accountManager}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReconcile}
            disabled={isReconciling || partner.documents.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            {isReconciling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Re-run Compliance Audit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('documents');
              fileInputRef.current?.click();
            }}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Upload & Extract Document</span>
          </button>
        </div>
      </div>

      {/* Dossier Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">
            Requirement Completeness
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-slate-900">
            {completenessPct}%
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {completenessResults.filter((r) => r.status === 'Satisfied').length} of{' '}
            {completenessResults.length} rules satisfied
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">
            Open Discrepancies
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-slate-900">
            {openDiscrepancies.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {openDiscrepancies.length > 0
              ? `Routed to ${Array.from(new Set(openDiscrepancies.map((d) => d.assignedTo))).join(', ')}`
              : 'Zero unresolved exceptions'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">
            Pending Stakeholder Gates
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-slate-900">
            {pendingGates.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {pendingGates.length > 0
              ? pendingGates.map((g) => g.stakeholder).join(' · ')
              : 'All 5 stakeholders signed off'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">
            Manual Verification Saved
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-emerald-700">
            {partner.manualMinutesSaved} min
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Target go-live: <span className="font-mono tabular-nums">{partner.targetGoLiveDate}</span>
          </div>
        </div>
      </div>

      {agentError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <div>
            <span className="font-semibold">Agent Execution Error: </span>
            <span>{agentError}</span>
          </div>
        </div>
      )}

      {agentNotice && !agentError && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          <span>{agentNotice}</span>
        </div>
      )}

      {/* Workspace Sub-Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 overflow-x-auto">
        {(
          [
            { id: 'documents', label: `Documents & Extraction (${partner.documents.length})` },
            { id: 'completeness', label: `Completeness & Rules (${completenessResults.length})` },
            { id: 'discrepancies', label: `Discrepancies & Routing (${partner.discrepancies.length})` },
            { id: 'approvals', label: `Stakeholder Approvals (${pendingGates.length} pending)` },
          ] as Array<{ id: WorkspaceTab; label: string }>
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                active
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Hidden file input shared by header & dropzone */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.csv,.json,.md,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleFileSelected(file);
            e.target.value = '';
          }
        }}
      />

      {/* TAB 1: Documents & Extraction */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Intake & Sample Agent Dropzone */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ingest & Extract Onboarding Document
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload PDF, scanned image, or text contracts. The agent extracts structured fields, validates against active rules, and routes exceptions automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isAnalyzing ? 'Analyzing Document...' : 'Choose Local File (PDF / Image / TXT)'}</span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-500 mb-2">
                Or test the live extraction & compliance agent with a sample document packet:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {SAMPLE_DOCUMENTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => void handleSampleRun(sample.id)}
                    className="text-left p-3 border border-slate-200 hover:border-blue-700 hover:bg-blue-50/40 rounded-md transition-colors disabled:opacity-50"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      {sample.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {sample.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Document List + Extracted Fields Inspector */}
          {partner.documents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                No documents uploaded for {partner.legalName} yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a W-9, COI, MSA, SOC 2 report, or select a sample packet above to start automated extraction.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
                <div className="px-4 py-3 bg-slate-50/70 text-xs font-semibold text-slate-700">
                  Uploaded Packet ({partner.documents.length})
                </div>
                {partner.documents.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full text-left p-4 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {doc.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {doc.type} · <span className="font-mono tabular-nums">{doc.fileSizeLabel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span
                          className={
                            doc.status === 'Discrepancy Found'
                              ? 'font-medium text-red-700'
                              : 'font-medium text-emerald-700'
                          }
                        >
                          {doc.status}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {doc.extractionDurationSec}s
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedDoc && (
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg">
                  <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {selectedDoc.name}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {selectedDoc.type} · Uploaded{' '}
                        <span className="font-mono tabular-nums">
                          {selectedDoc.uploadedAt.slice(0, 10)}
                        </span>{' '}
                        · Extracted in{' '}
                        <span className="font-mono tabular-nums">
                          {selectedDoc.extractionDurationSec}s
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        selectedDoc.status === 'Discrepancy Found'
                          ? 'text-red-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedDoc.status}
                    </span>
                  </div>

                  <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-medium text-slate-500">
                      Agent Extraction Summary
                    </div>
                    <p className="text-sm text-slate-800 mt-1">
                      {selectedDoc.agentSummary}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                          <th className="py-2.5 px-4">Extracted Field</th>
                          <th className="py-2.5 px-4">Value</th>
                          <th className="py-2.5 px-4">Citation</th>
                          <th className="py-2.5 px-4 text-right">Confidence</th>
                          <th className="py-2.5 px-4 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {selectedDoc.extractedFields.map((field) => (
                          <tr key={field.key} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {field.label}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-900">
                              {field.value}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {field.sourceCitation}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              {Math.round(field.confidence * 100)}%
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleFieldVerified(
                                    partner.id,
                                    selectedDoc.id,
                                    field.key,
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                  field.verified
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>{field.verified ? 'Verified' : 'Confirm'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-5 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      Verbatim Source Excerpt
                    </div>
                    <pre className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap leading-relaxed">
                      {selectedDoc.rawTextPreview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Completeness & Rules */}
      {activeTab === 'completeness' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Configurable Requirement Matrix ({partner.tier})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated automatically against active rules configured in Requirements Config.
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
              {completenessPct}% Complete
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Requirement & Document Type</th>
                  <th className="py-3 px-4">Mandatory Fields</th>
                  <th className="py-3 px-4">Matched File</th>
                  <th className="py-3 px-4">Default Owner</th>
                  <th className="py-3 px-4">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {completenessResults.map((res) => (
                  <tr key={res.rule.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {res.rule.name}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {res.rule.documentType}
                        {res.rule.minCoverageUsd && (
                          <span className="font-mono tabular-nums">
                            {' '}· Min ${res.rule.minCoverageUsd.toLocaleString()}
                          </span>
                        )}
                        {res.rule.minValidityDaysRemaining && (
                          <span className="font-mono tabular-nums">
                            {' '}· ≥{res.rule.minValidityDaysRemaining}d buffer
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      {res.rule.mandatoryFields.join(', ')}
                      {res.failureReason && (
                        <div className="text-red-700 font-medium mt-1">
                          {res.failureReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {res.matchedDocument ? (
                        res.matchedDocument.name
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('documents');
                            fileInputRef.current?.click();
                          }}
                          className="font-sans text-blue-700 hover:underline font-medium"
                        >
                          Upload {res.rule.documentType}
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {res.rule.defaultOwner}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold ${
                          res.status === 'Satisfied'
                            ? 'text-emerald-700'
                            : res.status === 'Missing Document'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Discrepancies & Routing */}
      {activeTab === 'discrepancies' && (
        <div className="space-y-4">
          {partner.discrepancies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                Zero discrepancies flagged for {partner.legalName}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                All extracted document values align with cross-document records and configurable requirements.
              </p>
            </div>
          ) : (
            partner.discrepancies.map((disc: Discrepancy) => {
              const isOpen = disc.status === 'Open' || disc.status === 'In Review';
              return (
                <div
                  key={disc.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <SeverityText severity={disc.severity} />
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-slate-600 font-medium">{disc.category}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <DiscrepancyStatusText status={disc.status} />
                        {isOpen && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-slate-500">
                              SLA {disc.slaHoursRemaining}h left
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-1.5">
                        {disc.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">{disc.description}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-xs text-slate-500" htmlFor={`owner-${disc.id}`}>
                        Routed to:
                      </label>
                      <select
                        id={`owner-${disc.id}`}
                        value={disc.assignedTo}
                        disabled={!isOpen}
                        onChange={(e) =>
                          onReassignDiscrepancy(
                            partner.id,
                            disc.id,
                            e.target.value as StakeholderRole,
                          )
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 disabled:bg-slate-50"
                      >
                        {STAKEHOLDERS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Expected vs Actual Side-by-Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="text-slate-500 font-medium">Expected / Rule Baseline</div>
                      <div className="font-mono text-slate-900 mt-1">{disc.expectedValue}</div>
                    </div>
                    <div className="p-3 bg-red-50/50 border border-red-200 rounded-md">
                      <div className="text-red-700 font-medium">Extracted / Conflicting Value</div>
                      <div className="font-mono text-red-900 mt-1">{disc.actualValue}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    Sources: <span className="font-mono">{disc.sourceDocuments.join(', ')}</span>
                  </div>

                  {isOpen ? (
                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="text"
                        value={resolutionNotes[disc.id] ?? ''}
                        onChange={(e) =>
                          setResolutionNotes((prev) => ({
                            ...prev,
                            [disc.id]: e.target.value,
                          }))
                        }
                        placeholder={`Add resolution or waiver note as ${activeStakeholder}...`}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onResolveDiscrepancy(
                              partner.id,
                              disc.id,
                              'Resolved',
                              resolutionNotes[disc.id] ||
                                `Verified and resolved by ${activeStakeholder}.`,
                            )
                          }
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap"
                        >
                          Mark Resolved
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onResolveDiscrepancy(
                              partner.id,
                              disc.id,
                              'Waived',
                              resolutionNotes[disc.id] ||
                                `Approved exception waiver by ${activeStakeholder}.`,
                            )
                          }
                          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                        >
                          Waive Exception
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-200 text-xs text-slate-600">
                      <span className="font-medium text-slate-900">Resolution Note:</span>{' '}
                      {disc.resolutionNote || 'Closed.'}{' '}
                      {disc.resolvedAt && (
                        <span className="font-mono tabular-nums text-slate-400">
                          · {disc.resolvedAt.slice(0, 16).replace('T', ' ')} UTC
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: Stakeholder Approvals */}
      {activeTab === 'approvals' && (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          <div className="p-4 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cross-Functional Stakeholder Sign-Off Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acting as <span className="font-semibold text-slate-800">{activeStakeholder}</span>. All 5 stakeholder approvals are tracked with immutable audit timestamps.
              </p>
            </div>
          </div>

          {partner.approvals.map((gate) => {
            const openForRole = openDiscrepancies.filter(
              (d) => d.assignedTo === gate.stakeholder,
            );
            const isCurrentActor = gate.stakeholder === activeStakeholder;
            return (
              <div
                key={gate.stakeholder}
                className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isCurrentActor ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-sm font-semibold text-slate-900">
                      {gate.stakeholder}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-600">{gate.approverName}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        gate.status === 'Approved'
                          ? 'text-emerald-700'
                          : gate.status === 'Changes Requested'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {gate.status}
                    </span>
                    {gate.updatedAt && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {gate.updatedAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </>
                    )}
                  </div>
                  {gate.notes && (
                    <p className="text-xs text-slate-600">{gate.notes}</p>
                  )}
                  {openForRole.length > 0 && (
                    <p className="text-xs font-medium text-red-700">
                      {openForRole.length} open discrepancy item(s) assigned to {gate.stakeholder}.
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={approvalNotes[gate.stakeholder] ?? ''}
                    onChange={(e) =>
                      setApprovalNotes((prev) => ({
                        ...prev,
                        [gate.stakeholder]: e.target.value,
                      }))
                    }
                    placeholder="Sign-off note (optional)"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateApprovalGate(
                        partner.id,
                        gate.stakeholder,
                        'Approved',
                        approvalNotes[gate.stakeholder] ||
                          `Approved by ${gate.stakeholder} (${gate.approverName}).`,
                      )
                    }
                    disabled={gate.status === 'Approved'}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 rounded-md transition-colors whitespace-nowrap"
                  >
                    {gate.status === 'Approved' ? 'Signed Off' : 'Approve Gate'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateApprovalGate(
                        partner.id,
                        gate.stakeholder,
                        'Changes Requested',
                        approvalNotes[gate.stakeholder] ||
                          `Changes requested by ${gate.stakeholder}.`,
                      )
                    }
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    Hold
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
