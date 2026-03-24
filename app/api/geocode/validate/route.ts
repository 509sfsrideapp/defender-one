import { NextResponse } from "next/server";

type ForwardGeocodeResponse = Array<{
  display_name?: string;
  lat?: string;
  lon?: string;
}>;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Address is required." }, { status: 400 });
    }

    const acceptLanguage = request.headers.get("accept-language") || "en-US,en;q=0.9";
    const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
    searchUrl.searchParams.set("format", "jsonv2");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("addressdetails", "1");
    searchUrl.searchParams.set("limit", "1");

    const response = await fetch(searchUrl, {
      headers: {
        "Accept-Language": acceptLanguage,
        "User-Agent": "DefenderDrivers/1.0 (home address validation)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Could not verify that address." }, { status: 502 });
    }

    const results = (await response.json()) as ForwardGeocodeResponse;
    const bestMatch = results[0];

    if (!bestMatch?.display_name || !bestMatch.lat || !bestMatch.lon) {
      return NextResponse.json({ valid: false, error: "That does not look like a real address yet." }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      normalizedAddress: bestMatch.display_name,
      latitude: Number(bestMatch.lat),
      longitude: Number(bestMatch.lon),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not validate that address." }, { status: 500 });
  }
}
