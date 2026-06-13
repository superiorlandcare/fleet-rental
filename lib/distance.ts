import "server-only";

/**
 * One-way driving miles via the Google Routes API. Server-only — the key
 * never reaches the client. Returns null when the route can't be computed
 * (bad address, API down, or key not configured yet).
 */
export async function drivingMiles(
  originAddress: string,
  destinationAddress: string
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: originAddress },
        destination: { address: destinationAddress },
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) {
      console.error("routes api:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const meters: unknown = data?.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number") return null;
    return Math.round((meters / 1609.344) * 10) / 10;
  } catch (e) {
    console.error("routes api:", e);
    return null;
  }
}
