import { NextResponse, type NextRequest } from "next/server";
import { haversine, DEFAULT_CENTER } from "@/lib/graph/geo";

export interface GeocodeResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Bounding viewbox covering active road network region
const REGION_VIEWBOX = "75.20,27.35,76.40,26.45";

async function queryNominatim(query: string, useViewbox = true): Promise<NominatimItem[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "in");
  if (useViewbox) {
    url.searchParams.set("viewbox", REGION_VIEWBOX);
    url.searchParams.set("bounded", "0");
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "MinGraph/1.0 (Road Network Visualizer; contact: info@mingraph.local)",
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];
  return (await res.json()) as NominatimItem[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // 1. Search with regional viewbox bias
    const primaryItems = await queryNominatim(q, true);

    // 2. If few results, also try broader search
    let secondaryItems: NominatimItem[] = [];
    if (primaryItems.length < 4) {
      secondaryItems = await queryNominatim(q, false);
    }

    // 3. Deduplicate by place_id and coordinate proximity
    const seen = new Set<string>();
    const combined: NominatimItem[] = [];
    for (const item of [...primaryItems, ...secondaryItems]) {
      const key = `${parseFloat(item.lat).toFixed(4)},${parseFloat(item.lon).toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    // 4. Calculate distance to map center and prioritize nearby places
    const results: GeocodeResult[] = combined
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const distM = haversine(lng, lat, DEFAULT_CENTER.lng, DEFAULT_CENTER.lat);
        return {
          placeId: String(item.place_id),
          name: item.display_name,
          lat,
          lng,
          distanceKm: Math.round(distM / 100) / 10,
        };
      })
      // Sort by proximity to map center
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, 5);

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Geocoding service unavailable" },
      { status: 500 }
    );
  }
}
