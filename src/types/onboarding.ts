export type StakeholderRole =
  | 'Partnerships'
  | 'Account Management'
  | 'Legal'
  | 'Compliance'
  | 'Operations';

export type PartnerTier =
  | 'Strategic Reseller'
  | 'Technology Integration'
  | 'Regional Distributor'
  | 'Managed Service Provider';

export type PartnerStatus =
  | 'Intake'
  | 'Agent Review'
  | 'Exceptions Pending'
  | 'Pending Approvals'
  | 'Approved';

export type DocumentType =
  | 'W-9 / Tax Form'
  | 'Certificate of Insurance'
  | 'Master Services Agreement'
  | 'SOC 2 Type II Report'
  | 'KYC / Beneficial Ownership'
  | 'Data Processing Addendum';

export type DiscrepancyCategory =
  | 'Entity Mismatch'
  | 'Coverage Threshold'
  | 'Expiration / Validity'
  | 'Legal Clause Variance'
  | 'Missing Mandatory Field'
  | 'Jurisdiction / Sanctions';

export type DiscrepancySeverity = 'Critical' | 'High' | 'Medium';

export type DiscrepancyStatus = 'Open' | 'In Review' | 'Resolved' | 'Waived';

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sourceCitation: string;
  verified: boolean;
}

export interface OnboardingDocument {
  id: string;
  name: string;
  type: DocumentType;
  uploadedAt: string;
  fileSizeLabel: string;
  mimeType: string;
  rawTextPreview: string;
  status: 'Extracted' | 'Discrepancy Found' | 'Verified';
  extractedFields: ExtractedField[];
  extractionDurationSec: number;
  agentSummary: string;
}

export interface Discrepancy {
  id: string;
  partnerId: string;
  category: DiscrepancyCategory;
  severity: DiscrepancySeverity;
  title: string;
  description: string;
  expectedValue: string;
  actualValue: string;
  sourceDocuments: string[];
  assignedTo: StakeholderRole;
  status: DiscrepancyStatus;
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  slaHoursRemaining: number;
}

export interface ApprovalGate {
  stakeholder: StakeholderRole;
  status: 'Pending' | 'Approved' | 'Changes Requested';
  approverName: string;
  updatedAt?: string;
  notes?: string;
  requiredForTier: boolean;
}

export interface RequirementRule {
  id: string;
  name: string;
  documentType: DocumentType;
  requiredForTiers: PartnerTier[];
  mandatoryFields: string[];
  minCoverageUsd: number | null;
  minValidityDaysRemaining: number | null;
  defaultOwner: StakeholderRole;
  active: boolean;
  description: string;
}

export type AuditActionType =
  | 'Partner Intake'
  | 'Document Uploaded'
  | 'Agent Extraction'
  | 'Rule Validation'
  | 'Discrepancy Flagged'
  | 'Exception Routed'
  | 'Exception Resolved'
  | 'Stakeholder Approval'
  | 'Requirement Updated'
  | 'Partner Onboarded';

export interface AuditEvent {
  id: string;
  partnerId: string;
  partnerName: string;
  timestamp: string;
  actor: string;
  actorRole: StakeholderRole | 'Compliance Agent';
  actionType: AuditActionType;
  summary: string;
  details: string;
  referenceId: string;
}

export interface PartnerRecord {
  id: string;
  legalName: string;
  tradingName: string;
  tier: PartnerTier;
  region: string;
  status: PartnerStatus;
  intakeDate: string;
  targetGoLiveDate: string;
  turnaroundDays: number;
  manualMinutesSpent: number;
  manualMinutesSaved: number;
  primaryContactName: string;
  primaryContactEmail: string;
  partnershipOwner: string;
  accountManager: string;
  documents: OnboardingDocument[];
  discrepancies: Discrepancy[];
  approvals: ApprovalGate[];
}

export interface SampleDocumentTemplate {
  id: string;
  label: string;
  documentType: DocumentType;
  fileName: string;
  description: string;
  content: string;
}

export interface CompletenessCheckResult {
  rule: RequirementRule;
  matchedDocument: OnboardingDocument | null;
  missingFields: string[];
  coveragePass: boolean;
  validityPass: boolean;
  status: 'Satisfied' | 'Missing Document' | 'Incomplete / Failed Rule';
  failureReason?: string;
}
