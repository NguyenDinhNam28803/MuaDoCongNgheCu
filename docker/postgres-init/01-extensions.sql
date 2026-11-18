-- Chạy một lần khi volume DB được tạo mới.
-- unaccent: tìm kiếm tiếng Việt không dấu (báo cáo: PostgreSQL full-text + unaccent).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Database riêng cho test tích hợp (pnpm test:db).
CREATE DATABASE muaban_test OWNER muaban;
