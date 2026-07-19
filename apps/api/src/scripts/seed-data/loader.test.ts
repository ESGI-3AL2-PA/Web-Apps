import { describe, expect, it } from "vitest";
import { DROPPED_COLLECTIONS, MONGO_COLLECTIONS, parseSeedData, resolveToken, SeedParseError } from "./loader.js";
import type { TokenContext } from "./loader.js";

const ctx: TokenContext = {
  now: new Date("2026-07-19T12:00:00.000Z"),
  passwordHash: "$argon2id$fake",
};

const parse = (text: string) => parseSeedData(text, ctx, "test.txt");

// Every error case asserts the reported line number — that precision is the whole
// ergonomic payoff of NDJSON over one big JSON blob.
const expectParseError = (text: string, line: number, message: RegExp) => {
  try {
    parse(text);
  } catch (err) {
    expect(err).toBeInstanceOf(SeedParseError);
    expect((err as SeedParseError).line).toBe(line);
    expect((err as SeedParseError).message).toMatch(message);
    return;
  }
  throw new Error("expected parseSeedData to throw");
};

describe("parseSeedData", () => {
  it("groups documents under their active directive", () => {
    const data = parse(
      [
        "@collection districts",
        '{"_id":"d1","name":"Montmartre"}',
        "@collection users",
        '{"_id":"u1","email":"alice@example.com"}',
        '{"_id":"u2","email":"bob@example.com"}',
      ].join("\n"),
    );

    expect(data.collections.get("districts")).toEqual([{ _id: "d1", name: "Montmartre" }]);
    expect(data.collections.get("users")).toHaveLength(2);
    expect(data.totalDocuments).toBe(3);
  });

  it("ignores blank lines and # comments", () => {
    const data = parse(
      ["# leading prose", "", "@collection tags", "  ", "# why this tag exists", '{"_id":"t1","name":"diy"}'].join(
        "\n",
      ),
    );

    expect(data.collections.get("tags")).toHaveLength(1);
  });

  it("does not treat a # inside a JSON string value as a comment", () => {
    const data = parse(["@collection messages", '{"_id":"m1","content":"# not a comment"}'].join("\n"));

    expect(data.collections.get("messages")![0]!.content).toBe("# not a comment");
  });

  it("orders collections by MONGO_COLLECTIONS regardless of directive order", () => {
    const data = parse(
      [
        "@collection listings",
        '{"_id":"l1"}',
        "@collection districts",
        '{"_id":"d1"}',
        "@collection users",
        '{"_id":"u1"}',
      ].join("\n"),
    );

    expect([...data.collections.keys()]).toEqual(["districts", "users", "listings"]);
  });

  it("appends when a directive is repeated", () => {
    const data = parse(
      [
        "@collection users",
        '{"_id":"u1"}',
        "@collection tags",
        '{"_id":"t1"}',
        "@collection users",
        '{"_id":"u2"}',
      ].join("\n"),
    );

    expect(data.collections.get("users")!.map((d) => d._id)).toEqual(["u1", "u2"]);
  });

  it("collects the graph-only datasets", () => {
    const data = parse(
      [
        "@graph interests",
        '{"userId":"u1","eventId":"e1","score":3}',
        "@graph event_tags",
        '{"eventId":"e1","tags":["gardening","diy"]}',
      ].join("\n"),
    );

    expect(data.graph.interests).toEqual([{ userId: "u1", eventId: "e1", score: 3 }]);
    expect(data.graph.eventTags).toEqual([{ eventId: "e1", tags: ["gardening", "diy"] }]);
    // Graph rows have no _id and must not inflate the Mongo document count.
    expect(data.totalDocuments).toBe(0);
  });

  it("resolves tokens, including nested ones, to a stable now", () => {
    const data = parse(
      [
        "@collection votes",
        '{"_id":"v1","createdAt":"{{now}}","endDate":"{{now-1d}}","window":{"opens":"{{now+7d}}"},"hash":"{{passwordHash}}"}',
      ].join("\n"),
    );

    expect(data.collections.get("votes")![0]).toEqual({
      _id: "v1",
      createdAt: "2026-07-19T12:00:00.000Z",
      endDate: "2026-07-18T12:00:00.000Z",
      window: { opens: "2026-07-26T12:00:00.000Z" },
      hash: "$argon2id$fake",
    });
  });

  it("resolves tokens inside arrays", () => {
    const data = parse(["@collection events", '{"_id":"e1","slots":["{{now}}","{{now+1d}}"]}'].join("\n"));

    expect(data.collections.get("events")![0]!.slots).toEqual(["2026-07-19T12:00:00.000Z", "2026-07-20T12:00:00.000Z"]);
  });

  it("leaves strings that merely contain braces untouched", () => {
    const data = parse(["@collection messages", '{"_id":"m1","content":"Rendez-vous {{ici}} demain"}'].join("\n"));

    expect(data.collections.get("messages")![0]!.content).toBe("Rendez-vous {{ici}} demain");
  });

  it("preserves non-string scalars", () => {
    const data = parse(["@collection users", '{"_id":"u1","balance":20,"emailVerified":true,"phone":null}'].join("\n"));

    expect(data.collections.get("users")![0]).toEqual({ _id: "u1", balance: 20, emailVerified: true, phone: null });
  });

  describe("errors", () => {
    it("reports malformed JSON with its line number", () => {
      expectParseError(["@collection users", '{"_id":"u1"}', "{not json}"].join("\n"), 3, /invalid JSON/);
    });

    it("rejects a document before any directive", () => {
      expectParseError(["# prose", '{"_id":"u1"}'].join("\n"), 2, /before any @collection/);
    });

    it("rejects an unknown collection", () => {
      expectParseError("@collection user", 1, /unknown collection "user"/);
    });

    it("rejects an unknown graph target", () => {
      expectParseError("@graph interest", 1, /unknown graph target "interest"/);
    });

    it("rejects an unknown directive verb", () => {
      expectParseError("@collections users", 1, /unknown directive "@collections"/);
    });

    it("rejects a malformed directive", () => {
      expectParseError("@collection", 1, /malformed directive/);
    });

    it("rejects a document with no _id", () => {
      expectParseError(
        ["@collection users", '{"email":"alice@example.com"}'].join("\n"),
        2,
        /missing a non-empty string _id/,
      );
    });

    it("rejects a duplicate _id and names the first occurrence", () => {
      expectParseError(
        ["@collection users", '{"_id":"u1"}', '{"_id":"u1"}'].join("\n"),
        3,
        /duplicate _id "u1" \(first seen on line 2\)/,
      );
    });

    it("rejects an unknown token", () => {
      expectParseError(["@collection users", '{"_id":"u1","createdAt":"{{nwo}}"}'].join("\n"), 2, /unknown token/);
    });

    it("rejects a non-object document line", () => {
      expectParseError(["@collection users", "[1,2,3]"].join("\n"), 2, /must be a JSON object/);
    });

    it("rejects a malformed interest row", () => {
      expectParseError(
        ["@graph interests", '{"userId":"u1","eventId":"e1","score":"high"}'].join("\n"),
        2,
        /numeric score/,
      );
    });

    it("rejects a malformed event_tags row", () => {
      expectParseError(["@graph event_tags", '{"eventId":"e1","tags":"diy"}'].join("\n"), 2, /string\[\] tags/);
    });
  });
});

