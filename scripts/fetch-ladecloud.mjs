#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultBaseUrl = "https://backend.ladecloud.de/ladeapp-api/api/v1";
const defaultOutputDir = path.join(projectRoot, "providers", "ladecloud");
const envName = process.env.NODE_ENV || "development";
const envFiles = [
  path.join(projectRoot, ".env"),
  path.join(projectRoot, `.env.${envName}`),
  path.join(projectRoot, ".env.local"),
  path.join(projectRoot, `.env.${envName}.local`),
];

await loadEnvFiles(envFiles);

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const apiKey =
  args.apiKey ??
  process.env.LADECLOUD_API_KEY ??
  process.env.X_API_KEY;

if (!apiKey) {
  console.error("ERROR: Missing API key. Set LADECLOUD_API_KEY in .env file or pass --api-key.");
  process.exit(1);
}

const baseUrl = args.baseUrl ?? defaultBaseUrl;
const providersUrl = args.providersUrl ?? `${baseUrl}/providers`;
const contractOffersUrl = args.contractOffersUrl ?? `${baseUrl}/contract-offers/public`;
const contractOfferDetailUrlCandidates = [
  `${baseUrl}/contracts-offer/{id}`,
  `${baseUrl}/contract-offers/{id}`,
  `${baseUrl}/contract-offers/public/{id}`,
];
const outputDir = path.resolve(projectRoot, args.outputDir ?? defaultOutputDir);
const bundlesDir = path.join(outputDir, "providers");
const mappedProvidersDir = path.join(projectRoot, "providers");

console.log(`Loading providers from ${providersUrl} with pagination...`);
const providers = [];
let page = 0;
const pageSize = 30;
let hasMore = true;

while (hasMore) {
  const paginatedUrl = `${providersUrl}?page=${page}&pageSize=${pageSize}`;
  try {
    const providersResponse = await fetchWithRetry(paginatedUrl, apiKey);
    const pageProviders = normalizeList(providersResponse, ["providers", "items", "data", "results"]);

    if (pageProviders.length === 0) {
      console.log(`  Page ${page}: No providers found (end of list)`);
      break;
    }

    console.log(`  Page ${page}: ${pageProviders.length} providers loaded`);
    providers.push(...pageProviders);

    // Check if more pages exist
    hasMore = providersResponse.hasNext === true;
    if (hasMore) {
      page += 1;
    }
  } catch (error) {
    console.error(`ERROR: Failed to load providers page ${page}: ${error.message}`);
    if (error.statusCode === 429) {
      console.error("RATE_LIMIT_HIT: API returned 429 Too Many Requests. Consider adding delays.");
    }
    break;
  }
}

console.log(`Total: ${providers.length} providers loaded.\n`);
if (!providers.length) {
  console.warn("WARNING: No providers found.");
}

