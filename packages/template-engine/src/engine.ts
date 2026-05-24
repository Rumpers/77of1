import type {
  TemplateDefinition,
  ModalityConsent,
  ResolvedSlot,
  ResolvedTemplate,
} from "./types.js";
import { resolveModality } from "./degrade.js";

export class TemplateEngine {
  /**
   * Resolve every slot in `template` against the given `consent`.
   *
   * Each slot walks its modality degradation chain (video → voice → text,
   * voice → text, image → text) until it finds a consented modality.
   * No slot ever throws on missing consent — it degrades to the next best option.
   *
   * Throws if `consent.textEnabled` is false (indicates a missing consent check
   * upstream; text is the ultimate fallback and must always be permitted).
   */
  resolve(
    template: TemplateDefinition,
    consent: ModalityConsent
  ): ResolvedTemplate {
    const slots: ResolvedSlot[] = template.slots.map((slot) => {
      const { resolved, degradedReason, wasDegraded } = resolveModality(
        slot.preferredModality,
        consent
      );
      return {
        name: slot.name,
        preferredModality: slot.preferredModality,
        resolvedModality: resolved,
        degradedReason,
        wasDegraded,
      };
    });

    return {
      templateId: template.templateId,
      slots,
      allSlotsAtPreferred: slots.every((s) => !s.wasDegraded),
    };
  }
}
