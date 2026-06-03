import type { BunRequest } from "bun";

export type TrafficHandler = (req: BunRequest) => Promise<Response>;

export interface RouteHandler {
  method: string;
  pathname: string;
  handler: TrafficHandler;
}
