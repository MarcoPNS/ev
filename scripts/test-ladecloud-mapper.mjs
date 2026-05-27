#!/usr/bin/env node
/**
 * Ladecloud Mapper Test Runner
 * Validates mapper logic with sample data from the Ladecloud API
 */

// Beispielkontraktor aus EXAMPLE_LADECLOUD.md
const exampleContractOffer = {
  cardOrderFee: { currency: "EUR", value: "9.99" },
  contractOfferName: "17er Autostrom",
  firstCardStartingMonthlyCardFee: { currency: "EUR", value: "5" },
  monthlyCardBaseFee: { currency: "EUR", value: "0" },
  monthlyFeeList: [
    {
      fromMonth: 1,
      grossPrice: { currency: "EUR", value: "7.5" },
    },
  ],
  startingMonthlyContractFee: { currency: "EUR", value: "7.5" },
  tariffsPreview: [
    {
      componentsPreview: [
        { currentType: "AC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.49" } },
        { currentType: "DC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.67" } },
      ],
      name: "Tarif AC/DC ladenetz.de Verbund",
      type: "BASIC",
    },
    {
      componentsPreview: [
        { currentType: "AC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.40" } },
        { currentType: "DC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.50" } },
      ],
      name: "Tarif AC/DC Ladepunkte 17er Oberlandenergie",
      type: "OPERATOR",
    },
    {
      componentsPreview: [
        { currentType: "AC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.49" } },
        { currentType: "DC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.67" } },
      ],
      name: "Tarif AC/DC Roaming",
      type: "NETWORK",
    },
    {
      componentsPreview: [
        { currentType: "AC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.46" } },
        { currentType: "DC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.56" } },
      ],
      name: "Ladenetz-Verbund",
      type: "NETWORK",
    },
    {
      componentsPreview: [{ currentType: "AC/DC", unrestrictedGrossEnergyPrice: { currency: "EUR", value: "0.79" } }],
      name: "Hochpreisbetreiber (z.B. Ionity)",
      type: "OPERATOR",
    },
  ],
};

const exampleProvider = {
  id: "3d09dc89-0394-463e-9d6e-eb07dd3bf1be",
  operatorBdewId: "DETEST",
  name: "17er Oberlandenergie",
  address: { city: "Bad Tölz", country: "DE", zipCode: "83646" },
  contact: { email: "info@17er.de" },
  legalDocuments: {
    rightOfWithdrawal: "https://17er.ladecloud.de/contract",
  },
};

const exampleContractOfferDetail = {
  id: "8d9b0248-2f88-449d-93b3-4e9399051076",
  furtherContractInformationUrl: "https://17er.ladecloud.de/contract/details/8d9b0248-2f88-449d-93b3-4e9399051076",
  additionalInformation: "This is additional info from the contract offer. Ladenetz Verbund included.",
};

// Import der Mapper-Funktionen (müssten aus dem Hauptskript extrahiert sein)
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

  return [...monthlyFeeList]
    .sort((a, b) => Number(a?.fromMonth ?? Number.POSITIVE_INFINITY) - Number(b?.fromMonth ?? Number.POSITIVE_INFINITY))
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

function generateSlugWithOperator(name, operatorId) {
  const base = sanitizeFileName(name);
  const op = operatorId ? sanitizeFileName(String(operatorId)) : null;
  return op ? `ladenetz-${base}-${op}` : `ladenetz-${base}`;
}

function sanitizeFileName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "provider";
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

  const cardOrderFee =
    contractOffer.cardOrderFee && contractOffer.cardOrderFee.value ? parseFloat(contractOffer.cardOrderFee.value) : null;

  const name = formatProviderName(provider.name || contractOfferName, contractOfferName);

  const comments = [];
  if (cardOrderFee) {
    comments.push(`Card fee once: €${Number(cardOrderFee).toFixed(2)}`);
  }
  if (contractOffer.maxCountOfCards) {
    comments.push(`Max ${contractOffer.maxCountOfCards} cards`);
  }
  const additionalInfo = (contractOfferDetail && contractOfferDetail.additionalInformation) || contractOffer.additionalInformation;
  if (additionalInfo && String(additionalInfo).trim()) {
    const info = String(additionalInfo).trim().replace(/\s+/g, ' ');
    comments.push(info);
  }

  return {
    name,
    acPrice: Number(acPrice.toFixed(2)),
    dcPrice: Number(dcPrice.toFixed(2)),
    acRoamingPrice: acRoamingPrice !== null ? Number(acRoamingPrice.toFixed(2)) : null,
    dcRoamingPrice: dcRoamingPrice !== null ? Number(dcRoamingPrice.toFixed(2)) : null,
    basicFee: Number(basicFee.toFixed(2)),
    supportedNetworks: ["ladenetz.de"],
    country: "DE",
    footnote: `Auto-imported on ${new Date().toLocaleDateString("en-US")}`,
    comment: comments.length > 0 ? comments.join(" ") : "",
    link: buildProviderLink(provider, providerId, contractOfferDetail),
    isAffiliate: false,
    hidden: false,
    sourceProviderId: providerId,
    _slug: generateSlugWithOperator(contractOfferName, exampleProvider.operatorBdewId || exampleProvider.bdewId || exampleProvider.id),
  };
}

// Test
console.log("Testing Ladecloud mapper with example data...\n");
try {
  const mapped = mapContractOfferToProvider(
    exampleContractOffer,
    exampleProvider,
    exampleProvider.id,
    0,
    exampleContractOfferDetail,
  );

  console.log("✓ Mapping successful!");
  console.log("\nMapped provider object:");
  console.log(JSON.stringify(mapped, null, 2));

  // Slug will be removed later, but we show the generated slug
  const slug = mapped._slug;
  console.log(`\nGenerated filename: ${slug}.json`);

  // Validations
  const checks = [
    {
      name: "Name correctly formatted",
      ok: mapped.name === "ladenetz.de / 17er Autostrom",
    },
    { name: "Slug correctly generated", ok: slug === "ladenetz-17er-autostrom-detest" },
    { name: "AC price present", ok: mapped.acPrice === 0.46 },
    { name: "DC price present", ok: mapped.dcPrice === 0.56 },
    { name: "AC roaming present", ok: mapped.acRoamingPrice === 0.49 },
    { name: "DC roaming present", ok: mapped.dcRoamingPrice === 0.67 },
    { name: "Basic fee correct", ok: mapped.basicFee === 7.5 },
    { name: "Supported networks set", ok: Array.isArray(mapped.supportedNetworks) },
    { name: "Country set", ok: mapped.country === "DE" },
    { name: "Link present", ok: mapped.link.length > 0 },
    { name: "Link from contract-offer details", ok: mapped.link === exampleContractOfferDetail.furtherContractInformationUrl },
    { name: "Comment with card fee", ok: mapped.comment.includes("9.99") },
    { name: "Comment includes additional info", ok: mapped.comment.includes("additional info from the contract offer") },
  ];

  console.log("\nValidations:");
  checks.forEach((check) => {
    const icon = check.ok ? "✓" : "✗";
    console.log(`${icon} ${check.name}`);
  });

  const allPass = checks.every((c) => c.ok);
  if (allPass) {
    console.log("\n✓ All tests passed!");
    process.exit(0);
  } else {
    console.log("\n✗ Some tests failed!");
    process.exit(1);
  }
} catch (error) {
  console.error("✗ Error during mapping:", error.message);
  process.exit(1);
}
