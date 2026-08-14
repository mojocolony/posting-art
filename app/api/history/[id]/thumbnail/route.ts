import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { postingRecords } from "../../../../../db/schema";
import { getRuntimeEnv } from "../../../../../db/runtime-env";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [record] = await getDb().select().from(postingRecords).where(eq(postingRecords.id, id)).limit(1);
  if (!record) return new Response("Not found", { status: 404 });
  const object = await getRuntimeEnv().BUCKET.get(record.thumbnailKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
