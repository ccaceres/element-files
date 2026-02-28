import { describe, expect, it } from "vitest";
import { syncEngine } from "@/sync/sync-engine";
import type { TeamsMessage } from "@/types";

function makeMessage(): TeamsMessage {
  return {
    id: "msg-1",
    createdDateTime: "2026-01-01T12:00:00.000Z",
    lastModifiedDateTime: "2026-01-01T12:00:00.000Z",
    messageType: "message",
    body: {
      contentType: "html",
      content: "<p>Hello <strong>world</strong></p>",
    },
    from: {
      user: {
        id: "u1",
        displayName: "Carlos",
      },
    },
    attachments: [
      {
        id: "a1",
        contentType: "reference",
        name: "Plan.docx",
        contentUrl: "https://example.org/plan.docx",
      },
    ],
  };
}

describe("syncEngine message formatting", () => {
  it("builds plain and html message payloads", () => {
    const message = makeMessage();

    const plain = syncEngine.formatMessagePlain("Carlos", message);
    const html = syncEngine.formatMessageHtml("Carlos", message);

    expect(plain).toContain("via Teams");
    expect(plain).toContain("Plan.docx");
    expect(html).toContain("<strong>💬 Carlos</strong>");
    expect(html).toContain("<a href=");
  });
});
