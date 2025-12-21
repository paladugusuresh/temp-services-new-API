// src/bls.js
// BLS API v2 single series GET gives last ~3 years.
// That's fine because we set the baseline when you first run the job.
// Docs: https://api.bls.gov/publicAPI/v2/timeseries/data/

export async function fetchLatestCpi({ seriesId = "CUUR0000SA0" } = {}) {
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${encodeURIComponent(seriesId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) throw new Error(`BLS GET failed: ${res.status} ${await res.text()}`);

  const json = await res.json();
  const series = json?.Results?.series?.[0];
  const data = series?.data;

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("BLS response missing data array");
  }

  // data is usually ordered newest -> oldest
  const newest = data[0]; // { year: "2025", period: "M11", value: "..." }
  return {
    seriesId,
    year: Number(newest.year),
    period: newest.period,
    value: Number(newest.value),
  };
}
