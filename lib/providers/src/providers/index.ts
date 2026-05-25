export * from "./interfaces.js";
export * from "./mocks.js";
export * from "./registry.js";
export { GmiClient, createGmiClient } from "./gmi-client.js";
export type { GmiClientConfig, GmiRequestOptions } from "./gmi-client.js";
export { renderTemplate, listTemplates } from "./email-templates.js";
export type { RenderedEmail } from "./email-templates.js";
export {
  ResendEmailProvider,
  getEmailProvider,
  resetEmailProvider,
} from "./resend-email.js";