const results = await Promise.allSettled(
  providers.map(async (provider, index) => {
    const providerId = getProviderId(provider, index);
    if (!providerId) {
      throw new Error(`Provider ${index + 1} has no id/providerId.`);
    }

    const providerName = getProviderName(provider, providerId);
    const offersUrl = `${contractOffersUrl}?providerId=${encodeURIComponent(String(providerId))}`;

    try {
      const contractOffersResponse = await fetchWithRetry(offersUrl, apiKey);
      const contractOffers = normalizeList(contractOffersResponse, [
        "contractOffers",
        "offers",
        "items",
        "data",
        "results",
      ]);

      const contractOfferDetailsById = {};
      for (const offer of contractOffers) {
        const contractOfferId = getContractOfferId(offer);
        if (!contractOfferId) continue;
        const detail = await fetchContractOfferDetailById(contractOfferId, apiKey, contractOfferDetailUrlCandidates);
        if (detail) {
          contractOfferDetailsById[contractOfferId] = detail;
        }
      }

      console.log(`[${index + 1}/${providers.length}] ${providerName}: ${contractOffers.length} contract offers found`);

      const fileName = `${sanitizeFileName(String(providerId))}.json`;
      const bundle = {
        fetchedAt: new Date().toISOString(),
        source: {
          baseUrl,
          providersUrl,
          contractOffersUrl,
          providerId,
        },
        provider,
        contractOffersResponse,
        contractOffers,
        contractOfferDetailsById,
      };

      await writeJson(path.join(bundlesDir, fileName), bundle);

      const mappedProviders = contractOffers
        .map((offer, offerIndex) => {
          try {
            const offerId = getContractOfferId(offer);
            const offerDetail = offerId ? contractOfferDetailsById[offerId] : null;
            return mapContractOfferToProvider(offer, provider, providerId, offerIndex, offerDetail);
          } catch (err) {
            console.warn(`  WARNING: Could not map contract offer ${offerIndex + 1}: ${err.message}`);
            return null;
          }
        })
        .filter(Boolean);

      for (const mapped of mappedProviders) {
        const slug = mapped._slug || sanitizeFileName(`ladenetz-${mapped.name}`);
        const mappedFileName = `${slug}.json`;
        const outputFile = mapped;
        delete outputFile._slug; // Don't store slug in final JSON
        await writeJson(path.join(mappedProvidersDir, mappedFileName), outputFile);
      }

      return {
        providerId,
        providerName,
        file: path.posix.join("providers", fileName),
        contractOffersCount: contractOffers.length,
        mappedCount: mappedProviders.length,
      };
    } catch (error) {
      const errorMsg = `[${index + 1}/${providers.length}] ${providerName}: ${error.message}`;
      console.error(`ERROR: ${errorMsg}`);

      // Detect and report rate limiting
      if (error.statusCode === 429) {
        console.error(`  → RATE_LIMIT_HIT: Consider adding request delays or increasing timeout`);
      } else if (error.statusCode === 401) {
        console.error(`  → AUTHENTICATION_FAILED: Check API key`);
      } else if (error.statusCode === 500) {
        console.error(`  → SERVER_ERROR: Backend issue - provider might have no public contract offers`);
      } else if (error.statusCode === 404) {
        console.error(`  → NOT_FOUND: Provider or contract offers endpoint not found`);
      }

      throw error;
    }
  }),
);

const successful = [];
const failures = [];
for (const result of results) {
  if (result.status === "fulfilled") {
    successful.push(result.value);
  } else {
    failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }
}

await mkdir(outputDir, { recursive: true });
await writeJson(path.join(outputDir, "index.json"), {
  fetchedAt: new Date().toISOString(),
  source: {
    baseUrl,
    providersUrl,
    contractOffersUrl,
  },
  providerCount: providers.length,
  successCount: successful.length,
  failureCount: failures.length,
  providers: successful,
  failures,
});

