// src/bea.js
// BEA API uses datasetname=Regional. GetData takes TableName/LineCode/GeoFips/Year.

const BEA_BASE = "https://apps.bea.gov/api/data/";

function beaUrl(params) {
  const usp = new URLSearchParams(params);
  return `${BEA_BASE}?${usp.toString()}`;
}

export async function discoverSarppAllItemsLineCode({ apiKey }) {
  // GetParameterValuesFiltered is in the BEA guide; we use it to list LineCodes for SARPP.
  const url = beaUrl({
    UserID: apiKey,
    method: "GetParameterValuesFiltered",
    datasetname: "Regional",
    TargetParameter: "LineCode",
    TableName: "SARPP",
    ResultFormat: "JSON",
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BEA discover LineCode failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const rows = json?.BEAAPI?.Results?.ParamValue;

  // rows have Key (the LineCode) and Desc (description) fields
  if (!Array.isArray(rows)) throw new Error("BEA Results missing/invalid for LineCode list");

  const pick = rows.find(r => {
    const desc = String(r?.Desc ?? "").toLowerCase();
    return desc.includes("all items") && desc.includes("rpp");
  }) || rows.find(r => String(r?.Desc ?? "").toLowerCase().includes("all items"));

  if (!pick?.Key) throw new Error("Could not find SARPP 'All items' LineCode");
  return String(pick.Key);
}

export async function fetchStateRpp({ apiKey, year = "LAST5", lineCode }) {
  const url = beaUrl({
    UserID: apiKey,
    method: "GetData",
    datasetname: "Regional",
    TableName: "SARPP",
    LineCode: lineCode,
    GeoFips: "STATE",
    Year: year,
    ResultFormat: "JSON",
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BEA GetData failed: ${res.status} ${await res.text()}`);

  const json = await res.json();
  const data = json?.BEAAPI?.Results?.Data;
  if (!Array.isArray(data) || data.length === 0) throw new Error("BEA returned no data rows");

  // Determine latest year in payload
  const years = [...new Set(data.map(d => Number(String(d.TimePeriod ?? "").trim())).filter(Number.isFinite))];
  const latestYear = Math.max(...years);

  // Build map: state_code -> rpp_index
  // BEA rows include GeoName; we'll map via your locations.state_name (simple, works).
  const latestRows = data.filter(d => Number(d.TimePeriod) === latestYear);

  return { latestYear, rows: latestRows };
}
