import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type ExportKind = "metrics" | "clients";

export type ExportTicketPayload = {
  kind: ExportKind;
  sub: string;
  exp: number;
  jti: string;
};

type CachedExport = {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
};

type ExportBufferStore = Map<string, CachedExport>;

function ticketSecret(): string {
  return (
    process.env.EXPORT_TICKET_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "rebel-law-demo-export-ticket"
  );
}

function getBufferStore(): ExportBufferStore {
  const g = globalThis as typeof globalThis & {
    __attorneyExportBuffers?: ExportBufferStore;
  };
  if (!g.__attorneyExportBuffers) {
    g.__attorneyExportBuffers = new Map();
  }
  return g.__attorneyExportBuffers;
}

export function isExportKind(value: string | null): value is ExportKind {
  return value === "metrics" || value === "clients";
}

export function signExportTicket(input: {
  kind: ExportKind;
  sub: string;
  ttlSeconds?: number;
}): string {
  const payload: ExportTicketPayload = {
    kind: input.kind,
    sub: input.sub,
    jti: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 90),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyExportTicket(ticket: string): ExportTicketPayload | null {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ExportTicketPayload;
    if (!isExportKind(payload.kind) || !payload.sub || !payload.jti || !payload.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseExportTicket(ticket: string): ExportTicketPayload | null {
  return verifyExportTicket(ticket);
}

export function storeExportBuffer(
  jti: string,
  buffer: Buffer,
  filename: string,
  ttlSeconds = 90
): void {
  const store = getBufferStore();
  const now = Date.now();
  for (const [key, value] of store) {
    if (value.expiresAt <= now) store.delete(key);
  }
  store.set(jti, {
    buffer,
    filename,
    expiresAt: now + ttlSeconds * 1000,
  });
}

export function takeExportBuffer(jti: string): { buffer: Buffer; filename: string } | null {
  const store = getBufferStore();
  const entry = store.get(jti);
  if (!entry) return null;
  store.delete(jti);
  if (entry.expiresAt <= Date.now()) return null;
  return { buffer: entry.buffer, filename: entry.filename };
}

export function exportPathForKind(kind: ExportKind): string {
  return kind === "metrics"
    ? "/api/attorney/metrics-export"
    : "/api/attorney/clients-export";
}

export function absoluteExportUrl(request: Request, kind: ExportKind, ticket: string): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (url.protocol === "https:" ? "https" : "http");
  const path = exportPathForKind(kind);
  return `${proto}://${host}${path}?ticket=${encodeURIComponent(ticket)}`;
}
