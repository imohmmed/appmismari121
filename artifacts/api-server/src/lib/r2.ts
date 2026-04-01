import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "a379088eac7ce0a08c7e93a16ee5faa6";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET     = process.env.R2_BUCKET || "mismari";
const DL_DOMAIN  = process.env.R2_DL_DOMAIN || "https://dl.mismari.com";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

/** Upload a buffer to R2. Returns the public dl.mismari.com URL. */
export async function r2Upload(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<string> {
  const upload = new Upload({
    client: r2,
    params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
  return r2Url(key);
}

/** Delete a file from R2 by key. */
export async function r2Delete(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Returns the public URL for a key. */
export function r2Url(key: string): string {
  return `${DL_DOMAIN}/${key}`;
}

/** Extract R2 key from a dl.mismari.com URL or a legacy /admin/FilesIPA/… path. */
export function urlToKey(url: string): string | null {
  if (!url) return null;
  // dl.mismari.com/xxx  or  https://dl.mismari.com/xxx
  const dlMatch = url.match(/dl\.mismari\.com\/(.+)/);
  if (dlMatch) return dlMatch[1];
  // /admin/FilesIPA/IpaApp/xxx → FilesIPA/IpaApp/xxx
  const ipaMatch = url.match(/\/admin\/(FilesIPA\/.+)/);
  if (ipaMatch) return ipaMatch[1];
  // /admin/FilesIPA/Icons/xxx
  const iconMatch = url.match(/\/admin\/(FilesIPA\/Icons\/.+)/);
  if (iconMatch) return iconMatch[1];
  return null;
}