describe("resolveToken", () => {
  it("supports every offset unit in both directions", () => {
    expect(resolveToken("now", ctx)).toBe("2026-07-19T12:00:00.000Z");
    expect(resolveToken("now+30s", ctx)).toBe("2026-07-19T12:00:30.000Z");
    expect(resolveToken("now-15m", ctx)).toBe("2026-07-19T11:45:00.000Z");
    expect(resolveToken("now+2h", ctx)).toBe("2026-07-19T14:00:00.000Z");
    expect(resolveToken("now-30d", ctx)).toBe("2026-06-19T12:00:00.000Z");
  });

  it("throws on anything it does not recognise", () => {
    expect(() => resolveToken("yesterday", ctx)).toThrow(/unknown token/);
  });
});

// The seed drops these collections outright, so this list is the blast radius of every
// `docker compose up`. Pin it: a collection added here by accident is unrecoverable
// data loss on someone's dev box, and silent.
describe("DROPPED_COLLECTIONS", () => {
  it("never includes a collection the seed does not own", () => {
    const NEVER_DROP = ["refresh_tokens", "contracts", "authorization_codes", "migrations", "event_interactions"];

    expect(DROPPED_COLLECTIONS.filter((name) => NEVER_DROP.includes(name))).toEqual([]);
  });

  it("is exactly the seeded collections plus the sync trio", () => {
    expect([...DROPPED_COLLECTIONS]).toEqual([...MONGO_COLLECTIONS, "sync_changes", "sync_state", "counters"]);
  });

  it("keeps the sync trio intact — dropping a subset corrupts desktop clients", () => {
    for (const name of ["sync_changes", "sync_state", "counters"]) {
      expect(DROPPED_COLLECTIONS).toContain(name);
    }
  });
});

describe("MONGO_COLLECTIONS", () => {
  it("lists districts and users before the collections that reference them", () => {
    const order = MONGO_COLLECTIONS.indexOf.bind(MONGO_COLLECTIONS);
    expect(order("districts")).toBeLessThan(order("users"));
    expect(order("users")).toBeLessThan(order("listings"));
    expect(order("votes")).toBeLessThan(order("vote_responses"));
    expect(order("conversations")).toBeLessThan(order("messages"));
  });
});
