/**
 * U-GOV V6 public web search adapter.
 * Only searches the configured provider API; it never fetches arbitrary user URLs.
 */
export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  sourceType: "internet";
}

export interface IWebSearchProvider {
  search(query: string, count?: number): Promise<WebSearchSource[]>;
}

export class BraveWebSearchProvider implements IWebSearchProvider {
  async search(query: string, count = 5): Promise<WebSearchSource[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) return [];
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query.slice(0, 400));
    url.searchParams.set("count", String(Math.min(Math.max(count, 1), 8)));
    const response = await fetch(url, {
      headers: { "Accept": "application/json", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error(`Web search provider returned ${response.status}`);
    const payload: any = await response.json();
    const results = Array.isArray(payload?.web?.results) ? payload.web.results : [];
    return results.slice(0, count).flatMap((item: any) => {
      if (typeof item?.url !== "string" || !/^https?:\/\//i.test(item.url)) return [];
      return [{
        title: String(item.title || "Web result").slice(0, 240),
        url: item.url,
        snippet: String(item.description || "").slice(0, 1200),
        publishedAt: item.page_age || item.age || undefined,
        sourceType: "internet" as const,
      }];
    });
  }
}
