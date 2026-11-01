import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { schemaTypes, singletons } from "./schemaTypes";

const singletonTypes = new Set(singletons.map(({ type }) => type));

export default defineConfig({
  name: "default",
  title: "NairobiEliteHomes",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "notconnected",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            // One fixed document each, which the website reads by ID.
            ...singletons.map(({ type, title }) =>
              S.listItem()
                .title(title)
                .id(type)
                .child(S.document().schemaType(type).documentId(type)),
            ),
            S.divider(),
            ...S.documentTypeListItems().filter((item) => !singletonTypes.has(item.getId() ?? "")),
          ]),
    }),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      singletonTypes.has(schemaType)
        ? actions.filter(({ action }) => action !== "delete" && action !== "duplicate")
        : actions,
  },
});
