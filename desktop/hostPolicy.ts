export function assertCanHost(input: {
  hosting: boolean;
  role: string;
  target?: { host: string };
  discovered: { host: string; school?: string }[];
  localAddresses: string[];
}) {
  if (input.hosting) return;
  if (input.role === 'student' || (input.target && input.target.host !== '127.0.0.1'))
    throw Error(
      'هذا الجهاز مرتبط بالجهاز الرئيسي. لا يمكن تشغيل جهاز رئيسي ثانٍ؛ استخدم اتصال المدرسة الحالي.',
    );
  const other = input.discovered.find(
    (device) => !['127.0.0.1', ...input.localAddresses].includes(device.host),
  );
  if (other)
    throw Error(
      `يوجد جهاز رئيسي يعمل بالفعل: ${other.school || other.host} (${other.host}). اضغط كرة الاتصال للارتباط به بدل إنشاء جهاز آخر.`,
    );
}
export function assertHostElection(
  fingerprint: string,
  localAddresses: string[],
  devices: { host: string; deviceId?: string; hostState?: string }[],
) {
  const others = devices.filter(
    (device) => !['127.0.0.1', ...localAddresses].includes(device.host),
  );
  if (
    others.some(
      (device) =>
        device.hostState !== 'starting' || !device.deviceId || device.deviceId <= fingerprint,
    )
  )
    throw Error(
      'اكتُشف جهاز رئيسي آخر أثناء التشغيل. لم يبدأ جهاز رئيسي ثانٍ؛ اضغط كرة الاتصال للارتباط بالجهاز الموجود.',
    );
}
