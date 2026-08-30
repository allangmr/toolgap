export type Surface = "store" | "dashboard";
export type ToolOrigin = "static" | "dynamic";
export type ErrorCategory =
  | "validation"
  | "execution"
  | "not_found"
  | "timeout"
  | "unavailable"
  | "unknown";

export type SessionStatus = "active" | "completed" | "expired";

export type JourneyOutcome = "completed" | "abandoned" | "failed";
export type InferredIntent =
  | "purchase"
  | "comparison"
  | "lookup"
  | "browse"
  | "unknown";

export type FrictionType =
  | "MULTI_ENTITY_INSPECTION"
  | "REPEATED_SEQUENCE"
  | "EXCESSIVE_CALLS"
  | "FAILURE_LOOP"
  | "PARAMETER_ITERATION"
  | "MISSING_AGGREGATION";

export type Severity = "low" | "medium" | "high";

export type GapStatus =
  | "detected"
  | "recommendation_ready"
  | "simulated"
  | "approved"
  | "dismissed"
  | "published"
  | "resolved";

export type RecommendationStatus =
  | "draft"
  | "ready"
  | "simulated"
  | "approved"
  | "dismissed"
  | "published";

export type TemplateType = "COMPARE" | "BULK_READ" | "AVAILABILITY_BATCH";
export type EntityType = "product" | "inventory" | "cart" | "order";

export type MetricSource = "measured" | "simulated" | "estimated";
export type Actor = "system" | "human" | "agent";

export type GapType =
  | "COMPARE"
  | "BULK_READ"
  | "AVAILABILITY_BATCH"
  | "FILTER"
  | "UNKNOWN";

export interface ResultMeta {
  ok: boolean;
  itemCount?: number;
  entityIds?: string[];
  resultBytes?: number;
}

export interface ToolCallEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  sequenceIndex: number;
  toolName: string;
  toolVersion: string;
  origin: ToolOrigin;
  surface: Surface;
  capabilityId?: string;
  input: Record<string, unknown>;
  resultMeta: ResultMeta;
  success: boolean;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
  durationMs: number;
  page: string;
  entityIds?: string[];
  inputKeys?: string[];
}

export interface AgentSession {
  id: string;
  surface: Surface;
  startedAt: number;
  lastActivityAt: number;
  endedAt?: number;
  status: SessionStatus;
  callCount: number;
  tabId: string;
  userAgentHint?: string;
}

export interface JourneyStep {
  toolName: string;
  entityIds: string[];
  success: boolean;
  durationMs: number;
  repeatIndex: number;
  paramsHash: string;
  paramsKeys?: string[];
  sequenceIndex: number;
  errorCategory?: ErrorCategory;
}

export interface Journey {
  id: string;
  sessionId: string;
  steps: JourneyStep[];
  signature: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  callCount: number;
  outcome: JourneyOutcome;
  /** Inferred — not an observed fact. */
  inferredIntent: InferredIntent;
  frictionScore: number;
  repeatedToolCounts: Record<string, number>;
  distinctEntityCounts: Record<string, number>;
}

export interface JourneyPattern {
  signature: string;
  journeyCount: number;
  avgCalls: number;
  avgDurationMs: number;
  completionRate: number;
  inferredIntent: InferredIntent;
  journeyIds: string[];
}

export interface FrictionSignal {
  id: string;
  type: FrictionType;
  confidence: number;
  severity: Severity;
  journeyId: string;
  sessionId: string;
  involvedTools: string[];
  entityType?: EntityType;
  evidence: Record<string, unknown>;
  detectedAt: number;
  wastedCallsEstimate: number;
}

export interface StatusHistoryEntry {
  status: GapStatus;
  at: number;
  by: Actor;
  reason?: string;
}

export interface CapabilityGap {
  id: string;
  title: string;
  type: GapType;
  entityType: EntityType;
  /** Inferred — labeled in UI. */
  detectedIntent: InferredIntent;
  status: GapStatus;
  confidence: number;
  severity: Severity;
  supportingSessionIds: string[];
  affectedSessions: number;
  percentageOfRelevantJourneys: number;
  currentAvgCallCount: number;
  currentCompletionRate: number;
  signalIds: string[];
  mergeKey: string;
  firstDetectedAt: number;
  lastDetectedAt: number;
  recommendationId?: string;
  statusHistory: StatusHistoryEntry[];
  dismissalReason?: string;
  dismissedUntil?: number;
  resolvedAt?: number;
  resolvedByCapabilityId?: string;
}

export interface EstimatedBenefit {
  callReduction: number;
  latencyReductionMs: number;
  basis: "estimated";
}

export interface Recommendation {
  id: string;
  gapId: string;
  templateType: TemplateType;
  proposedToolName: string;
  description: string;
  inputSchemaJson: Record<string, unknown>;
  outputShapeJson: Record<string, unknown>;
  templateConfig: Record<string, unknown>;
  estimatedBenefit: EstimatedBenefit;
  risks: string[];
  explanation: { text: string; generatedBy: "deterministic" | "llm" };
  status: RecommendationStatus;
  createdBy: Actor;
  createdAt: number;
  updatedAt: number;
}

export interface MetricValue {
  calls: number;
  avgDurationMs: number;
  source: MetricSource;
}

export interface RecommendationSimulation {
  id: string;
  recommendationId: string;
  patternSignature: string;
  current: MetricValue & { source: "measured" };
  proposed: { calls: number; estDurationMs: number; source: "estimated" };
  affectedSessions: number;
  assumptions: string[];
  createdAt: number;
}

export interface PublishedCapability {
  id: string;
  recommendationId: string;
  toolName: string;
  templateType: TemplateType;
  config: Record<string, unknown>;
  version: number;
  status: "active" | "inactive";
  publishedAt: number;
  deactivatedAt?: number;
  registrationError?: string;
  schemaJson: Record<string, unknown>;
}

export interface CapabilityVersion {
  id: string;
  capabilityId: string;
  version: number;
  config: Record<string, unknown>;
  schemaJson: Record<string, unknown>;
  publishedAt: number;
}

export interface WindowRange {
  from: number;
  to: number;
}

export interface MeasuredWindowMetrics {
  avgCalls: number;
  completionRate: number;
  avgDurationMs: number;
  sampleSize: number;
  source: "measured";
}

export interface MetricSnapshot {
  id: string;
  capabilityId: string;
  version: number;
  windowBefore: WindowRange;
  windowAfter: WindowRange;
  journeyScope: { signature?: string; intent?: InferredIntent };
  before: MeasuredWindowMetrics;
  after: MeasuredWindowMetrics;
  sufficientData: boolean;
  computedAt: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  brand: string;
  specs: Record<string, string>;
  imageKey: string;
  description: string;
}

export interface Inventory {
  productId: string;
  stock: number;
  warehouse: string;
  restockAt?: number;
}

export interface CartItem {
  productId: string;
  qty: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  updatedAt: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: number;
  status: "simulated";
}

export interface AppSettings {
  id: "settings";
  inactivityTimeoutMs: number;
  redactionKeys: string[];
  maxTelemetryEvents: number;
  dismissalCooldownMs: number;
  polyfillEnabled: boolean;
  seededAt?: number;
}

export interface SchemaMeta {
  id: "meta";
  lastAnalyzedEventTimestamp: number;
  lastAnalysisAt?: number;
  analysisVersion: number;
}
