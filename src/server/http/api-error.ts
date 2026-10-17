import { NextResponse } from "next/server";

/** Stable API error codes; clients branch on `code`, never on `message`. */
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "EMAIL_TAKEN"
  | "INVALID_BODY"
  | "FORBIDDEN_ORIGIN"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_SUSPENDED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ROUTE_LOCKED"
  | "SEASON_LOCKED"
  | "SEASON_ENDED"
  | "ARCHIVED"
  | "CONFLICT"
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
  | "IMAGE_TYPE_NOT_ALLOWED"
  | "IMAGE_TOO_LARGE"
  | "JOIN_CLOSED"
  | "LINK_OFF"
  | "TEAM_FULL"
  | "ALREADY_MEMBER"
  | "REMOVED_FROM_TOURNAMENT"
  | "LAST_ADMIN"
  | "REASON_REQUIRED"
  | "ALREADY_DECIDED"
  | "QUOTA_REACHED"
  | "QUOTA_NOT_REACHED"
  | "REQUEST_PENDING"
  | "REQUEST_DECIDED"
  | "INVALID_REASON"
  | "INVALID_STATUS"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const messages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Some fields are invalid.",
  EMAIL_TAKEN: "This email cannot be used.",
  INVALID_BODY: "The request body must be a JSON object.",
  FORBIDDEN_ORIGIN: "Cross-site requests are not allowed.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  ACCOUNT_SUSPENDED: "This account is suspended. Contact the platform admin to restore it.",
  UNAUTHENTICATED: "Please log in to continue.",
  FORBIDDEN: "You do not have permission to do this.",
  NOT_FOUND: "The requested item was not found.",
  ROUTE_LOCKED: "The route cannot be changed after the season has started.",
  SEASON_LOCKED: "These settings cannot be changed after the season has started.",
  SEASON_ENDED: "The season has ended, so its end date can no longer be changed.",
  ARCHIVED: "An archived tournament cannot be edited.",
  CONFLICT: "The tournament changed in the meantime. Reload and try again.",
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
  IMAGE_TYPE_NOT_ALLOWED: "Only PNG, JPEG or WebP images are allowed.",
  IMAGE_TOO_LARGE: "The image is larger than 2 MB.",
  JOIN_CLOSED: "Joining this tournament is closed.",
  LINK_OFF: "This invite link has been switched off.",
  TEAM_FULL: "This team is full. Choose another team.",
  ALREADY_MEMBER: "You are already in a team of this tournament.",
  REMOVED_FROM_TOURNAMENT: "You were removed from this tournament and cannot join it again.",
  LAST_ADMIN: "The last platform admin role cannot be removed.",
  REASON_REQUIRED: "Give a short reason (at most 300 characters) to reject this swim.",
  ALREADY_DECIDED: "This swim has already been decided.",
  QUOTA_REACHED: "You have reached your tournament limit. Request more to create another.",
  QUOTA_NOT_REACHED: "You can request more tournaments only after reaching your limit.",
  REQUEST_PENDING: "You already have a pending request.",
  REQUEST_DECIDED: "This request has already been decided.",
  INVALID_REASON: "Give a short reason (1 to 500 characters).",
  INVALID_STATUS: "The status filter is not valid.",
  RATE_LIMITED: "You have reached the daily limit. Please try again tomorrow.",
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