console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY`);
console.log(`${'='.repeat(60)}`);
console.log(`Total providers fetched: ${successful.length}/${providers.length}`);
console.log(`success: ${successful.length}`);
console.log(`failed:  ${failures.length}`);
console.log(`mapped:  ${successful.reduce((sum, p) => sum + (p.mappedCount || 0), 0)} provider JSONs created`);
console.log(`\nRaw data: ${outputDir}`);
console.log(`Provider JSONs: ${mappedProvidersDir}\n`);

if (failures.length) {
  console.log(`Failed providers (${failures.length}):`);
  failures.slice(0, 10).forEach((failure, i) => {
    console.log(`  ${i + 1}. ${failure}`);
  });
  if (failures.length > 10) {
    console.log(`  ... and ${failures.length - 10} more`);
  }
  console.log();
}

if (failures.length > 0) {
  const rateLimitCount = failures.filter(f => f.includes("429") || f.includes("rate")).length;
  const authCount = failures.filter(f => f.includes("401")).length;
  const serverCount = failures.filter(f => f.includes("500")).length;

  if (rateLimitCount > 0) {
    console.warn(`NOTICE: ${rateLimitCount} providers failed due to rate limiting (429).`);
    console.warn(`  Recommendation: Add request throttling with delays between API calls.`);
  }
  if (authCount > 0) {
    console.warn(`WARNING: ${authCount} providers failed due to authentication errors (401).`);
  }
  if (serverCount > 0) {
    console.warn(`INFO: ${serverCount} providers returned server errors (500).`);
    console.warn(`  This usually means the provider has no public contract offers.`);
  }
  const otherCount = failures.length - rateLimitCount - authCount - serverCount;
  if (otherCount > 0) {
    console.warn(`INFO: ${otherCount} providers have no valid contract offers or mapping issues.`);
  }
  process.exitCode = 1;
} else {
  console.log("✓ All providers processed successfully!");
}

async function loadEnvFiles(files) {
  for (const file of files) {
    try {
      const content = await readFile(file, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const entry = parseEnvLine(line);
        if (!entry) continue;
        if (process.env[entry.key] === undefined) {
          process.env[entry.key] = entry.value;
        }
      }
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
  const equalsIndex = normalized.indexOf("=");
  if (equalsIndex === -1) return null;

  const key = normalized.slice(0, equalsIndex).trim();
  if (!key) return null;

  let value = normalized.slice(equalsIndex + 1).trim();
  if (!value) return { key, value: "" };

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
    if (quote === '"') {
      value = value
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\"/g, '"');
    }
  } else {
    const commentIndex = value.indexOf(" #");
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trimEnd();
    }
  }

  return { key, value };
}

function parseArgs(argv) {
  const result = {
    help: false,
    apiKey: undefined,
    baseUrl: undefined,
    providersUrl: undefined,
    contractOffersUrl: undefined,
    outputDir: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        result.help = true;
        break;
      case "-k":
      case "--api-key":
        result.apiKey = argv[++i];
        break;
      case "--base-url":
        result.baseUrl = argv[++i];
        break;
      case "--providers-url":
        result.providersUrl = argv[++i];
        break;
      case "--contract-offers-url":
        result.contractOffersUrl = argv[++i];
        break;
      case "-o":
      case "--output-dir":
        result.outputDir = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/fetch-ladecloud.mjs [options]

Options:
  -h, --help                   Show this help
  -k, --api-key <key>          Pass API key directly
      --base-url <url>         Base URL for API (Default: ${defaultBaseUrl})
      --providers-url <url>    Full URL for providers endpoint
      --contract-offers-url <url>
                               Full URL for contract offers endpoint
  -o, --output-dir <path>      Output directory for raw bundles (Default: ${defaultOutputDir})

Environment:
  LADECLOUD_API_KEY or X_API_KEY - API authentication key
`);
}

function mapContractOfferToProvider(contractOffer, provider, providerId, offerIndex, contractOfferDetail = null) {
  if (!contractOffer || typeof contractOffer !== "object") {
    throw new Error("Invalid contract offer object");
  }

  const contractOfferName = contractOffer.contractOfferName || `Offer ${offerIndex + 1}`;
  const tariffsPreview = contractOffer.tariffsPreview || [];

  const ladenetzTariff = findLadenetzTariff(tariffsPreview);
  const roamingTariff = findRoamingTariff(tariffsPreview);

  if (!ladenetzTariff) {
    throw new Error(`No ladenetz.de Verbund tariff found in contract offer`);
  }

  // Extract prices
  const acPrice = extractPrice(ladenetzTariff.componentsPreview, "AC");
  const dcPrice = extractPrice(ladenetzTariff.componentsPreview, "DC");

  if (acPrice === null || dcPrice === null) {
    throw new Error(`Incomplete ladenetz prices (AC: ${acPrice}, DC: ${dcPrice})`);
  }

  const acRoamingPrice = roamingTariff ? extractPrice(roamingTariff.componentsPreview, "AC") : null;
  const dcRoamingPrice = roamingTariff ? extractPrice(roamingTariff.componentsPreview, "DC") : null;

  const basicFee = resolveBasicFee(contractOffer);

  const cardOrderFee = contractOffer.cardOrderFee && contractOffer.cardOrderFee.value
    ? parseFloat(contractOffer.cardOrderFee.value)
    : null;

  const name = formatProviderName(provider.name || contractOfferName, contractOfferName);

  const comments = [];
  if (cardOrderFee) {
    comments.push(`Card fee once: €${Number(cardOrderFee).toFixed(2)}`);
  }
  if (contractOffer.maxCountOfCards) {
    comments.push(`Max ${contractOffer.maxCountOfCards} cards`);
  }

  return {
    name,
    acPrice: Number(acPrice.toFixed(2)),
    dcPrice: Number(dcPrice.toFixed(2)),
    acRoamingPrice: acRoamingPrice !== null ? Number(acRoamingPrice.toFixed(2)) : null,
    dcRoamingPrice: dcRoamingPrice !== null ? Number(dcRoamingPrice.toFixed(2)) : null,
    basicFee: Number(basicFee.toFixed(2)),
    supportedNetworks: ["ladenetz.de"],
    chargingStations: 800000,
    country: "DE",
    footnote: `Auto-imported on ${new Date().toLocaleDateString("en-US")}`,
    comment: comments.length > 0 ? comments.join(" ") : "",
    link: buildProviderLink(provider, providerId, contractOfferDetail),
    isAffiliate: false,
    hidden: false,
    sourceProviderId: providerId,
    _slug: generateSlug(contractOfferName),
  };
}

