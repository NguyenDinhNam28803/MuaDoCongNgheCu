/** URL tuyệt đối của website (SITE_URL trong .env, vd https://taoxanh.vn). */
export function siteUrl(path = "/"): string {
  const base = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
