import { GraphApiError, TokenExpiredError } from "@/api/graph-client";

export type ErrorContext = "teams" | "channels" | "filesFolder" | "files" | "search";

export interface UiError {
  title: string;
  description: string;
}

export function mapGraphError(error: unknown, context?: ErrorContext): UiError {
  if (error instanceof TokenExpiredError) {
    return {
      title: "Token expired",
      description: "Paste a new token to continue.",
    };
  }

  if (error instanceof GraphApiError) {
    if (error.status === 403) {
      if (context === "channels") {
        return {
          title: "Access denied",
          description:
            "You do not have permission to list channels for this team.\n\nTry a new Graph Explorer token with delegated scopes: Team.ReadBasic.All, Channel.ReadBasic.All, and Files.Read.All (or Sites.Read.All).",
        };
      }

      return {
        title: "Access denied",
        description:
          "You do not have access to this team's files.\n\nTry a new Graph Explorer token with delegated scopes: Files.Read.All (or Sites.Read.All), Team.ReadBasic.All, and Channel.ReadBasic.All.",
      };
    }

    if (error.status === 404) {
      return {
        title: "Files folder missing",
        description: "This channel does not have a files folder yet.",
      };
    }

    return {
      title: `Graph API error (${error.status})`,
      description: error.message,
    };
  }

  if (error instanceof TypeError) {
    return {
      title: "Network error",
      description: "Could not load files. Check your connection and retry.",
    };
  }

  return {
    title: "Unexpected error",
    description: "Something went wrong while loading data.",
  };
}

