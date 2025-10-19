export type ListingType = "game" | "console";

export interface ImageConstraints {
  maxUploadMb: number;
  maxWidthPx: number;
  ocrEnabled: boolean;
}

export const defaultImageConstraints: ImageConstraints = {
  maxUploadMb: 1,
  maxWidthPx: 480,
  ocrEnabled: true
};

export interface QueueNames {
  evidenceSanitization: string;
  nightlyAggregation: string;
}

export const queueNames: QueueNames = {
  evidenceSanitization: "evidence-sanitization",
  nightlyAggregation: "jobs-nightly-aggregation"
};
