// 從 HKJC 官方 GraphQL 抓取六合彩攪珠結果，合併進 data/results.json
import { readFile, writeFile } from "node:fs/promises";

const ENDPOINT = "https://info.cld.hkjc.com/graphql/base/";
const FILE = new URL("../data/results.json", import.meta.url);
const KEEP = 200; // 最多保留期數

const query = `
query marksixResult($lastNDraw: Int, $drawType: LotteryDrawType) {
  lotteryDraws(lastNDraw: $lastNDraw, drawType: $drawType) {
    year no openDate drawResult { drawnNo xDrawnNo }
  }
}`;

async function fetchDraws(n) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      operationName: "marksixResult",
      query,
      variables: { lastNDraw: n, drawType: "All" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.lotteryDraws;
  if (!Array.isArray(rows)) throw new Error("Unexpected response: " + JSON.stringify(json).slice(0, 300));
  return rows
    .filter((d) => d?.drawResult?.drawnNo?.length === 6)
    .map((d) => ({
      id: `${String(d.year).slice(-2)}/${String(d.no).padStart(3, "0")}`,
      date: String(d.openDate).slice(0, 10),
      numbers: d.drawResult.drawnNo.map(Number).sort((a, b) => a - b),
      extra: Number(d.drawResult.xDrawnNo),
    }));
}

let old = { draws: [] };
try { old = JSON.parse(await readFile(FILE, "utf8")); } catch {}

// 預設：首次抓 KEEP 期，之後只抓最近 10 期；可用 COUNT=100 手動回填
const COUNT = Number(process.env.COUNT) || (old.draws.length ? 10 : KEEP);
const fresh = await fetchDraws(Math.min(COUNT, 500));
if (!fresh.length) throw new Error("No draws parsed — API 格式可能已改變");

const map = new Map(old.draws.map((d) => [d.id, d]));
fresh.forEach((d) => map.set(d.id, d));
const draws = [...map.values()]
  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  .slice(0, KEEP);

const next = JSON.stringify({ draws }, null, 1) + "\n";
const prev = JSON.stringify(old, null, 1) + "\n";
if (next !== prev) {
  await writeFile(FILE, next);
  console.log(`Updated. Latest: ${draws[0].id} (${draws[0].date})`);
} else {
  console.log("No change.");
}
