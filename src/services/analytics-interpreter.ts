import * as analyticsController from "../api/controllers/analytics";
import { generateResponse, generateSummary } from "./ai-service";
import type { ToolDefinition, ToolCall } from "./ai-service";

const ANALYTICS_TOOLS: ToolDefinition[] = [
  {
    name: "analyticsOverview",
    description: "Get an overview of traffic including total requests, blocked requests, block rate, average response time, and top endpoints",
    parameters: {
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsTimeseries",
    description: "Get traffic data over time grouped by interval (1m, 5m, 1h, 1d)",
    parameters: {
      interval: { type: "string", description: "Time interval: 1m, 5m, 1h, or 1d", optional: true },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsTopBlocked",
    description: "Get the most blocked IPs and endpoints",
    parameters: {
      limit: { type: "number", description: "Number of results to return", optional: true },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsEndpoints",
    description: "Get traffic breakdown by API endpoint",
    parameters: {
      limit: { type: "number", description: "Number of results to return", optional: true },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsPatterns",
    description: "Get traffic patterns including suspicious IPs, burst patterns, and top talkers",
    parameters: {
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsStatusCodes",
    description: "Get HTTP status code distribution of traffic",
    parameters: {
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
  {
    name: "analyticsIpAddresses",
    description: "Get traffic breakdown by IP address",
    parameters: {
      limit: { type: "number", description: "Number of results to return", optional: true },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD format)", optional: true },
      endDate: { type: "string", description: "End date (YYYY-MM-DD format)", optional: true },
    },
  },
];

const SYSTEM_PROMPT = `You are a rate limiting analytics assistant. Your job is to help users understand their API traffic data by choosing the right analytics tool(s) to answer their question.

Available tools:
${ANALYTICS_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Rules:
1. Choose the tool that best answers the user's question
2. Set date parameters based on time references in the question (e.g. "last week", "yesterday", "today")
3. If no date is mentioned, omit date parameters (defaults to last 24 hours)
4. You can call multiple tools if needed
5. Return ONLY tool calls, no text`;

function dateRangeFromReference(reference?: string): { startDate?: string; endDate?: string } {
  if (!reference) return {};
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (reference.includes("last week") || reference.includes("past week")) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: start.toISOString().split("T")[0], endDate: today };
  }
  if (reference.includes("last month") || reference.includes("past month")) {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { startDate: start.toISOString().split("T")[0], endDate: today };
  }
  if (reference.includes("yesterday")) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const day = start.toISOString().split("T")[0];
    return { startDate: day, endDate: day };
  }
  if (reference.includes("today")) {
    return { startDate: today, endDate: today };
  }
  return {};
}

async function dispatchToolCall(
  toolCall: ToolCall,
  tenantId: string,
): Promise<{ name: string; result: unknown }> {
  const { name, arguments: args } = toolCall;
  const params = args as Record<string, string | undefined>;

  let result: unknown;

  switch (name) {
    case "analyticsOverview":
      result = await analyticsController.analyticsOverview(
        tenantId,
        params.startDate,
        params.endDate,
      );
      break;
    case "analyticsTimeseries":
      result = await analyticsController.analyticsTimeseries(tenantId, {
        interval: params.interval,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      break;
    case "analyticsTopBlocked":
      result = await analyticsController.analyticsTopBlocked(tenantId, {
        limit: params.limit ? Number(params.limit) : undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      break;
    case "analyticsEndpoints":
      result = await analyticsController.analyticsEndpoints(tenantId, {
        limit: params.limit ? Number(params.limit) : undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      break;
    case "analyticsPatterns":
      result = await analyticsController.analyticsPatterns(
        tenantId,
        params.startDate,
        params.endDate,
      );
      break;
    case "analyticsStatusCodes":
      result = await analyticsController.analyticsStatusCodes(
        tenantId,
        params.startDate,
        params.endDate,
      );
      break;
    case "analyticsIpAddresses":
      result = await analyticsController.analyticsIpAddresses(tenantId, {
        limit: params.limit ? Number(params.limit) : undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      break;
    default:
      throw new Error(`Unknown analytics tool: ${name}`);
  }

  return { name, result };
}

export async function answerQuestion(
  tenantId: string,
  question: string,
): Promise<{ answer: string; data: Record<string, unknown> }> {
  const step1 = await generateResponse({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: question,
    tools: ANALYTICS_TOOLS,
  });

  if (step1.toolCalls.length === 0) {
    return {
      answer: "I couldn't determine which analytics data to fetch for your question. Try being more specific (e.g., 'Show me my traffic overview from last week').",
      data: {},
    };
  }

  const results: Record<string, unknown> = {};

  for (const toolCall of step1.toolCalls) {
    const { name, result } = await dispatchToolCall(toolCall, tenantId);
    results[name] = result;
  }

  const answer = await generateSummary({
    question,
    results,
  });

  return { answer, data: results };
}
