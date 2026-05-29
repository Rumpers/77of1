import { pgTable, text, boolean, jsonb, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personasTable = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id").notNull(),
  greetingStyle: text("greeting_style").notNull().default(""),
  fanEndearment: text("fan_endearment").notNull().default("fan"),
  emojiUsage: text("emoji_usage").notNull().default("minimal"),
  hardStops: jsonb("hard_stops").notNull().default([]),
  treatmentStyle: text("treatment_style").notNull().default(""),
  personalityTraits: jsonb("personality_traits").notNull().default([]),
  messageStyle: text("message_style").notNull().default(""),
  intensityLevel: text("intensity_level").notNull().default("warm"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const twinConfigsTable = pgTable("twin_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id").notNull().unique(),
  personaId: uuid("persona_id").references(() => personasTable.id),
  killSwitch: boolean("kill_switch").notNull().default(false),
  killSwitchActivatedAt: timestamp("kill_switch_activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const EmojiUsage = z.enum(["none", "minimal", "moderate", "heavy"]);
export const IntensityLevel = z.enum(["warm", "intimate", "explicit"]);

export const insertPersonaSchema = createInsertSchema(personasTable, {
  emojiUsage: EmojiUsage,
  intensityLevel: IntensityLevel,
  hardStops: z.array(z.string()),
  personalityTraits: z.array(z.string()),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectPersonaSchema = createSelectSchema(personasTable, {
  emojiUsage: EmojiUsage,
  intensityLevel: IntensityLevel,
  hardStops: z.array(z.string()),
  personalityTraits: z.array(z.string()),
});

export const insertTwinConfigSchema = createInsertSchema(twinConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Persona = z.infer<typeof selectPersonaSchema>;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type TwinConfig = typeof twinConfigsTable.$inferSelect;
export type InsertTwinConfig = z.infer<typeof insertTwinConfigSchema>;
