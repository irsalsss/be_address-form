import type { AppError } from "../errors.js";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  details?: unknown;
}

export function toProblem(err: AppError, instance?: string): ProblemDetails {
  return {
    type: "about:blank",
    title: err.code,
    status: err.statusCode,
    detail: err.message,
    instance,
    code: err.code,
    details: err.details,
  };
}
