import type {
  BarronsFinancialStatement,
  BarronsNewsStory,
  BarronsStatementRow,
} from "./types";

export function formattedValue(o: any): string | null {
  return o?.formatted ?? o?.value ?? null;
}

export function metricValue(o: any): any {
  return o?.value?.value ?? o?.value ?? null;
}

export function extractNextData(html: string): any | null {
  const marker = "__NEXT_DATA__";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const jsonStart = html.indexOf(">", idx) + 1;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd).trim());
  } catch {
    return null;
  }
}

// ── Financial statement parser ──────────────────────────────────────────────

function extractFinancialStatementCard(
  data: any,
): { sections: any[] } | null {
  let arr = data;
  if (arr && !Array.isArray(arr)) {
    arr = arr.blocks ?? arr.data ?? arr.body ?? arr.results ?? arr.items;
    if (!Array.isArray(arr)) {
      if (
        arr?.["$type"] === "MarketData.FinancialStatementCard" &&
        arr.sections?.length
      ) {
        return {
          sections: arr.sections.map((s: any) => ({
            header: s.sectionHeader ?? "",
            items: s.items ?? [],
            columns: s.columns ?? [],
            fiscalYear: s.fiscalYear ?? "",
          })),
        };
      }
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const card = arr.find(
    (c: any) => c?.["$type"] === "MarketData.FinancialStatementCard",
  );
  if (!card?.sections?.length) return null;
  return {
    sections: card.sections.map((s: any) => ({
      header: s.sectionHeader ?? "",
      items: s.items ?? [],
      columns: s.columns ?? [],
      fiscalYear: s.fiscalYear ?? "",
    })),
  };
}

export function parseStatement(
  apiData: any,
): BarronsFinancialStatement | null {
  const extracted = extractFinancialStatementCard(apiData);
  if (!extracted) return null;

  const allRows: BarronsStatementRow[] = [];
  let columns: string[] = [];
  let fiscalYear = "";

  for (const sec of extracted.sections) {
    if (!columns.length) columns = sec.columns;
    if (!fiscalYear) fiscalYear = sec.fiscalYear;

    if (extracted.sections.length > 1 && sec.header) {
      allRows.push({
        name: `── ${sec.header} ──`,
        values: [],
        rawValues: [],
        type: 3,
        level: 0,
        isSectionHeader: true,
      });
    }

    function walk(items: any[], depth: number): void {
      for (const item of items) {
        allRows.push({
          name: item.displayName,
          values: (item.values ?? []).map((v: any) => v?.formatted ?? "-"),
          rawValues: (item.values ?? []).map((v: any) => v?.value ?? null),
          type: item.type ?? 0,
          level: item.level ?? depth,
        });
        if (item.items?.length) walk(item.items, depth + 1);
      }
    }
    walk(sec.items, 0);
  }

  return { columns, fiscalYear, rows: allRows };
}

// ── News parser ─────────────────────────────────────────────────────────────

export function extractNews(apiData: any): BarronsNewsStory[] {
  const stories = apiData?.blocks?.[0]?.blocks ?? [];
  return stories
    .filter((s: any) => s?.["$type"] === "News.StoryCard")
    .map((s: any) => ({
      headline: s.headline ?? "",
      summary: s.summary ?? "",
      byline: s.byline ?? "",
      url: s.url ?? "",
      timestamp: s.timestampUtc?.formatted ?? "",
      timestampValue: s.timestampUtc?.value ?? "",
      provider: s.provider ?? "",
      label: s.label?.display ?? s.sectionLabel?.display ?? "",
    }));
}
