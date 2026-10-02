// Chat replies.
//
// The chat server stores plain lines, "YYYY-MM-DD HH:MM:SS name: text", with
// no message ids. A reply is an ordinary message whose text starts with a
// marker naming the message it answers by timestamp and name:
//
//   [RE:2026-09-25 12:00:01|SV1BTL] yes, I hear him too
//
// The server passes it through untouched; the clients read the marker and show
// the reply under the message it answers. Shared by App.svelte and /mobile.

const LINE_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (.+?): (.*)$/;
const REPLY_RE = /^\[RE:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\|(.{1,14}?)\]\s*/;

/** Split a chat line into timestamp, name and text; null if it is not one. */
export function parseChatLine(line) {
  const m = LINE_RE.exec(line || "");
  if (!m) return null;
  return { timestamp: m[1], username: m[2], body: m[3] };
}

/** The marker to put in front of a reply to this parsed line. */
export function replyMarker(parsed) {
  return `[RE:${parsed.timestamp}|${parsed.username}] `;
}

/** Split a message body into its reply target (or null) and the text. */
export function splitReply(body) {
  const m = REPLY_RE.exec(body || "");
  if (!m) return { replyTo: null, text: body || "" };
  return {
    replyTo: { timestamp: m[1], username: m[2] },
    text: body.slice(m[0].length),
  };
}

/** Rewrite a chat line without its reply marker, so it renders as before. */
export function stripReplyMarker(line) {
  const p = parseChatLine(line);
  if (!p) return line;
  return `${p.timestamp} ${p.username}: ${splitReply(p.body).text}`;
}

/** Short one-line preview of a message body, for the quote above a reply. */
export function replySnippet(body, max = 60) {
  const text = splitReply(body)
    .text.replace(/\[FREQ:(\d+):([\w-]+)\]/g, (_, hz, mode) =>
      `${(Number(hz) / 1000).toFixed(3)} kHz ${mode}`,
    )
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const keyOf = (ts, name) => `${ts}|${name}`;

/**
 * Order messages into threads, one level deep. Each message in `list` needs a
 * `text` (the raw line); the result wraps it as
 *   { msg, parsed, depth, quote }
 * where depth is 1 for a reply shown under its parent, and quote is
 * { username, time, snippet } for any reply (snippet is "" when the parent has
 * already left the 20-line history). A reply to a reply joins the root's
 * thread. A reply whose parent is gone stays where it arrived, at depth 0.
 */
export function threadMessages(list) {
  const items = list.map((msg) => {
    const parsed = parseChatLine(msg.text);
    const reply = parsed ? splitReply(parsed.body) : { replyTo: null };
    return { msg, parsed, replyTo: reply.replyTo, depth: 0, quote: null };
  });

  const byKey = new Map();
  for (const it of items) {
    if (it.parsed) {
      const k = keyOf(it.parsed.timestamp, it.parsed.username);
      if (!byKey.has(k)) byKey.set(k, it);
    }
  }

  const children = new Map(); // root item -> replies, in arrival order
  const roots = [];
  const isRoot = new Set();
  for (const it of items) {
    let parent = null;
    if (it.replyTo) {
      parent = byKey.get(keyOf(it.replyTo.timestamp, it.replyTo.username));
      if (parent === it) parent = null;
      it.quote = {
        username: it.replyTo.username,
        time: it.replyTo.timestamp.slice(11),
        snippet: parent ? replySnippet(parent.parsed.body) : "",
      };
    }
    // Follow the chain up to its top-level message. Messages are walked in
    // arrival order, so a parent listed earlier has already been placed.
    const seen = new Set([it]);
    while (parent && !isRoot.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      parent = parent.replyTo
        ? byKey.get(keyOf(parent.replyTo.timestamp, parent.replyTo.username))
        : null;
    }
    if (!parent || !isRoot.has(parent)) {
      roots.push(it);
      isRoot.add(it);
      continue;
    }
    it.depth = 1;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(it);
  }

  const out = [];
  for (const r of roots) {
    out.push(r);
    for (const c of children.get(r) || []) out.push(c);
  }
  return out;
}
