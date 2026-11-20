import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  DiscrepancyCategory,
  DiscrepancySeverity,
  DocumentType,
  ExtractedField,
  OnboardingDocument,
  RequirementRule,
  StakeholderRole,
} from './src/types/onboarding.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AnalyzeDocumentBody {
  partnerId: string;
  partnerLegalName: string;
  partnerTier: string;
  fileName: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
  existingDocuments: Array<{
    name: string;
    type: DocumentType;
    extractedFields: ExtractedField[];
  }>;
  activeRules: RequirementRule[];
}

interface ReconcilePartnerBody {
  partnerId: string;
  partnerLegalName: string;
  partnerTier: string;
  documents: OnboardingDocument[];
  activeRules: RequirementRule[];
}

interface AgentAnalysisResponse {
  detectedDocumentType: DocumentType;
  agentSummary: string;
  rawTextPreview: string;
  extractedFields: ExtractedField[];
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
}

const VALID_DOC_TYPES: DocumentType[] = [
  'W-9 / Tax Form',
  'Certificate of Insurance',
  'Master Services Agreement',
  'SOC 2 Type II Report',
  'KYC / Beneficial Ownership',
  'Data Processing Addendum',
];

const VALID_STAKEHOLDERS: StakeholderRole[] = [
  'Partnerships',
  'Account Management',
  'Legal',
  'Compliance',
  'Operations',
];

const VALID_CATEGORIES: DiscrepancyCategory[] = [
  'Entity Mismatch',
  'Coverage Threshold',
  'Expiration / Validity',
  'Legal Clause Variance',
  'Missing Mandatory Field',
  'Jurisdiction / Sanctions',
];

const VALID_SEVERITIES: DiscrepancySeverity[] = ['Critical', 'High', 'Medium'];

