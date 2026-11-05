import type { ServicesSectionConfig } from '../../src/types';
import { DEFAULT_SERVICES_SECTION } from '../../src/types';

export const SERVICES_SECTION_SETTING_KEY = 'services_section';

const clean = (value: unknown, fallback: string, max: number): string =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;

/** Coerces stored/received JSON into a valid config; missing or bad fields fall back to the defaults. */
export function normalizeServicesSection(input: any): ServicesSectionConfig {
  const ids = Array.isArray(input?.signatureIds)
    ? input.signatureIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length < 120)
    : DEFAULT_SERVICES_SECTION.signatureIds;
  return {
    signatureIds: Array.from(new Set<string>(ids)).slice(0, 12),
    signatureTitle: clean(input?.signatureTitle, DEFAULT_SERVICES_SECTION.signatureTitle, 80),
    signatureIntro: clean(input?.signatureIntro, DEFAULT_SERVICES_SECTION.signatureIntro, 300),
    servicesTitle: clean(input?.servicesTitle, DEFAULT_SERVICES_SECTION.servicesTitle, 80),
    servicesIntro: clean(input?.servicesIntro, DEFAULT_SERVICES_SECTION.servicesIntro, 300)
  };
}
