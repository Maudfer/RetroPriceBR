import type { ImageConstraints } from "@retroprice/shared";

export interface ConfidenceInput {
  baseWeight: number;
  userReputation: number;
}

export const computeRawScore = ({ baseWeight, userReputation }: ConfidenceInput): number => {
  return baseWeight * (1 + Math.log10(userReputation + 1));
};

export const sanitizeImageConstraints = (constraints: Partial<ImageConstraints>): ImageConstraints => {
  return {
    maxUploadMb: constraints.maxUploadMb ?? 1,
    maxWidthPx: constraints.maxWidthPx ?? 480,
    ocrEnabled: constraints.ocrEnabled ?? true
  };
};
