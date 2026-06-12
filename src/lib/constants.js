// TTB-mandated Government Health Warning (27 CFR Part 16).
// Must appear verbatim; "GOVERNMENT WARNING:" must be capitalized and bold.
export const GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

export const FIELDS = [
  { key: "brandName",    label: "Brand name" },
  { key: "classType",    label: "Class / type designation" },
  { key: "alcoholContent", label: "Alcohol content (ABV)" },
  { key: "netContents",  label: "Net contents" },
  { key: "bottlerInfo",  label: "Bottler / producer name & address" },
  { key: "countryOfOrigin", label: "Country of origin (imports)" },
  { key: "governmentWarning", label: "Government warning statement" },
];

export const STATUS = {
  PASS: "pass",     // exact / acceptable match
  REVIEW: "review", // likely match, needs human judgment (e.g. case difference)
  FAIL: "fail",     // mismatch or missing
  SKIP: "skip",     // not applicable (e.g. country of origin, domestic product)
};

export const EMPTY_APPLICATION = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerInfo: "",
  countryOfOrigin: "",
  isImport: false,
};

export const SAMPLE_APPLICATION = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45",
  netContents: "750 mL",
  bottlerInfo: "Old Tom Distillery Co., Bardstown, KY",
  countryOfOrigin: "",
  isImport: false,
};