function extractPrice(componentsPreview, currentType) {
  if (!componentsPreview || !Array.isArray(componentsPreview)) {
    return null;
  }

  const component = componentsPreview.find((c) => c.currentType === currentType);
  if (!component || !component.unrestrictedGrossEnergyPrice) {
    return null;
  }

  const value = component.unrestrictedGrossEnergyPrice.value;
  return typeof value === "string" ? parseFloat(value) : value;
}

function resolveBasicFee(contractOffer) {
  const candidates = [
    contractOffer?.monthlyCardBaseFee,
    ...resolveFeeList(contractOffer?.monthlyFeeList),
    contractOffer?.startingMonthlyContractFee,
    contractOffer?.firstCardStartingMonthlyCardFee,
  ];

  for (const candidate of candidates) {
    const fee = extractMoneyValue(candidate);
    if (fee !== null && fee > 0) {
      return fee;
    }
  }

  return 0;
}

function resolveFeeList(monthlyFeeList) {
  if (!Array.isArray(monthlyFeeList)) return [];

  return [...monthlyFeeList].sort((a, b) => {
    const fromA = Number(a?.fromMonth ?? Number.POSITIVE_INFINITY);
    const fromB = Number(b?.fromMonth ?? Number.POSITIVE_INFINITY);
    return fromA - fromB;
  })
    .map((entry) => entry?.grossPrice)
    .filter(Boolean);
}

function extractMoneyValue(moneyLike) {
  if (!moneyLike || typeof moneyLike !== "object") return null;
  const raw = moneyLike.value;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(value) ? value : null;
}

