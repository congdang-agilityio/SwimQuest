import { NextResponse } from "next/server";

/** Stable API error codes; clients branch on `code`, never on `message`. */
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "EMAIL_TAKEN"
  | "INVALID_BODY"
  | "FORBIDDEN_ORIGIN"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ROUTE_LOCKED"
  | "START_LOCKED"
  | "LIMIT_BELOW_MEMBERS"
  | "TEAM_NOT_DELETABLE"
  | "INVALID_START"
  | "NOT_A_MEMBER"
  | "PUBLISH_INVALID"
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "UNREADABLE_FILE"
  | "NO_DISTANCE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const messages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Some fields are invalid.",
  EMAIL_TAKEN: "This email cannot be used.",
  INVALID_BODY: "The request body must be a JSON object.",
  FORBIDDEN_ORIGIN: "Cross-site requests are not allowed.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  UNAUTHENTICATED: "Please log in to continue.",
  FORBIDDEN: "You do not have permission to do this.",
  NOT_FOUND: "The requested item was not found.",
  ROUTE_LOCKED: "The route cannot be changed after the season has started.",
  START_LOCKED: "The team's start is locked and can no longer be changed.",
  LIMIT_BELOW_MEMBERS: "The member limit cannot be lower than the current members.",
  TEAM_NOT_DELETABLE: "Only an empty team of a draft tournament can be deleted.",
  INVALID_START: "Choose one of the route's start destinations.",
  NOT_A_MEMBER: "Choose an active member of this team.",
  PUBLISH_INVALID: "The tournament cannot be published yet.",
  FILE_REQUIRED: "Choose a GPX or FIT file to upload.",
  FILE_TOO_LARGE: "The file is larger than 10 MB.",
  UNSUPPORTED_FILE: "Only GPX or FIT files are supported. Export one from your watch or app.",
  UNREADABLE_FILE: "The file has no readable activity data. Export it again as GPX or FIT.",
  NO_DISTANCE: "The file has no swim distance. Export it as FIT or with distance from your app.",
  SERVICE_UNAVAILABLE: "This service is not available right now.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again later.",
};

/** A JSON error response: `{ error: { code, message, fields? } }`, never cached. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  fields?: Record<string, string>,
  issues?: readonly object[],
): NextResponse {
  const error = { code, message: messages[code], fields, issues }; // undefined keys are not serialized
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
