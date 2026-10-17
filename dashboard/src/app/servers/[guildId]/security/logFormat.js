export function formatLog(row) {
  const when = new Date(row.createdAt).toLocaleString();
  const who = row.executorId ? ` by ${row.executorId}` : '';
  const target = row.targetId ? ` → ${row.targetId}` : '';
  return `${when} · ${row.module} · ${row.action}${who}${target}`;
}
