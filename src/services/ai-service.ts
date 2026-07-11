import Groq from "groq-sdk";
import config from "../config/env";
import logger from "../utils/logger";

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) {
    if (!config.ai.apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    client = new Groq({ apiKey: config.ai.apiKey });
  }
  return client;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface GenerateOptions {
  systemPrompt: string;
  userMessage: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
}

interface GenerateResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

function toGroqTools(tools: ToolDefinition[]): Groq.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.parameters as Record<string, unknown>,
        required: Object.entries(t.parameters)
          .filter(([, v]) => {
            const param = v as { optional?: boolean };
            return !param.optional;
          })
          .map(([k]) => k),
      },
    },
  }));
}

function parseArguments(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

export async function generateResponse(options: GenerateOptions): Promise<GenerateResponse> {
  const { systemPrompt, userMessage, tools, maxTokens } = options;
  const groq = getClient();

  try {
    const response = await groq.chat.completions.create({
      model: config.ai.model,
      max_tokens: maxTokens ?? 1024,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      ...(tools && tools.length > 0
        ? { tools: toGroqTools(tools), tool_choice: "auto" as const }
        : {}),
    });

    const message = response.choices[0]?.message;

    return {
      text: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? [])
        .map((tc) => {
          if ("function" in tc) {
            return { name: tc.function.name, arguments: parseArguments(tc.function.arguments) };
          }
          return null;
        })
        .filter((tc): tc is ToolCall => tc !== null),
    };
  } catch (error) {
    logger.error("AI service error", { error });
    if (error instanceof Groq.APIError) {
      throw new Error(`AI service error: ${error.status} ${error.message}`);
    }
    throw error;
  }
}

export async function generateSummary(params: {
  question: string;
  results: Record<string, unknown>;
}): Promise<string> {
  const { question, results } = params;

  const response = await generateResponse({
    systemPrompt:
      "You are a helpful analytics assistant. You receive analytics data and must generate a concise, natural language answer to the user's original question. Include specific numbers. Keep it under 4 sentences.",
    userMessage: `Original question: "${question}"\n\nAnalytics data:\n${JSON.stringify(results, null, 2)}`,
    maxTokens: 512,
  });

  return response.text ?? "I couldn't generate a summary of the analytics data.";
}
