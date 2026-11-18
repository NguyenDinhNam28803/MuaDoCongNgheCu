// Tạo 2 bucket ảnh nếu chưa có (idempotent): pnpm storage:init
// Dev (SeaweedFS): quyền đọc công khai của bucket public cấu hình trong docker/seaweedfs/s3.json.
// R2: tạo bucket + bật public access cho bucket public trong dashboard Cloudflare.
import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { getStorageConfig } from "../src/server/storage/config";

const cfg = getStorageConfig();
const client = new S3Client({
  endpoint: cfg.endpoint,
  region: cfg.region,
  forcePathStyle: cfg.forcePathStyle,
  credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
});

// Trình duyệt PUT thẳng lên presigned URL → bucket cần CORS cho origin của web.
const origins = (process.env.S3_CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3100")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

for (const bucket of [cfg.publicBucket, cfg.privateBucket]) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket}: đã có`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket}: đã tạo`);
  }
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`Bucket ${bucket}: CORS cho ${origins.join(", ")}`);
}
