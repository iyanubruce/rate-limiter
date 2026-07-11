import { answerQuestion } from "../../services/analytics-interpreter";

export async function askAnalytics(
  tenantId: string,
  question: string,
): Promise<{ answer: string; data: Record<string, unknown> }> {
  return answerQuestion(tenantId, question);
}
