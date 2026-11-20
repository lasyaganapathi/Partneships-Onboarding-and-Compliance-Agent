/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { AuditTrailView } from './components/AuditTrailView';
import { ExceptionsQueueView } from './components/ExceptionsQueueView';
import { IntakeModal } from './components/IntakeModal';
import { PartnerWorkspace } from './components/PartnerWorkspace';
import { PipelineView } from './components/PipelineView';
import { RequirementsConfigView } from './components/RequirementsConfigView';
import { Sidebar, type WorkspaceSection } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import {
  INITIAL_AUDIT_EVENTS,
  INITIAL_PARTNERS,
  INITIAL_RULES,
} from './data/seedData';
import type {
  AuditEvent,
  Discrepancy,
  DiscrepancyCategory,
  DiscrepancySeverity,
  DocumentType,
  ExtractedField,
  OnboardingDocument,
  PartnerRecord,
  PartnerTier,
  RequirementRule,
  StakeholderRole,
} from './types/onboarding';
import {
  derivePartnerStatus,
  evaluatePartnerCompleteness,
} from './utils/complianceEngine';

const STORAGE_KEY = 'accordia_onboarding_state_v1';

const STAKEHOLDER_DEFAULT_NAMES: Record<StakeholderRole, string> = {
  Partnerships: 'Marcus Chen',
  'Account Management': 'Priya Nair',
  Operations: 'Hannah Brooks',
  Compliance: 'Rohan Patel',
  Legal: 'Claire Sterling',
};

interface PersistedState {
  partners: PartnerRecord[];
  rules: RequirementRule[];
  auditEvents: AuditEvent[];
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        Array.isArray(parsed.partners) &&
        Array.isArray(parsed.rules) &&
        Array.isArray(parsed.auditEvents)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fall back to seed data
  }
  return {
    partners: INITIAL_PARTNERS,
    rules: INITIAL_RULES,
    auditEvents: INITIAL_AUDIT_EVENTS,
  };
}

