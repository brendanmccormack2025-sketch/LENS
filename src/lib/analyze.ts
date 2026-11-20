import { FunctionsHttpError } from '@supabase/supabase-js';
import { ensureSession, supabase } from './supabase';
import type { AnalyzeRequest, AnalyzeResponse } from './types';

export class LimitReachedError extends Error {}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  await ensureSession();
  const { data, error } = await supabase.functions.invoke<AnalyzeResponse>('analyze', { body: req });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) throw new LimitReachedError(body.error ?? 'Daily limit reached');
      throw new Error(body.error ?? 'Something went wrong. Please try again.');
    }
    throw new Error('Could not reach LENS. Check your connection and try again.');
  }
  if (!data) throw new Error('Empty response');
  return data;
}

// Tiny hand-off so large payloads (screenshots) don't go through route params.
let pending: AnalyzeRequest | null = null;
export const setPending = (r: AnalyzeRequest) => {
  pending = r;
};
export const takePending = () => {
  const r = pending;
  pending = null;
  return r;
};
