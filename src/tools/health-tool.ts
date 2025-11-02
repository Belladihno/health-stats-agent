import { createTool } from "@mastra/core";
import { z } from "zod";
import { COUNTRY_CODES, INDICATORS } from "../utils/helper";
import { CacheService, CACHE_TTL } from "../services/cache.service";

let cacheService: CacheService | null = null;

export const initHealthToolCache = (cache: CacheService) => {
  cacheService = cache;
};

export const healthStatsTool = createTool({
  id: "get-health-stats",
  description: `Get country-level health statistics from World Bank. Available indicators:
    - life_expectancy: Life expectancy at birth in years
    - infant_mortality: Infant mortality rate per 1,000 live births
    - health_expenditure: Current health expenditure per capita in USD
    - immunization: Immunization DPT coverage percentage of children
    - skilled_births: Births attended by skilled health staff percentage
    - hiv_prevalence: HIV prevalence percentage of population ages 15-49`,

  inputSchema: z.object({
    country: z
      .string()
      .describe("Country name (e.g., Nigeria, Kenya, USA, Japan)"),
    indicator: z
      .enum([
        "life_expectancy",
        "infant_mortality",
        "health_expenditure",
        "immunization",
        "skilled_births",
        "hiv_prevalence",
      ])
      .describe("Health indicator to retrieve"),
  }),

  outputSchema: z.object({
    country: z.string(),
    countryCode: z.string(),
    indicator: z.string(),
    indicatorName: z.string(),
    value: z.number().nullable(),
    year: z.string(),
    unit: z.string(),
    success: z.boolean(),
  }),

  execute: async ({ context }) => {
    const { country, indicator } = context;

    const countryLower = country.toLowerCase().trim();
    const countryCode = COUNTRY_CODES[countryLower];

    if (!countryCode) {
      throw new Error(
        `Country '${country}' not recognized. Try countries like: Nigeria, USA, India, UK, Kenya, Brazil, Japan, etc.`
      );
    }

    const indicatorCode = INDICATORS[indicator];
    const cacheKey = `health:${countryCode}:${indicator}`;

    // Try cache first
    if (cacheService) {
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    // Fetch from API
    const apiUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&mrnev=1&per_page=1`;

    console.log(`🌐 Fetching from World Bank API`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "HealthStatsAgent/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `World Bank API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;
      const indicators = data[1];

      if (!indicators || indicators.length === 0 || !indicators[0]?.value) {
        throw new Error(
          `No recent data available for ${country} - ${indicator}. The World Bank may not have this data for this country.`
        );
      }

      const latestData = indicators[0];

      const indicatorNames: Record<string, string> = {
        life_expectancy: "Life Expectancy at Birth",
        infant_mortality: "Infant Mortality Rate",
        health_expenditure: "Health Expenditure per Capita",
        immunization: "Immunization Coverage (DPT)",
        skilled_births: "Births Attended by Skilled Health Staff",
        hiv_prevalence: "HIV Prevalence",
      };

      const units: Record<string, string> = {
        life_expectancy: "years",
        infant_mortality: "per 1,000 live births",
        health_expenditure: "USD",
        immunization: "% of children ages 12-23 months",
        skilled_births: "% of total births",
        hiv_prevalence: "% of population ages 15-49",
      };

      const result = {
        country: latestData.country.value,
        countryCode: latestData.countryiso3code,
        indicator,
        indicatorName: indicatorNames[indicator],
        value: latestData.value,
        year: latestData.date,
        unit: units[indicator],
        success: true,
      };

      // Cache the result
      if (cacheService) {
        await cacheService.set(cacheKey, result, CACHE_TTL);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Request timeout: World Bank API took too long to respond. Please try again."
          );
        }
        throw new Error(`Failed to fetch health data: ${error.message}`);
      }
      throw error;
    }
  },
});