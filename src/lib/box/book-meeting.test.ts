import { describe, expect, it, vi } from "vitest";
import { bookBoxMeeting } from "./book-meeting";

describe("bookBoxMeeting", () => {
  it("schedules the meeting, completes the call, then moves to Reunião Agendada", async () => {
    const request = vi.fn(async (url: string) => {
      if (url.includes("/stages")) {
        return {
          stages: [
            { id: "s-entrada", canonical_key: "entrada" },
            { id: "s-reuniao", canonical_key: "reuniao_agendada" },
          ],
        };
      }
      return {};
    });

    await bookBoxMeeting(
      {
        activityId: "act-1",
        dealId: "deal-1",
        pipelineId: "pipe-1",
        canonicalKey: "tentando_contato",
        dueAt: "2026-09-10T10:00",
      },
      request,
    );

    expect(request.mock.calls.map((call) => [call[0], call[1]?.method])).toEqual(
      [
        ["/api/crm/deals/deal-1/schedule", "POST"],
        ["/api/crm/deals/deal-1/complete", "POST"],
        ["/api/crm/pipelines/pipe-1/stages", undefined],
        ["/api/crm/deals/deal-1/move", "POST"],
      ],
    );
    expect(JSON.parse(String(request.mock.calls[0]![1]?.body))).toEqual({
      kind: "reuniao",
      dueAt: "2026-09-10T10:00",
    });
    expect(JSON.parse(String(request.mock.calls[3]![1]?.body))).toEqual({
      stageId: "s-reuniao",
      position: 0,
    });
  });

  it("does not force the stage when the card is past first mile", async () => {
    const request = vi.fn(async () => ({}));

    await bookBoxMeeting(
      {
        activityId: "act-1",
        dealId: "deal-1",
        pipelineId: "pipe-1",
        canonicalKey: "reuniao_realizada",
        dueAt: "2026-09-10T10:00",
      },
      request,
    );

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]![0]).toContain("/schedule");
    expect(request.mock.calls[1]![0]).toContain("/complete");
  });
});
