// Query options are supported only by the teacher's bank print-preview endpoint.
export function allowedRequestPath(path: unknown, method: string) {
  if (typeof path !== 'string' || path.length > 18000) return false;
  if (/^\/api\/[a-zA-Z0-9/._-]+$/.test(path)) return true;
  if (/^\/api\/students\/(?:[a-zA-Z0-9._~-]|%[0-9A-Fa-f]{2})+\/code$/.test(path)) return true;
  if (/^\/api\/records\/(students|exams|books|sources|assets)\/(?:[a-zA-Z0-9._~-]|%[0-9A-Fa-f]{2})+$/.test(path)) return true;
  if (method !== 'GET' || !/^\/api\/books\/[a-f0-9]{32}\/document\?/.test(path)) return false;
  const url = new URL(path, 'https://school.invalid');
  return (
    !url.hash &&
    [...url.searchParams.keys()].every((key) =>
      ['audience', 'approvedOnly', 'chapter', 'title'].includes(key),
    )
  );
}
