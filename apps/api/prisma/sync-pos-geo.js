/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const API_BASE = 'https://pos.pages.fm/api/v1';
const prisma = new PrismaClient();

function parseBooleanEnv(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeCountryCode(raw) {
  const parsed = Number.parseInt(String(raw || '63').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('COUNTRY_CODE must be a positive integer');
  }
  return Math.floor(parsed);
}

function chunkRows(rows, size) {
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function parseRows(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    const nestedRows = payload.flatMap((entry) => {
      if (Array.isArray(entry && entry.data)) return entry.data;
      return [];
    });
    if (nestedRows.length > 0) return nestedRows;
  }

  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function optionalString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function optionalJson(value) {
  if (value === null || value === undefined) return undefined;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    typeof value === 'object'
  ) {
    return value;
  }
  return undefined;
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${label} failed (${response.status}): ${body || response.statusText}`);
  }
  return response.json().catch(() => null);
}

function normalizeProvince(row, fallbackCountryCode) {
  const id = optionalString(row && row.id);
  const name = optionalString(row && row.name);
  if (!id || !name) return null;

  const rowCountryCode = Number.parseInt(
    optionalString(row && row.country_code) || String(fallbackCountryCode),
    10,
  );

  return {
    id,
    countryCode: Number.isFinite(rowCountryCode) ? rowCountryCode : fallbackCountryCode,
    name,
    nameEn: optionalString(row && row.name_en),
    newId: optionalString(row && row.new_id),
    regionType: optionalString(row && row.region_type),
  };
}

function normalizeDistrict(row, fallbackProvinceId) {
  const id = optionalString(row && row.id);
  const name = optionalString(row && row.name);
  const provinceId = optionalString(row && row.province_id) || fallbackProvinceId;
  if (!id || !name || !provinceId) return null;

  return {
    id,
    provinceId,
    name,
    nameEn: optionalString(row && row.name_en),
    postcode: optionalJson(row && row.postcode),
  };
}

function normalizeCommune(row, fallbackProvinceId) {
  const id = optionalString(row && row.id);
  const name = optionalString(row && row.name);
  const districtId = optionalString(row && row.district_id);
  const provinceId = optionalString(row && row.province_id) || fallbackProvinceId;
  if (!id || !name || !districtId || !provinceId) return null;

  return {
    id,
    provinceId,
    districtId,
    name,
    nameEn: optionalString(row && row.name_en),
    newId: optionalString(row && row.new_id),
    postcode: optionalJson(row && row.postcode),
  };
}

async function fetchProvinces(countryCode) {
  const params = new URLSearchParams({ country_code: String(countryCode) });
  const payload = await fetchJson(`${API_BASE}/geo/provinces?${params.toString()}`, 'Fetch provinces');
  const rows = parseRows(payload);
  const map = new Map();
  for (const row of rows) {
    const normalized = normalizeProvince(row, countryCode);
    if (!normalized) continue;
    map.set(normalized.id, normalized);
  }
  return Array.from(map.values());
}

async function fetchDistricts(provinceId) {
  const params = new URLSearchParams({ province_id: provinceId });
  const payload = await fetchJson(`${API_BASE}/geo/districts?${params.toString()}`, `Fetch districts (${provinceId})`);
  const rows = parseRows(payload);
  const map = new Map();
  for (const row of rows) {
    const normalized = normalizeDistrict(row, provinceId);
    if (!normalized) continue;
    map.set(normalized.id, normalized);
  }
  return Array.from(map.values());
}

async function fetchCommunes(provinceId) {
  const params = new URLSearchParams({ province_id: provinceId });
  const payload = await fetchJson(`${API_BASE}/geo/communes?${params.toString()}`, `Fetch communes (${provinceId})`);
  const rows = parseRows(payload);
  const map = new Map();
  for (const row of rows) {
    const normalized = normalizeCommune(row, provinceId);
    if (!normalized) continue;
    map.set(normalized.id, normalized);
  }
  return Array.from(map.values());
}

async function run() {
  const countryCode = normalizeCountryCode(process.env.COUNTRY_CODE || '63');
  const force = parseBooleanEnv(process.env.FORCE);

  console.log(`[pos-geo] start country_code=${countryCode} force=${force}`);

  const existingProvinces = await prisma.posProvince.findMany({
    where: { countryCode },
    select: { id: true },
  });
  const existingProvinceIds = existingProvinces.map((row) => row.id);

  if (!force && existingProvinceIds.length > 0) {
    const [districtCount, communeCount] = await prisma.$transaction([
      prisma.posDistrict.count({ where: { provinceId: { in: existingProvinceIds } } }),
      prisma.posCommune.count({ where: { provinceId: { in: existingProvinceIds } } }),
    ]);

    console.log(
      JSON.stringify(
        {
          country_code: countryCode,
          synced: false,
          skipped: true,
          reason: 'ALREADY_SYNCED',
          provinces: existingProvinceIds.length,
          districts: districtCount,
          communes: communeCount,
        },
        null,
        2,
      ),
    );
    return;
  }

  const provinces = await fetchProvinces(countryCode);
  const provinceIdSet = new Set(provinces.map((row) => row.id));
  const districtMap = new Map();
  const communeMap = new Map();
  let requestCount = 1;

  for (const province of provinces) {
    const [districts, communes] = await Promise.all([
      fetchDistricts(province.id),
      fetchCommunes(province.id),
    ]);
    requestCount += 2;

    for (const district of districts) {
      if (!provinceIdSet.has(district.provinceId)) continue;
      districtMap.set(district.id, district);
    }

    for (const commune of communes) {
      if (!provinceIdSet.has(commune.provinceId)) continue;
      communeMap.set(commune.id, commune);
    }
  }

  const districts = Array.from(districtMap.values());
  const districtIdSet = new Set(districts.map((row) => row.id));
  const communes = Array.from(communeMap.values()).filter((row) => districtIdSet.has(row.districtId));
  const skippedCommunes = communeMap.size - communes.length;

  await prisma.$transaction(async (tx) => {
    if (existingProvinceIds.length > 0) {
      await tx.posCommune.deleteMany({ where: { provinceId: { in: existingProvinceIds } } });
      await tx.posDistrict.deleteMany({ where: { provinceId: { in: existingProvinceIds } } });
      await tx.posProvince.deleteMany({ where: { id: { in: existingProvinceIds } } });
    }

    for (const chunk of chunkRows(provinces, 200)) {
      await tx.posProvince.createMany({
        data: chunk.map((row) => ({
          id: row.id,
          countryCode: row.countryCode,
          name: row.name,
          nameEn: row.nameEn,
          newId: row.newId,
          regionType: row.regionType,
        })),
        skipDuplicates: true,
      });
    }

    for (const chunk of chunkRows(districts, 1000)) {
      await tx.posDistrict.createMany({
        data: chunk.map((row) => ({
          id: row.id,
          provinceId: row.provinceId,
          name: row.name,
          nameEn: row.nameEn,
          ...(row.postcode !== undefined ? { postcode: row.postcode } : {}),
        })),
        skipDuplicates: true,
      });
    }

    for (const chunk of chunkRows(communes, 1000)) {
      await tx.posCommune.createMany({
        data: chunk.map((row) => ({
          id: row.id,
          provinceId: row.provinceId,
          districtId: row.districtId,
          name: row.name,
          nameEn: row.nameEn,
          newId: row.newId,
          ...(row.postcode !== undefined ? { postcode: row.postcode } : {}),
        })),
        skipDuplicates: true,
      });
    }
  }, {
    timeout: 240000,
    maxWait: 10000,
  });

  const [provinceCount, districtCount, communeCount] = await prisma.$transaction([
    prisma.posProvince.count({ where: { countryCode } }),
    prisma.posDistrict.count({ where: { province: { countryCode } } }),
    prisma.posCommune.count({ where: { province: { countryCode } } }),
  ]);

  console.log(
    JSON.stringify(
      {
        country_code: countryCode,
        synced: true,
        skipped: false,
        force,
        requests_made: requestCount,
        provinces: provinceCount,
        districts: districtCount,
        communes: communeCount,
        skipped_communes_missing_district: skippedCommunes,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error('[pos-geo] sync failed');
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
