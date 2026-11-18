export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
};

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const required = (name: string) => {
    const v = env[name];
    if (!v) throw new Error(`${name} chưa được cấu hình (xem .env.example)`);
    return v;
  };
  return {
    endpoint: required("S3_ENDPOINT"),
    region: env.S3_REGION || "auto",
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    publicBucket: required("S3_PUBLIC_BUCKET"),
    privateBucket: required("S3_PRIVATE_BUCKET"),
    publicBaseUrl: required("S3_PUBLIC_BASE_URL").replace(/\/+$/, ""),
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  };
}
