import { graphFetch } from "@/api/graph-client";
import type { TeamsMessagesResponse } from "@/types";

export async function getChannelMessages(
  teamId: string,
  channelId: string,
  top = 50,
): Promise<TeamsMessagesResponse> {
  return graphFetch<TeamsMessagesResponse>(`/teams/${teamId}/channels/${channelId}/messages`, {
    "$top": top.toString(),
    "$orderby": "lastModifiedDateTime desc",
  });
}

export async function getNewChannelMessages(
  teamId: string,
  channelId: string,
  since: string,
): Promise<TeamsMessagesResponse> {
  return graphFetch<TeamsMessagesResponse>(`/teams/${teamId}/channels/${channelId}/messages/delta`, {
    "$filter": `lastModifiedDateTime gt ${since}`,
  });
}

export async function getMessageReplies(
  teamId: string,
  channelId: string,
  messageId: string,
): Promise<TeamsMessagesResponse> {
  return graphFetch<TeamsMessagesResponse>(
    `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
  );
}
