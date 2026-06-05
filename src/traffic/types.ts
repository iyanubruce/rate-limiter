import type { BunRequest } from "bun";
import type { ZodObject } from "zod";

export type TrafficHandler = (req: BunRequest) => Promise<Response>;

export interface ValidationSchema {
  body?: ZodObject<any>;
  params?: ZodObject<any>;
  query?: ZodObject<any>;
  headers?: ZodObject<any>;
}

export type RouteValidator = (req: BunRequest) => { error?: string };

export interface RouteHandler {
  method: string;
  pathname: string;
  handler: TrafficHandler;
  validator?: ValidationSchema;
}