function makeRefId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), []);
  const [partners, setPartners] = useState<PartnerRecord[]>(initialState.partners);
  const [rules, setRules] = useState<RequirementRule[]>(initialState.rules);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(initialState.auditEvents);

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('pipeline');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    initialState.partners[0]?.id ?? '',
  );
  const [activeStakeholder, setActiveStakeholder] =
    useState<StakeholderRole>('Operations');
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ partners, rules, auditEvents }),
      );
    } catch {
      // Ignore quota errors
    }
  }, [partners, rules, auditEvents]);

  const appendAuditEvents = (newEvents: AuditEvent[]) => {
    setAuditEvents((prev) => [...newEvents, ...prev]);
  };

  const recomputePartner = (
    partner: PartnerRecord,
    activeRules: RequirementRule[],
  ): PartnerRecord => {
    const completeness = evaluatePartnerCompleteness(partner, activeRules);
    return {
      ...partner,
      status: derivePartnerStatus(partner, completeness),
    };
  };

  const selectedPartner =
    partners.find((p) => p.id === selectedPartnerId) ?? partners[0];

  const openExceptionsByRole = useMemo(() => {
    const counts: Record<StakeholderRole, number> = {
      Partnerships: 0,
      'Account Management': 0,
      Legal: 0,
      Compliance: 0,
      Operations: 0,
    };
    for (const p of partners) {
      for (const d of p.discrepancies) {
        if (d.status === 'Open' || d.status === 'In Review') {
          counts[d.assignedTo] = (counts[d.assignedTo] || 0) + 1;
        }
      }
    }
    return counts;
  }, [partners]);

  const pendingApprovalsByRole = useMemo(() => {
    const counts: Record<StakeholderRole, number> = {
      Partnerships: 0,
      'Account Management': 0,
      Legal: 0,
      Compliance: 0,
      Operations: 0,
    };
    for (const p of partners) {
      for (const gate of p.approvals) {
        if (gate.requiredForTier && gate.status !== 'Approved') {
          counts[gate.stakeholder] = (counts[gate.stakeholder] || 0) + 1;
        }
      }
    }
    return counts;
  }, [partners]);

  const totalOpenExceptions = useMemo(
    () =>
      Object.values(openExceptionsByRole).reduce((sum, count) => sum + count, 0),
    [openExceptionsByRole],
  );

  const handleUploadAndAnalyze = async (
    partnerId: string,
    payload: {
      fileName: string;
      mimeType: string;
      fileSizeLabel: string;
      base64Data?: string;
      textContent?: string;
    },
    overridePartners?: PartnerRecord[],
  ) => {
    const sourceList = overridePartners ?? partners;
    const targetPartner = sourceList.find((p) => p.id === partnerId);
    if (!targetPartner) {
      throw new Error('Target partner dossier not found.');
    }

    const res = await fetch('/api/agent/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId: targetPartner.id,
        partnerLegalName: targetPartner.legalName,
        partnerTier: targetPartner.tier,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        base64Data: payload.base64Data,
        textContent: payload.textContent,
        existingDocuments: targetPartner.documents.map((d) => ({
          name: d.name,
          type: d.type,
          extractedFields: d.extractedFields,
        })),
        activeRules: rules,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      detectedDocumentType: DocumentType;
      agentSummary: string;
      rawTextPreview: string;
      extractedFields: ExtractedField[];
      extractionDurationSec: number;
      discrepancies: Array<{
        category: DiscrepancyCategory;
        severity: DiscrepancySeverity;
        title: string;
        description: string;
        expectedValue: string;
        actualValue: string;
        sourceDocuments: string[];
        assignedTo: StakeholderRole;
      }>;
    };

    if (!res.ok) {
      throw new Error(data.error || `Agent request failed (${res.status}).`);
    }

    const nowIso = new Date().toISOString();
    const newDoc: OnboardingDocument = {
      id: `doc-${Date.now()}`,
      name: payload.fileName,
      type: data.detectedDocumentType,
      uploadedAt: nowIso,
      fileSizeLabel: payload.fileSizeLabel,
      mimeType: payload.mimeType,
      rawTextPreview: data.rawTextPreview,
      status:
        data.discrepancies && data.discrepancies.length > 0
          ? 'Discrepancy Found'
          : 'Verified',
      extractedFields: data.extractedFields,
      extractionDurationSec: data.extractionDurationSec || 1.8,
      agentSummary: data.agentSummary,
    };

    const flaggedDiscrepancies: Discrepancy[] = (data.discrepancies || []).map(
      (d, idx) => ({
        id: `disc-${Date.now()}-${idx}`,
        partnerId: targetPartner.id,
        category: d.category,
        severity: d.severity,
        title: d.title,
        description: d.description,
        expectedValue: d.expectedValue,
        actualValue: d.actualValue,
        sourceDocuments: d.sourceDocuments,
        assignedTo: d.assignedTo,
        status: 'Open',
        createdAt: nowIso,
        slaHoursRemaining: d.severity === 'Critical' ? 12 : 24,
      }),
    );

    const applyUpdate = (prev: PartnerRecord[]) =>
      prev.map((p) => {
        if (p.id !== targetPartner.id) return p;
        const filteredDocs = p.documents.filter(
          (existing) => existing.type !== newDoc.type,
        );
        const updatedPartner: PartnerRecord = {
          ...p,
          documents: [newDoc, ...filteredDocs],
          discrepancies: [...flaggedDiscrepancies, ...p.discrepancies],
          manualMinutesSpent: p.manualMinutesSpent + 2,
          manualMinutesSaved: p.manualMinutesSaved + 18,
        };
        return recomputePartner(updatedPartner, rules);
      });

    setPartners((prev) => applyUpdate(prev));

    const newAuditEntries: AuditEvent[] = [
      {
        id: `aud-${Date.now()}-1`,
        partnerId: targetPartner.id,
        partnerName: targetPartner.legalName,
        timestamp: nowIso,
        actor: 'Compliance Agent',
        actorRole: 'Compliance Agent',
        actionType: 'Agent Extraction',
        summary: `Extracted ${newDoc.extractedFields.length} fields from ${newDoc.name} (${newDoc.type})`,
        details: newDoc.agentSummary,
        referenceId: makeRefId('EXT'),
      },
    ];

    if (flaggedDiscrepancies.length > 0) {
      for (const disc of flaggedDiscrepancies) {
        newAuditEntries.unshift({
          id: `aud-${Date.now()}-${disc.id}`,
          partnerId: targetPartner.id,
          partnerName: targetPartner.legalName,
          timestamp: nowIso,
          actor: 'Compliance Agent',
          actorRole: 'Compliance Agent',
          actionType: 'Exception Routed',
          summary: `Flagged ${disc.severity} discrepancy "${disc.title}" -> Routed to ${disc.assignedTo}`,
          details: `Expected: ${disc.expectedValue} | Extracted: ${disc.actualValue}`,
          referenceId: makeRefId('EXC'),
        });
      }
    } else {
      newAuditEntries.unshift({
        id: `aud-${Date.now()}-ok`,
        partnerId: targetPartner.id,
        partnerName: targetPartner.legalName,
        timestamp: nowIso,
        actor: 'Compliance Agent',
        actorRole: 'Compliance Agent',
        actionType: 'Rule Validation',
        summary: `${newDoc.type} passed active rule validation with zero discrepancies`,
        details: `Validated against ${rules.filter((r) => r.active && r.documentType === newDoc.type).length} active policy rule(s).`,
        referenceId: makeRefId('VAL'),
      });
    }

    appendAuditEvents(newAuditEntries);
  };

  const handleReconcilePartner = async (partnerId: string) => {
    const targetPartner = partners.find((p) => p.id === partnerId);
    if (!targetPartner) return;

    const res = await fetch('/api/agent/reconcile-partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId: targetPartner.id,
        partnerLegalName: targetPartner.legalName,
        partnerTier: targetPartner.tier,
        documents: targetPartner.documents,
        activeRules: rules,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      auditExecutiveSummary: string;
      discrepancies: Array<{
        category: DiscrepancyCategory;
        severity: DiscrepancySeverity;
        title: string;
        description: string;
        expectedValue: string;
        actualValue: string;
        sourceDocuments: string[];
        assignedTo: StakeholderRole;
      }>;
    };

    if (!res.ok) {
      throw new Error(data.error || `Compliance audit failed (${res.status}).`);
    }

    const nowIso = new Date().toISOString();
    const existingOpenTitles = new Set(
      targetPartner.discrepancies
        .filter((d) => d.status === 'Open' || d.status === 'In Review')
        .map((d) => d.title.toLowerCase()),
    );

    const newDiscrepancies: Discrepancy[] = (data.discrepancies || [])
      .filter((d) => !existingOpenTitles.has(d.title.toLowerCase()))
      .map((d, idx) => ({
        id: `disc-rec-${Date.now()}-${idx}`,
        partnerId: targetPartner.id,
        category: d.category,
        severity: d.severity,
        title: d.title,
        description: d.description,
        expectedValue: d.expectedValue,
        actualValue: d.actualValue,
        sourceDocuments: d.sourceDocuments,
        assignedTo: d.assignedTo,
        status: 'Open',
        createdAt: nowIso,
        slaHoursRemaining: d.severity === 'Critical' ? 12 : 24,
      }));

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== targetPartner.id) return p;
        return recomputePartner(
          {
            ...p,
            discrepancies: [...newDiscrepancies, ...p.discrepancies],
          },
          rules,
        );
      }),
    );

    appendAuditEvents([
      {
        id: `aud-rec-${Date.now()}`,
        partnerId: targetPartner.id,
        partnerName: targetPartner.legalName,
        timestamp: nowIso,
        actor: 'Compliance Agent',
        actorRole: 'Compliance Agent',
        actionType: 'Rule Validation',
        summary: `Full cross-document audit completed (${newDiscrepancies.length} new exception(s))`,
        details: data.auditExecutiveSummary,
        referenceId: makeRefId('AUD'),
      },
    ]);
  };

  const handleToggleFieldVerified = (
    partnerId: string,
    documentId: string,
    fieldKey: string,
  ) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        return {
          ...p,
          documents: p.documents.map((doc) => {
            if (doc.id !== documentId) return doc;
            return {
              ...doc,
              extractedFields: doc.extractedFields.map((f) =>
                f.key === fieldKey ? { ...f, verified: !f.verified } : f,
              ),
            };
          }),
        };
      }),
    );
  };

  const handleResolveDiscrepancy = (
    partnerId: string,
    discrepancyId: string,
    resolution: 'Resolved' | 'Waived',
    note: string,
  ) => {
    const nowIso = new Date().toISOString();
    const targetPartner = partners.find((p) => p.id === partnerId);
    const targetDisc = targetPartner?.discrepancies.find(
      (d) => d.id === discrepancyId,
    );

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const updated: PartnerRecord = {
          ...p,
          discrepancies: p.discrepancies.map((d) =>
            d.id === discrepancyId
              ? {
                  ...d,
                  status: resolution,
                  resolvedAt: nowIso,
                  resolutionNote: note,
                  slaHoursRemaining: 0,
                }
              : d,
          ),
        };
        return recomputePartner(updated, rules);
      }),
    );

    if (targetPartner && targetDisc) {
      appendAuditEvents([
        {
          id: `aud-res-${Date.now()}`,
          partnerId: targetPartner.id,
          partnerName: targetPartner.legalName,
          timestamp: nowIso,
          actor: STAKEHOLDER_DEFAULT_NAMES[activeStakeholder],
          actorRole: activeStakeholder,
          actionType: 'Exception Resolved',
          summary: `${resolution} exception "${targetDisc.title}"`,
          details: note,
          referenceId: makeRefId('RES'),
        },
      ]);
    }
  };

  const handleReassignDiscrepancy = (
    partnerId: string,
    discrepancyId: string,
    newOwner: StakeholderRole,
  ) => {
    const nowIso = new Date().toISOString();
    const targetPartner = partners.find((p) => p.id === partnerId);
    const targetDisc = targetPartner?.discrepancies.find(
      (d) => d.id === discrepancyId,
    );

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        return {
          ...p,
          discrepancies: p.discrepancies.map((d) =>
            d.id === discrepancyId ? { ...d, assignedTo: newOwner } : d,
          ),
        };
      }),
    );

    if (targetPartner && targetDisc) {
      appendAuditEvents([
        {
          id: `aud-rte-${Date.now()}`,
          partnerId: targetPartner.id,
          partnerName: targetPartner.legalName,
          timestamp: nowIso,
          actor: STAKEHOLDER_DEFAULT_NAMES[activeStakeholder],
          actorRole: activeStakeholder,
          actionType: 'Exception Routed',
          summary: `Reassigned "${targetDisc.title}" from ${targetDisc.assignedTo} to ${newOwner}`,
          details: `Manual stakeholder escalation performed in compliance queue.`,
          referenceId: makeRefId('RTE'),
        },
      ]);
    }
  };

  const handleUpdateApprovalGate = (
    partnerId: string,
    stakeholder: StakeholderRole,
    status: 'Approved' | 'Changes Requested',
    note: string,
  ) => {
    const nowIso = new Date().toISOString();
    const targetPartner = partners.find((p) => p.id === partnerId);
    let becameFullyApproved = false;

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const updatedPartner: PartnerRecord = {
          ...p,
          approvals: p.approvals.map((gate) =>
            gate.stakeholder === stakeholder
              ? {
                  ...gate,
                  status,
                  updatedAt: nowIso,
                  notes: note,
                }
              : gate,
          ),
        };
        const recomputed = recomputePartner(updatedPartner, rules);
        if (recomputed.status === 'Approved' && p.status !== 'Approved') {
          becameFullyApproved = true;
        }
        return recomputed;
      }),
    );

    if (targetPartner) {
      const entries: AuditEvent[] = [
        {
          id: `aud-app-${Date.now()}`,
          partnerId: targetPartner.id,
          partnerName: targetPartner.legalName,
          timestamp: nowIso,
          actor: STAKEHOLDER_DEFAULT_NAMES[stakeholder],
          actorRole: stakeholder,
          actionType: 'Stakeholder Approval',
          summary: `${stakeholder} marked approval gate as ${status}`,
          details: note,
          referenceId: makeRefId('GATE'),
        },
      ];
      if (becameFullyApproved) {
        entries.unshift({
          id: `aud-onb-${Date.now() + 1}`,
          partnerId: targetPartner.id,
          partnerName: targetPartner.legalName,
          timestamp: nowIso,
          actor: STAKEHOLDER_DEFAULT_NAMES[stakeholder],
          actorRole: stakeholder,
          actionType: 'Partner Onboarded',
          summary: `All stakeholder gates cleared — partner moved to Approved`,
          details: `Completed onboarding in ${targetPartner.turnaroundDays.toFixed(1)} days.`,
          referenceId: makeRefId('ONB'),
        });
      }
      appendAuditEvents(entries);
    }
  };

  const handleUpdateRule = (updatedRule: RequirementRule) => {
    const nextRules = rules.map((r) => (r.id === updatedRule.id ? updatedRule : r));
    setRules(nextRules);
    setPartners((prev) => prev.map((p) => recomputePartner(p, nextRules)));

    appendAuditEvents([
      {
        id: `aud-rule-${Date.now()}`,
        partnerId: 'system',
        partnerName: 'Policy Engine',
        timestamp: new Date().toISOString(),
        actor: STAKEHOLDER_DEFAULT_NAMES[activeStakeholder],
        actorRole: activeStakeholder,
        actionType: 'Requirement Updated',
        summary: `Updated rule "${updatedRule.name}"`,
        details: `Active: ${updatedRule.active} | Min Coverage: ${updatedRule.minCoverageUsd ?? 'N/A'} | Min Validity Days: ${updatedRule.minValidityDaysRemaining ?? 'N/A'} | Default Owner: ${updatedRule.defaultOwner}`,
        referenceId: makeRefId('POL'),
      },
    ]);
  };

  const handleAddRule = (newRule: RequirementRule) => {
    const nextRules = [newRule, ...rules];
    setRules(nextRules);
    setPartners((prev) => prev.map((p) => recomputePartner(p, nextRules)));

    appendAuditEvents([
      {
        id: `aud-rule-add-${Date.now()}`,
        partnerId: 'system',
        partnerName: 'Policy Engine',
        timestamp: new Date().toISOString(),
        actor: STAKEHOLDER_DEFAULT_NAMES[activeStakeholder],
        actorRole: activeStakeholder,
        actionType: 'Requirement Updated',
        summary: `Added new requirement rule "${newRule.name}"`,
        details: `Applies to ${newRule.requiredForTiers.join(', ')} | Routed to ${newRule.defaultOwner}`,
        referenceId: makeRefId('POL'),
      },
    ]);
  };

  const handleReevaluateAllPartners = () => {
    setPartners((prev) => prev.map((p) => recomputePartner(p, rules)));
    appendAuditEvents([
      {
        id: `aud-reeval-${Date.now()}`,
        partnerId: 'system',
        partnerName: 'Policy Engine',
        timestamp: new Date().toISOString(),
        actor: 'Compliance Agent',
        actorRole: 'Compliance Agent',
        actionType: 'Rule Validation',
        summary: `Re-evaluated ${partners.length} partner dossiers against ${rules.filter((r) => r.active).length} active rules`,
        details: 'Recalculated completeness checklists and partner lifecycle statuses.',
        referenceId: makeRefId('VAL'),
      },
    ]);
  };

  const handleCreatePartner = async (input: {
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
  }) => {
    const nowIso = new Date().toISOString();
    const newPartner: PartnerRecord = {
      id: `prt-${Date.now()}`,
      legalName: input.legalName,
      tradingName: input.tradingName,
      tier: input.tier,
      region: input.region,
      status: 'Intake',
      intakeDate: nowIso,
      targetGoLiveDate: input.targetGoLiveDate,
      turnaroundDays: 0.1,
      manualMinutesSpent: 4,
      manualMinutesSaved: 20,
      primaryContactName: input.primaryContactName,
      primaryContactEmail: input.primaryContactEmail,
      partnershipOwner: input.partnershipOwner,
      accountManager: input.accountManager,
      documents: [],
      discrepancies: [],
      approvals: [
        {
          stakeholder: 'Partnerships',
          status: 'Approved',
          approverName: input.partnershipOwner,
          updatedAt: nowIso,
          notes: 'Intake submitted by Partnerships.',
          requiredForTier: true,
        },
        {
          stakeholder: 'Account Management',
          status: 'Pending',
          approverName: input.accountManager,
          requiredForTier: true,
        },
        {
          stakeholder: 'Operations',
          status: 'Pending',
          approverName: STAKEHOLDER_DEFAULT_NAMES.Operations,
          requiredForTier: true,
        },
        {
          stakeholder: 'Compliance',
          status: 'Pending',
          approverName: STAKEHOLDER_DEFAULT_NAMES.Compliance,
          requiredForTier: true,
        },
        {
          stakeholder: 'Legal',
          status: 'Pending',
          approverName: STAKEHOLDER_DEFAULT_NAMES.Legal,
          requiredForTier: true,
        },
      ],
    };

    const nextList = [newPartner, ...partners];
    setPartners(nextList);
    setSelectedPartnerId(newPartner.id);
    setActiveSection('workspace');

    appendAuditEvents([
      {
        id: `aud-int-${Date.now()}`,
        partnerId: newPartner.id,
        partnerName: newPartner.legalName,
        timestamp: nowIso,
        actor: input.partnershipOwner,
        actorRole: 'Partnerships',
        actionType: 'Partner Intake',
        summary: `Initiated ${newPartner.tier} onboarding dossier`,
        details: `Region: ${newPartner.region} | Target go-live: ${newPartner.targetGoLiveDate}`,
        referenceId: makeRefId('INT'),
      },
    ]);

    if (input.initialFile) {
      await handleUploadAndAnalyze(newPartner.id, input.initialFile, nextList);
    }
  };

  const breadcrumbs = useMemo(() => {
    switch (activeSection) {
      case 'pipeline':
        return ['Partner Onboarding', 'Pipeline'];
      case 'workspace':
        return [
          'Partner Onboarding',
          'Partner Workspace',
          selectedPartner?.tradingName || 'Dossier',
        ];
      case 'exceptions':
        return ['Partner Onboarding', 'Exceptions & Approvals'];
      case 'rules':
        return ['Partner Onboarding', 'Requirements Config'];
      case 'audit':
        return ['Partner Onboarding', 'Audit Trail'];
    }
  }, [activeSection, selectedPartner]);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        activeStakeholder={activeStakeholder}
        onSelectStakeholder={setActiveStakeholder}
        openExceptionsByRole={openExceptionsByRole}
        pendingApprovalsByRole={pendingApprovalsByRole}
        totalOpenExceptions={totalOpenExceptions}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          breadcrumbs={breadcrumbs}
          onOpenIntakeModal={() => setIntakeOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'pipeline' && (
            <PipelineView
              partners={partners}
              rules={rules}
              onSelectPartner={(id) => {
                setSelectedPartnerId(id);
                setActiveSection('workspace');
              }}
              onOpenIntakeModal={() => setIntakeOpen(true)}
            />
          )}

          {activeSection === 'workspace' && selectedPartner && (
            <PartnerWorkspace
              partner={selectedPartner}
              allPartners={partners}
              rules={rules}
              activeStakeholder={activeStakeholder}
              onSelectPartner={setSelectedPartnerId}
              onBackToPipeline={() => setActiveSection('pipeline')}
              onUploadAndAnalyze={handleUploadAndAnalyze}
              onReconcilePartner={handleReconcilePartner}
              onToggleFieldVerified={handleToggleFieldVerified}
              onResolveDiscrepancy={handleResolveDiscrepancy}
              onReassignDiscrepancy={handleReassignDiscrepancy}
              onUpdateApprovalGate={handleUpdateApprovalGate}
            />
          )}

          {activeSection === 'exceptions' && (
            <ExceptionsQueueView
              partners={partners}
              activeStakeholder={activeStakeholder}
              onOpenPartner={(id) => {
                setSelectedPartnerId(id);
                setActiveSection('workspace');
              }}
              onResolveDiscrepancy={handleResolveDiscrepancy}
              onReassignDiscrepancy={handleReassignDiscrepancy}
              onApproveGate={(partnerId, stakeholder, note) =>
                handleUpdateApprovalGate(partnerId, stakeholder, 'Approved', note)
              }
            />
          )}

          {activeSection === 'rules' && (
            <RequirementsConfigView
              rules={rules}
              onUpdateRule={handleUpdateRule}
              onAddRule={handleAddRule}
              onReevaluateAllPartners={handleReevaluateAllPartners}
            />
          )}

          {activeSection === 'audit' && (
            <AuditTrailView
              events={auditEvents}
              partners={partners}
              onOpenPartner={(id) => {
                setSelectedPartnerId(id);
                setActiveSection('workspace');
              }}
            />
          )}
        </main>
      </div>

      <IntakeModal
        isOpen={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onCreatePartner={handleCreatePartner}
      />
    </div>
  );
}
