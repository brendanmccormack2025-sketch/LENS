// Shared contract between the app and the `analyze` edge function.
// Keep in sync with supabase/functions/_shared/schema.ts.

export type Verdict = 'likely_safe' | 'be_careful' | 'likely_scam' | 'unclear';

export type AnalyzeRequest =
  | { kind: 'image'; imageBase64: string; mediaType: 'image/jpeg' | 'image/png' }
  | { kind: 'url'; url: string; source: 'qr' | 'paste' | 'share' }
  | { kind: 'text'; text: string }
  | { kind: 'video'; frames: { imageBase64: string; mediaType: 'image/jpeg' }[]; durationSec: number | null };

export interface RedFlag {
  signal: string; // short label, e.g. "Urgent payment request"
  why: string; // plain-English explanation
}

export interface Analysis {
  verdict: Verdict;
  confidence: 'low' | 'medium' | 'high';
  headline: string;
  what_it_is: string;
  red_flags: RedFlag[];
  reassuring_signs: string[];
  next_steps: string[];
  cannot_verify: string;
  // Filled in by the server's deterministic checks (not the model).
  link_checks?: LinkCheck[];
}

export interface LinkCheck {
  input: string;
  finalUrl: string;
  hostname: string;
  redirects: number;
  flags: string[];
  knownThreat: string[] | null; // Google Web Risk threat types, if listed
  reputationChecked: boolean;
}

export interface AnalyzeResponse {
  analysis: Analysis;
  scansRemainingToday: number | null;
}
