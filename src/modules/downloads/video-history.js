export const VIDEO_STATUS_KEY = 'core.video:status';
export const VIDEO_HISTORY_KEY = 'core.video:history';
export const videoInProgress = value => ['started', 'progress'].includes(value?.type);

export function videoHistory(value) {
 const rows = Array.isArray(value) ? value : [];
 const seen = new Set();
 return rows.filter(row => {
  if (!row || typeof row.id !== 'string' || typeof row.filename !== 'string' || !row.filename || !Number.isFinite(row.completedAt) || row.completedAt <= 0 || seen.has(row.id)) return false;
  seen.add(row.id); return true;
 }).slice(0,30).map(row => ({id:row.id.slice(0,100), filename:row.filename.slice(0,4096), completedAt:row.completedAt}));
}

export function addVideoHistory(previous, entry) {
 return videoHistory([entry, ...videoHistory(previous)]);
}

export function unseenVideos(history, seenAt) {
 return videoHistory(history).filter(row => row.completedAt > seenAt).length;
}
