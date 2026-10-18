export function cameraError(error: unknown) {
  const name = (error as Error)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'لم يُسمح بالكاميرا. اسمح بالوصول عند ظهور الطلب. في Windows افتح الإعدادات ← الخصوصية والأمان ← الكاميرا، وفعّل وصول تطبيقات سطح المكتب. ثم أعد المحاولة.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'لم نعثر على كاميرا. صِل الكاميرا وتأكد من فتح غطائها، أو اطلب استثناءً من المعلم.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'الكاميرا مشغولة أو لا يستطيع Windows تشغيلها. أغلق Teams وZoom وأي برنامج يستخدم الكاميرا ثم أعد المحاولة.';
  if (name === 'OverconstrainedError')
    return 'إعدادات الكاميرا غير مدعومة. أعد المحاولة باستخدام كاميرا أخرى.';
  return 'تعذر تشغيل الكاميرا. تحقق من توصيلها وأذونات Windows ثم أعد المحاولة أو أبلغ المعلم.';
}
export async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia)
    throw Object.assign(Error('Camera API unavailable'), { name: 'SecurityError' });
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: { ideal: 480 }, height: { ideal: 270 }, frameRate: { ideal: 2, max: 5 } },
  });
}