function handleGeminiError(res: express.Response, err: unknown) {
  const message =
    err instanceof Error ? err.message : 'Unexpected agent processing error';
  const statusMatch = message.match(/\b(400|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 500;
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: message,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/agent/analyze-document', async (req, res) => {
    const startTime = Date.now();
    try {
      const body = req.body as AnalyzeDocumentBody;
      if (!body || !body.fileName || (!body.base64Data && !body.textContent)) {
        res.status(400).json({
          error: 'Missing document payload. Provide fileName and either base64Data or textContent.',
        });
        return;
      }

      const ai = getGeminiClient();

      const applicableRules = (body.activeRules || []).filter(
        (r) => r.active && r.requiredForTiers.includes(body.partnerTier as never),
      );

      const contextPrompt = `You are Accordia's Partner Onboarding & Compliance Agent.
Analyze the uploaded partner onboarding document for partner "${body.partnerLegalName}" (Tier: "${body.partnerTier}").
Today's reference date is 2026-11-19.

Applicable Configurable Compliance Rules for this tier:
${JSON.stringify(applicableRules, null, 2)}

Existing Extracted Fields from Prior Partner Documents (for cross-document consistency checking):
${JSON.stringify(body.existingDocuments || [], null, 2)}

Your tasks:
1. Classify the document into one of: ${VALID_DOC_TYPES.join(', ')}.
2. Extract all key structured fields (especially mandatoryFields required by the matching rule: Legal Entity Name / Insured Entity Name / Contracting Entity / Service Organization / Data Processor Entity, Tax ID / EIN, Policy Coverage Limits, Expiration / Audit End Dates, Governing Law, Liability Cap, Transfer Mechanism, Subprocessor List, Signatory, Jurisdiction, Beneficial Owners). Include exact sourceCitation (section/line/page), confidence (0.0 to 1.0), and verified boolean.
3. Produce a concise rawTextPreview (under 400 characters) summarizing the verbatim header and key clauses.
4. Cross-check the extracted data against BOTH the applicable rules (coverage minimums, expiration buffers >= minValidityDaysRemaining from 2026-11-19, mandatory fields, legal standards such as Delaware/New York governing law and 12-month liability cap, valid GDPR transfer mechanisms like EU SCCs rather than invalidated Privacy Shield) AND the existing partner documents (e.g., exact legal entity name match, EIN consistency).
5. Return any discrepancies found, assigning each to the most appropriate stakeholder from: ${VALID_STAKEHOLDERS.join(', ')} (Legal for MSA/DPA/clauses, Compliance for SOC 2/KYC/Cyber limits/sanctions/privacy transfers, Operations for Tax/W-9/COI entity mismatches/expiration renewals, Account Management or Partnerships for commercial or missing-schedule follow-ups). If the document is completely compliant with zero discrepancies, return an empty discrepancies array.`;

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (body.base64Data) {
        const cleanBase64 = body.base64Data.includes(',')
          ? body.base64Data.split(',')[1]
          : body.base64Data;
        parts.push({
          inlineData: {
            mimeType: body.mimeType || 'application/pdf',
            data: cleanBase64,
          },
        });
      }

      if (body.textContent) {
        parts.push({
          text: `Document Filename: ${body.fileName}\n\nDocument Content:\n${body.textContent}`,
        });
      } else {
        parts.push({
          text: `Document Filename: ${body.fileName}`,
        });
      }

      parts.push({ text: contextPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedDocumentType: {
                type: Type.STRING,
                description: 'Classified document type matching one of the allowed onboarding document types.',
              },
              agentSummary: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence compliance extraction summary.',
              },
              rawTextPreview: {
                type: Type.STRING,
                description: 'Compact verbatim summary of extracted header and clauses.',
              },
              extractedFields: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: { type: Type.STRING },
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    sourceCitation: { type: Type.STRING },
                    verified: { type: Type.BOOLEAN },
                  },
                  required: ['key', 'label', 'value', 'confidence', 'sourceCitation', 'verified'],
                },
              },
              discrepancies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    expectedValue: { type: Type.STRING },
                    actualValue: { type: Type.STRING },
                    sourceDocuments: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    assignedTo: { type: Type.STRING },
                  },
                  required: [
                    'category',
                    'severity',
                    'title',
                    'description',
                    'expectedValue',
                    'actualValue',
                    'sourceDocuments',
                    'assignedTo',
                  ],
                },
              },
            },
            required: [
              'detectedDocumentType',
              'agentSummary',
              'rawTextPreview',
              'extractedFields',
              'discrepancies',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as AgentAnalysisResponse;
      const detectedType = VALID_DOC_TYPES.includes(parsed.detectedDocumentType)
        ? parsed.detectedDocumentType
        : 'W-9 / Tax Form';

      const normalizedDiscrepancies = (parsed.discrepancies || []).map((d) => ({
        category: VALID_CATEGORIES.includes(d.category)
          ? d.category
          : ('Missing Mandatory Field' as DiscrepancyCategory),
        severity: VALID_SEVERITIES.includes(d.severity)
          ? d.severity
          : ('High' as DiscrepancySeverity),
        title: d.title,
        description: d.description,
        expectedValue: d.expectedValue,
        actualValue: d.actualValue,
        sourceDocuments:
          Array.isArray(d.sourceDocuments) && d.sourceDocuments.length > 0
            ? d.sourceDocuments
            : [body.fileName],
        assignedTo: VALID_STAKEHOLDERS.includes(d.assignedTo)
          ? d.assignedTo
          : ('Compliance' as StakeholderRole),
      }));

      const durationSec = Math.round(((Date.now() - startTime) / 1000) * 10) / 10;

      res.json({
        detectedDocumentType: detectedType,
        agentSummary: parsed.agentSummary || `Processed ${body.fileName}.`,
        rawTextPreview: parsed.rawTextPreview || body.textContent?.slice(0, 320) || body.fileName,
        extractedFields: parsed.extractedFields || [],
        discrepancies: normalizedDiscrepancies,
        extractionDurationSec: Math.max(durationSec, 0.8),
      });
    } catch (err) {
      handleGeminiError(res, err);
    }
  });

  app.post('/api/agent/reconcile-partner', async (req, res) => {
    try {
      const body = req.body as ReconcilePartnerBody;
      if (!body || !body.partnerLegalName) {
        res.status(400).json({ error: 'Missing partner payload.' });
        return;
      }

      const ai = getGeminiClient();
      const applicableRules = (body.activeRules || []).filter(
        (r) => r.active && r.requiredForTiers.includes(body.partnerTier as never),
      );

      const prompt = `You are Accordia's Partner Onboarding & Compliance Agent performing a full cross-document reconciliation audit.
Partner: "${body.partnerLegalName}" (Tier: "${body.partnerTier}")
Reference Date: 2026-11-19

Configurable Rules:
${JSON.stringify(applicableRules, null, 2)}

Uploaded Documents & Extracted Fields:
${JSON.stringify(
  body.documents.map((d) => ({
    name: d.name,
    type: d.type,
    extractedFields: d.extractedFields,
  })),
  null,
  2,
)}

Identify ALL cross-document discrepancies (e.g., entity name inconsistencies, coverage shortfalls vs. minCoverageUsd, expiration dates violating minValidityDaysRemaining, non-standard governing law or liability caps, missing mandatory fields, invalidated data transfer clauses) and route each to the best stakeholder (${VALID_STAKEHOLDERS.join(', ')}). Also write a concise auditExecutiveSummary.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              auditExecutiveSummary: { type: Type.STRING },
              discrepancies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    expectedValue: { type: Type.STRING },
                    actualValue: { type: Type.STRING },
                    sourceDocuments: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    assignedTo: { type: Type.STRING },
                  },
                  required: [
                    'category',
                    'severity',
                    'title',
                    'description',
                    'expectedValue',
                    'actualValue',
                    'sourceDocuments',
                    'assignedTo',
                  ],
                },
              },
            },
            required: ['auditExecutiveSummary', 'discrepancies'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        auditExecutiveSummary: string;
        discrepancies: AgentAnalysisResponse['discrepancies'];
      };

      res.json({
        auditExecutiveSummary: parsed.auditExecutiveSummary,
        discrepancies: (parsed.discrepancies || []).map((d) => ({
          ...d,
          category: VALID_CATEGORIES.includes(d.category)
            ? d.category
            : 'Missing Mandatory Field',
          severity: VALID_SEVERITIES.includes(d.severity) ? d.severity : 'High',
          assignedTo: VALID_STAKEHOLDERS.includes(d.assignedTo)
            ? d.assignedTo
            : 'Compliance',
        })),
      });
    } catch (err) {
      handleGeminiError(res, err);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Accordia server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
