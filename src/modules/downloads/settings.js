export const DOWNLOAD_SETTINGS_KEY = "core.downloads";

export const completedDownloadsBadge = (value) => {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  if (count === 0) return "";
  return count > 99 ? "99+" : String(count);
};

export const normalizeDownloadSettings = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const folder = String(source.folder || "").replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== ".." && !/[:<>"|?*]/.test(part)).slice(0, 4).join("/");
  const rules = Array.isArray(source.rules) ? source.rules.slice(0, 50).flatMap((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return [];
    const ruleFolder = String(rule.folder || "").replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== ".." && !/[:<>"|?*]/.test(part)).slice(0, 4).join("/");
    const category = ["images", "media", "documents", "archives", "other"].includes(rule.category) ? rule.category : "all";
    const normalized = {
      urlContains: String(rule.urlContains || "").slice(0, 160),
      category,
      folder: ruleFolder,
      filenameMask: String(rule.filenameMask || "").replace(/[\r\n]/g, "").slice(0, 120)
    };
    return normalized.urlContains || normalized.category !== "all" || normalized.folder || normalized.filenameMask ? [normalized] : [];
  }) : [];
  return {
    replaceChromeUi: Boolean(source.replaceChromeUi),
    notifications: source.notifications !== false,
    listView: source.listView !== false,
    filenameMask: String(source.filenameMask || "").replace(/[\r\n]/g, "").slice(0, 120),
    folder,
    routeByType: Boolean(source.routeByType),
    rules
  };
};

export const expandBatchUrls = (text, limit = 100) => {
  const output = [];
  for (const raw of String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const match = /\{(-?\d+)\.\.(-?\d+)(?:,(-?\d+))?\}/.exec(raw);
    const values = [];
    if (match) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      const step = Math.max(1, Math.abs(Number(match[3] || 1))) * (from <= to ? 1 : -1);
      const digits = Math.max(match[1].replace(/^-/, "").length, match[2].replace(/^-/, "").length);
      for (let current = from; (step > 0 ? current <= to : current >= to) && output.length + values.length < limit; current += step) {
        const sign = current < 0 ? "-" : "";
        values.push(raw.replace(match[0], `${sign}${String(Math.abs(current)).padStart(digits, "0")}`));
      }
    } else values.push(raw);
    for (const value of values) {
      if (output.length >= limit) break;
      try {
        const url = new URL(value);
        if ((url.protocol === "http:" || url.protocol === "https:") && !output.includes(url.href)) output.push(url.href);
      } catch { /* URL 형식이 아니면 건너뛴다 */ }
    }
    if (output.length >= limit) break;
  }
  return output;
};

export const downloadCategory = (filename = "", mime = "") => {
  const extension = String(filename).split(".").pop()?.toLowerCase() || "";
  const type = String(mime).toLowerCase();
  if (/^(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/.test(extension) || type.startsWith("image/")) return "images";
  if (/^(mp4|webm|mov|mkv|avi|mp3|wav|flac|m4a|ogg)$/.test(extension) || type.startsWith("audio/") || type.startsWith("video/")) return "media";
  if (/^(pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|rtf)$/.test(extension) || type.includes("pdf") || type.includes("document")) return "documents";
  if (/^(zip|rar|7z|tar|gz|bz2|xz)$/.test(extension)) return "archives";
  return "other";
};

export const makeDownloadFilename = (item, settings, now = new Date(), nameHint = "") => {
  const source = String(nameHint || item?.filename || item?.url || "download").replace(/\\/g, "/").split("/").pop() || "download";
  const dot = source.lastIndexOf(".");
  const name = dot > 0 ? source.slice(0, dot) : source;
  const extension = dot > 0 ? source.slice(dot + 1) : "";
  let host = "";
  try { host = new URL(item?.url || "").hostname; } catch { /* URL 정보 없음 */ }
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
  let sourceUrl = "";
  try { sourceUrl = new URL(item?.url || "").pathname; } catch { /* URL 정보 없음 */ }
  const categoryValue = downloadCategory(source, item?.mime);
  const rule = settings?.rules?.find((entry) => {
    const matchesUrl = !entry.urlContains || String(item?.url || "").includes(entry.urlContains);
    const matchesCategory = !entry.category || entry.category === "all" || entry.category === categoryValue;
    return matchesUrl && matchesCategory;
  });
  const mask = rule?.filenameMask || settings?.filenameMask || "{filename}{ext}";
  let output = mask.replaceAll("{filename}", name).replaceAll("{ext}", extension ? `.${extension}` : "").replaceAll("{host}", host).replaceAll("{date}", date).replaceAll("{time}", time).replaceAll("{path}", sourceUrl);
  output = output.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\.+/g, ".").replace(/^\.+/, "").slice(0, 180);
  if (!output) output = source;
  const category = settings?.routeByType && !rule?.folder ? `${categoryValue.replace(/s$/, "")}/` : "";
  const folder = rule?.folder || settings?.folder;
  return `${folder ? `${folder}/` : ""}${category}${output}`;
};

export const cleanSuggestedFilename = (value) => String(value || "")
  .replace(/[\\/:*?"<>|]/g, "_")
  .replace(/\.\.+/g, ".")
  .replace(/^\.+/, "")
  .trim()
  .slice(0, 160);
