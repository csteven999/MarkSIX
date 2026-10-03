// 抓取六合彩攪珠結果，合併進 data/results.json
// 來源 1：HKJC 官方 GraphQL（需與官網完全相同的查詢，否則回 WHITELIST_ERROR）
// 來源 2（備援，只有最近 20 期）：marksixinfo.com 近 20 期頁面
import { readFile, writeFile } from "node:fs/promises";

const ENDPOINT = "https://info.cld.hkjc.com/graphql/base/";
const FILE = new URL("../data/results.json", import.meta.url);
const KEEP = 200;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// 此查詢須與 HKJC 官網前端使用的查詢逐字相同（伺服器有白名單），請勿改動欄位
const QUERY = `
query marksixResult($lastNDraw: Int, $startDate: String, $endDate: String, $drawType: LotteryDrawType) {
  lotteryDraws(lastNDraw: $lastNDraw, startDate: $startDate, endDate: $endDate, drawType: $drawType) {
    id
    year
    no
    openDate
    closeDate
    drawDate
    status
    snowballCode
    snowballName_en
    snowballName_ch
    lotteryPool {
      sell
      status
      totalInvestment
      jackpot
      unitBet
      estimatedPrize
      derivedFirstPrizeDiv
      lotteryPrizes {
        type
        winningUnit
        dividend
      }
    }
    drawResult {
      drawnNo
      xDrawnNo
    }
  }
}`;

const pad = (no) => String(no).padStart(3, "0");

async function fromHKJC(n) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://bet.hkjc.com",
      Referer: "https://bet.hkjc.com/",
      "User-Agent": UA,
    },
    body: JSON.stringify({
      operationName: "marksixResult",
      query: QUERY,
      variables: { lastNDraw: n, startDate: null, endDate: null, drawType: "All" },
    }),
  });
  if (!res.ok) throw new Error(`HKJC HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.lotteryDraws;
  if (!Array.isArray(rows)) throw new Error("HKJC: " + JSON.stringify(json).slice(0, 300));
  return rows
    .filter((d) => d?.drawResult?.drawnNo?.length === 6)
    .map((d) => ({
      id: `${String(d.year).slice(-2)}/${pad(d.no)}`,
      date: String(d.openDate).slice(0, 10),
      numbers: d.drawResult.drawnNo.map(Number).sort((a, b) => a - b),
      extra: Number(d.drawResult.xDrawnNo),
    }));
}

export function parseMarksixInfo(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const re = /(\d{2})\/(\d{1,3}) (\d{4}-\d{2}-\d{2}) \$[\d,]+ 總投注額 開獎號碼 (\d{1,2}) (\d{1,2}) (\d{1,2}) (\d{1,2}) (\d{1,2}) (\d{1,2}) \+ (\d{1,2})/g;
  const out = [];
  for (const m of text.matchAll(re)) {
    const nums = m.slice(4, 10).map(Number).sort((a, b) => a - b);
    out.push({ id: `${m[1]}/${pad(m[2])}`, date: m[3], numbers: nums, extra: Number(m[10]) });
  }
  return out;
}

async function fromMarksixInfo() {
  const res = await fetch("https://marksixinfo.com/latest20draws", { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`marksixinfo HTTP ${res.status}`);
  const draws = parseMarksixInfo(await res.text());
  if (!draws.length) throw new Error("marksixinfo: 解析不到任何期數（頁面結構可能已改）");
  return draws;
}

async function getFresh(n) {
  try {
    return await fromHKJC(n);
  } catch (e) {
    console.warn("HKJC 失敗：", e.message);
    console.warn("改用備援來源（只有最近 20 期）…");
    try {
      return await fromMarksixInfo();
    } catch (e2) {
      throw new Error(`所有來源都失敗。\n- ${e.message}\n- ${e2.message}`);
    }
  }
}

async function main() {
  let old = { draws: [] };
  try { old = JSON.parse(await readFile(FILE, "utf8")); } catch {}

  const COUNT = Number(process.env.COUNT) || (old.draws.length ? 10 : KEEP);
  const fresh = await getFresh(Math.min(COUNT, 500));
  if (!fresh.length) throw new Error("沒有解析到任何期數");

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
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
