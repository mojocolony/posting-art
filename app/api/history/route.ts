import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { postingRecords } from "../../../db/schema";
import { getRuntimeEnv } from "../../../db/runtime-env";

type RecordPayload = {
  id?: string;
  title?: string;
  format?: string;
  createdAt?: string;
  thumbnail?: string;
  platform?: "instagram" | "facebook";
  postedAt?: string | null;
};

function cleanTitle(value?: string) {
  return (value ?? "Untitled artwork").trim().slice(0, 120) || "Untitled artwork";
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Invalid thumbnail data");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1] };
}

function publicRecord(record: typeof postingRecords.$inferSelect) {
  return { ...record, thumbnailUrl: `/api/history/${record.id}/thumbnail` };
}

export async function GET() {
  const rows = await getDb().select().from(postingRecords).orderBy(desc(postingRecords.createdAt)).limit(100);
  return Response.json({ records: rows.map(publicRecord) });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as RecordPayload;
  if (!payload.id || !payload.thumbnail || !payload.format) {
    return Response.json({ error: "Missing posting record data" }, { status: 400 });
  }
  const decoded = decodeDataUrl(payload.thumbnail);
  const thumbnailKey = `posting-art/${payload.id}.jpg`;
  await getRuntimeEnv().BUCKET.put(thumbnailKey, decoded.bytes, { httpMetadata: { contentType: decoded.contentType } });
  const record = {
    id: payload.id,
    title: cleanTitle(payload.title),
    format: payload.format.slice(0, 32),
    createdAt: payload.createdAt ?? new Date().toISOString(),
    thumbnailKey,
    instagramAt: null,
    facebookAt: null,
  };
  await getDb().insert(postingRecords).values(record).onConflictDoUpdate({
    target: postingRecords.id,
    set: { title: record.title, format: record.format, thumbnailKey },
  });
  const [saved] = await getDb().select().from(postingRecords).where(eq(postingRecords.id, payload.id)).limit(1);
  return Response.json({ record: publicRecord(saved) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as RecordPayload;
  if (!payload.id || !payload.platform) return Response.json({ error: "Missing update data" }, { status: 400 });
  const field = payload.platform === "instagram" ? { instagramAt: payload.postedAt ?? null } : { facebookAt: payload.postedAt ?? null };
  await getDb().update(postingRecords).set(field).where(eq(postingRecords.id, payload.id));
  const [saved] = await getDb().select().from(postingRecords).where(eq(postingRecords.id, payload.id)).limit(1);
  return Response.json({ record: publicRecord(saved) });
}
