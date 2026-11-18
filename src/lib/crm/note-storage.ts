import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { NOTE_IMAGE_MAX_BYTES } from "@/lib/crm/note-images";

export const NOTE_BUCKET = "crm-notes";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signed-in user first, then the service role. */
export async function noteStorageClients(): Promise<SupabaseClient[]> {
  const clients: SupabaseClient[] = [];
  const user = await createUserClient();
  if (user) {
    const { data } = await user.auth.getUser();
    if (data.user) clients.push(user);
  }
  const admin = serviceClient();
  if (admin) clients.push(admin);
  return clients;
}

function bucketMissing(message: string): boolean {
  return /bucket not found|bucket does not exist/i.test(message);
}

async function ensureNoteBucket(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.storage.createBucket(NOTE_BUCKET, {
    public: false,
    fileSizeLimit: NOTE_IMAGE_MAX_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (!error) return true;
  return /already exists|duplicate/i.test(error.message);
}

export async function uploadNoteImage(
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string | null> {
  const clients = await noteStorageClients();
  if (!clients.length) return "storage indisponível";
  let message = "storage indisponível";
  for (const client of clients) {
    let { error } = await client.storage.from(NOTE_BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (error && bucketMissing(error.message)) {
      const admin = serviceClient();
      if (admin && (await ensureNoteBucket(admin))) {
        ({ error } = await admin.storage.from(NOTE_BUCKET).upload(path, bytes, {
          contentType: mime,
          upsert: false,
        }));
      }
    }
    if (!error) return null;
    message = error.message;
  }
  return message;
}

export async function downloadNoteImage(path: string): Promise<ArrayBuffer | null> {
  for (const client of await noteStorageClients()) {
    const { data, error } = await client.storage.from(NOTE_BUCKET).download(path);
    if (error || !data) continue;
    return data.arrayBuffer();
  }
  return null;
}

export async function removeNoteImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  for (const client of await noteStorageClients()) {
    const { error } = await client.storage.from(NOTE_BUCKET).remove(paths);
    if (!error) return;
  }
}
