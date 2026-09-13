import { setPendingShare, takePendingShare } from "../src/services/pendingShare";

describe("pendingShare", () => {
  it("returns the payload set via setPendingShare, then clears the slot", () => {
    const payload = {
      extraction: { summary: "s", people: [], topics: [], action_items: [] },
      transcript: "t",
    };
    setPendingShare(payload);

    expect(takePendingShare()).toEqual(payload);
    expect(takePendingShare()).toBeNull();
  });

  it("returns null when nothing is pending", () => {
    expect(takePendingShare()).toBeNull();
  });
});
