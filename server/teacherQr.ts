import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { accountView, type openTenantStores } from './tenants';
import { verifyPassword } from './store';
export function registerTeacherQr(
  app: any,
  tenancy: ReturnType<typeof openTenantStores>,
  teacher: (req: any) => any,
) {
  const validPassword = (req: any) => {
    const session = teacher(req),
      account = tenancy.account(session.teacherId || 'master')!;
    const { password } = z.object({ password: z.string().max(128) }).parse(req.body);
    if (!verifyPassword(password, account.password))
      throw Object.assign(Error('كلمة المرور الحالية غير صحيحة'), { statusCode: 403 });
    return account;
  };
  app.get('/api/account/qr', async (req: any) => {
    const session = teacher(req),
      account = tenancy.account(session.teacherId || 'master')!;
    return {
      enabled: !!account.loginQr && account.loginQr.expiresAt > Date.now(),
      expiresAt: account.loginQr?.expiresAt,
    };
  });
  app.post('/api/account/qr', async (req: any) => {
    const account = validPassword(req),
      secret = randomBytes(32).toString('base64url');
    account.loginQr = {
      hash: createHash('sha256').update(secret).digest('hex'),
      expiresAt: Date.now() + 30 * 86400000,
      passwordStamp: createHash('sha256').update(account.password).digest('hex'),
    };
    tenancy.save(account);
    return {
      token: `alshereqi-teacher:v1:${account.id}:${secret}`,
      expiresAt: account.loginQr.expiresAt,
      account: accountView(account),
    };
  });
  app.delete('/api/account/qr', async (req: any) => {
    const account = validPassword(req);
    delete account.loginQr;
    tenancy.save(account);
    return { enabled: false };
  });
  return (token: string) => {
    const match = /^alshereqi-teacher:v1:([a-f0-9]{32}|master):([A-Za-z0-9_-]{43})$/.exec(token);
    if (!match) return undefined;
    const account = tenancy.account(match[1]),
      qr = account?.loginQr;
    if (
      !account ||
      account.disabled ||
      !qr ||
      qr.expiresAt <= Date.now() ||
      qr.passwordStamp !== createHash('sha256').update(account.password).digest('hex')
    )
      return undefined;
    const actual = createHash('sha256').update(match[2]).digest(),
      expected = Buffer.from(qr.hash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual)
      ? account
      : undefined;
  };
}
