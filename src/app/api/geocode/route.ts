import { NextResponse, type NextRequest } from "next/server";
import { JAIPUR_BBOX } from "@/lib/graph/geo";

export interface GeocodeResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // viewbox format: <left>,<top>,<right>,<bottom> -> <west>,<north>,<east>,<south>
  const viewbox = `${JAIPUR_BBOX.west},${JAIPUR_BBOX.north},${JAIPUR_BBOX.east},${JAIPUR_BBOX.south}`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "in");
  url.searchParams.set("viewbox", viewbox);
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "MinGraph/1.0 (Jaipur Road Network Visualizer; contact: info@mingraph.local)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Geocoding failed (HTTP ${res.status})` }, { status: 502 });
    }

    const data = (await res.json()) as NominatimItem[];
    const results: GeocodeResult[] = data.map((item) => ({
      placeId: String(item.place_id),
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Geocoding service unavailable" },
      { status: 500 }
    );
  }
}
