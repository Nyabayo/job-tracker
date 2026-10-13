import "server-only";
import { CreateBucketCommand, DeleteObjectsCommand, HeadBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

// Files live in a PRIVATE bucket under users/<userId>/<random key>. The original
// file name is kept only as metadata in the documents table (section 7).

const globalForS3 = globalThis as unknown as { jobTrackerS3?: S3Client };

export function s3(): S3Client {
  const e = env();
  globalForS3.jobTrackerS3 ??= new S3Client({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
  });
  return globalForS3.jobTrackerS3;
}

/** Creates the private bucket on first start if it doesn't exist yet. */
export async function ensureBucket(): Promise<void> {
  const Bucket = env().S3_BUCKET;
  try {
    await s3().send(new HeadBucketCommand({ Bucket }));
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404) throw err;
    await s3().send(new CreateBucketCommand({ Bucket }));
  }
}

export function userPrefix(userId: string): string {
  return `users/${userId}/`;
}

/** A7: removes every file a user stored. Returns how many objects were deleted. */
export async function deleteUserFiles(userId: string): Promise<number> {
  const bucket = env().S3_BUCKET;
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: userPrefix(userId), ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