function findLadenetzTariff(tariffsPreview) {
  const tariffs = Array.isArray(tariffsPreview) ? tariffsPreview : [];
  const scored = tariffs
    .map((tariff) => ({ tariff, score: scoreLadenetzTariff(tariff) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.tariff ?? null;
}

function scoreLadenetzTariff(tariff) {
  if (!tariff || typeof tariff !== "object") return 0;

  const name = normalizeMatchText(tariff.name);
  const type = normalizeMatchText(tariff.type);
  let score = 0;

  if (name.includes("ladenetz")) score += 6;
  if (name.includes("verbund")) score += 5;
  if (name.includes("netz")) score += 2;
  if (type === "network") score += 1;
  if (type === "basic") score -= 4;
  if (name.includes("basistarif")) score -= 8;
  if (name.includes("roaming")) score -= 5;

  return score;
}

function findRoamingTariff(tariffsPreview) {
  const tariffs = Array.isArray(tariffsPreview) ? tariffsPreview : [];
  const scored = tariffs
    .map((tariff) => ({ tariff, score: scoreRoamingTariff(tariff) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.tariff ?? null;
}

function scoreRoamingTariff(tariff) {
  if (!tariff || typeof tariff !== "object") return 0;

  const name = normalizeMatchText(tariff.name);
  const type = normalizeMatchText(tariff.type);
  let score = 0;

  if (name.includes("roaming")) score += 8;
  if (type === "network") score += 1;
  if (name.includes("extern")) score += 2;
  if (name.includes("verbund")) score -= 2;
  if (name.includes("basistarif")) score -= 4;

  return score;
}

function normalizeMatchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function formatProviderName(providerName, contractOfferName) {
  // All Ladecloud providers use "ladenetz.de / [ContractOfferName]"
  // because they are all fetched via Ladecloud under ladenetz.de Verbund
  return `ladenetz.de / ${contractOfferName}`;
}

function buildProviderLink(provider, providerId, contractOfferDetail = null) {
  if (contractOfferDetail && typeof contractOfferDetail.furtherContractInformationUrl === "string" && contractOfferDetail.furtherContractInformationUrl.trim()) {
    return contractOfferDetail.furtherContractInformationUrl.trim();
  }

  if (provider && provider.legalDocuments && provider.legalDocuments.rightOfWithdrawal) {
    return provider.legalDocuments.rightOfWithdrawal;
  }

  if (typeof providerId === "string" && providerId.length < 50) {
    return `https://${providerId}.ladecloud.de/contract`;
  }

  return "";
}

function generateSlug(name) {
  return `ladenetz-${sanitizeFileName(name)}`;
}

function normalizeList(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const keys = [...preferredKeys, "items", "data", "results", "providers", "contractOffers", "offers"];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      for (const nestedKey of ["items", "data", "results", "providers", "contractOffers", "offers"]) {
        if (Array.isArray(value[nestedKey])) return value[nestedKey];
      }
    }
  }

  return [];
}

function getProviderId(provider, index) {
  if (!provider || typeof provider !== "object") {
    return `provider-${index + 1}`;
  }

  for (const key of ["id", "providerId", "provider_id", "uuid", "externalId"]) {
    const value = provider[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return `provider-${index + 1}`;
}

function getProviderName(provider, fallback) {
  if (provider && typeof provider === "object") {
    for (const key of ["name", "title", "displayName", "providerName"]) {
      const value = provider[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  return String(fallback);
}

function sanitizeFileName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "provider";
}

async function fetchJson(url, apiKey) {
  try {
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");

      let errorDetail = "";
      if (text) {
        try {
          const json = JSON.parse(text);
          errorDetail = json.message || json.error || text.substring(0, 200);
        } catch {
          errorDetail = text.substring(0, 200);
        }
      }

      const error = new Error(
        `HTTP ${response.status} ${response.statusText}` +
        (errorDetail ? ` - ${errorDetail}` : "")
      );
      error.statusCode = response.status;
      error.url = url;
      throw error;
    }

    return response.json();
  } catch (error) {
    // Add context if not already set
    if (!error.url) {
      error.url = url;
    }
    throw error;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, apiKey, attempts = 2, baseDelayMs = 5000) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (attempt > 1) {
        const delay = baseDelayMs * attempt;
        console.log(`  RETRY: Waiting ${delay}ms before retrying ${url} (attempt ${attempt}/${attempts})`);
        await sleep(delay);
      }
      return await fetchJson(url, apiKey);
    } catch (err) {
      lastError = err;
      const status = err?.statusCode;
      console.warn(`  WARNING: Fetch failed for ${url} (attempt ${attempt}): ${err.message}`);
      // If rate limited, wait a bit longer before next attempt
      if (status === 429) {
        const backoff = Math.max(baseDelayMs * 2, 5000);
        console.warn(`    RATE_LIMIT detected (429). Backing off ${backoff}ms before next try.`);
        await sleep(backoff);
      }
      // if this was the last attempt, break and throw below
      if (attempt === attempts) break;
    }
  }
  // After retries, throw last error to be handled by caller
  throw lastError;
}

function getContractOfferId(contractOffer) {
  if (!contractOffer || typeof contractOffer !== "object") return null;
  const value = contractOffer.id ?? contractOffer.contractOfferId ?? null;
  return value === null || value === undefined || value === "" ? null : String(value);
}

async function fetchContractOfferDetailById(contractOfferId, apiKey, urlCandidates) {
  for (const template of urlCandidates) {
    const url = template.replace("{id}", encodeURIComponent(contractOfferId));
    try {
      return await fetchWithRetry(url, apiKey);
    } catch (error) {
      if (error.statusCode === 404) {
        continue;
      }

      console.warn(`  WARNING: Failed contract-offer detail fetch for ${contractOfferId} via ${url}: ${error.message}`);
      return null;
    }
  }

  return null;
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}



























