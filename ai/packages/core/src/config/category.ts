import { Schema } from "effect"
import { CategoryNameSchema } from "../category"

export class CategoryEntry extends Schema.Class<CategoryEntry>("Config.CategoryEntry")({
  model: Schema.String.pipe(Schema.optional),
  variant: Schema.String.pipe(Schema.optional),
  fallback_models: Schema.Array(Schema.String).pipe(Schema.optional),
  description: Schema.String.pipe(Schema.optional),
  temperature: Schema.Number.pipe(Schema.optional),
  maxTokens: Schema.Number.pipe(Schema.optional),
}) {}

export const CategoriesConfig = Schema.Record(CategoryNameSchema, CategoryEntry)

export type CategoriesConfig = typeof CategoriesConfig.Type
