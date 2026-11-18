// Đặt lại mật khẩu khi chủ shop quên: pnpm user:reset-password <sđt> <mật-khẩu-mới>
import "dotenv/config";
import { createPrismaClient } from "../src/server/db";
import { normalizePhone } from "../src/server/auth/phone";
import { UserRuleError, changePassword } from "../src/server/users/service";

async function main(): Promise<number> {
  const [phoneArg, password] = process.argv.slice(2);
  if (!phoneArg || !password) {
    console.error("Cách dùng: pnpm user:reset-password <số-điện-thoại> <mật-khẩu-mới>");
    return 1;
  }
  const phone = normalizePhone(phoneArg);
  if (!phone) {
    console.error("Số điện thoại không hợp lệ");
    return 1;
  }

  const db = createPrismaClient();
  try {
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) {
      console.error(`Không có tài khoản với số ${phone}`);
      return 1;
    }
    await changePassword(db, user.id, password);
    console.log(`Đã đặt lại mật khẩu cho ${user.name}`);
    return 0;
  } catch (e) {
    if (e instanceof UserRuleError) {
      console.error(e.message);
      return 1;
    }
    throw e;
  } finally {
    await db.$disconnect();
  }
}

main().then((code) => {
  process.exitCode = code;
});
