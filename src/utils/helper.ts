// Health indicator codes from World Bank API
export const INDICATORS = {
  life_expectancy: "SP.DYN.LE00.IN",
  infant_mortality: "SP.DYN.IMRT.IN",
  health_expenditure: "SH.XPD.CHEX.PC.CD",
  immunization: "SH.IMM.IDPT",
  skilled_births: "SH.STA.BRTC.ZS",
  hiv_prevalence: "SH.DYN.AIDS.ZS",
} as const;

// ISO country codes mapping (these are the available countries for now, might add more later.)
export const COUNTRY_CODES: Record<string, string> = {
  // Africa
  nigeria: "NGA",
  ghana: "GHA",
  kenya: "KEN",
  "south africa": "ZAF",
  egypt: "EGY",
  ethiopia: "ETH",
  tanzania: "TZA",
  uganda: "UGA",
  morocco: "MAR",
  algeria: "DZA",

  // Americas
  usa: "USA",
  "united states": "USA",
  canada: "CAN",
  brazil: "BRA",
  mexico: "MEX",
  argentina: "ARG",
  colombia: "COL",
  chile: "CHL",

  // Europe
  uk: "GBR",
  "united kingdom": "GBR",
  germany: "DEU",
  france: "FRA",
  italy: "ITA",
  spain: "ESP",
  poland: "POL",
  netherlands: "NLD",

  // Asia
  india: "IND",
  china: "CHN",
  japan: "JPN",
  "south korea": "KOR",
  indonesia: "IDN",
  pakistan: "PAK",
  bangladesh: "BGD",
  vietnam: "VNM",
  philippines: "PHL",
  thailand: "THA",

  // Oceania
  australia: "AUS",
  "new zealand": "NZL",
};

// export interface WorldBankMetadata {
//   page: number;
//   pages: number;
//   per_page: string;
//   total: number;
// }

// export interface IndicatorData {
//   indicator: {
//     id: string;
//     value: string;
//   };
//   country: {
//     id: string;
//     value: string;
//   };
//   countryiso3code: string;
//   date: string;
//   value: number | null;
//   unit?: string;
//   obs_status?: string;
//   decimal?: number;
// }

// export type WorldBankResponse = [WorldBankMetadata, IndicatorData[]];
