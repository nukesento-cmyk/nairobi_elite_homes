import { defineArrayMember, defineField, defineType } from "sanity";

const imageWithAlt = {
  type: "image" as const,
  options: { hotspot: true, metadata: ["lqip", "palette"] },
  fields: [
    defineField({
      name: "alt",
      title: "Description for screen readers",
      type: "string",
      validation: (rule) => rule.required(),
    }),
  ],
};

const listing = defineType({
  name: "listing",
  title: "Listing",
  type: "document",
  groups: [
    { name: "basics", title: "Basics", default: true },
    { name: "location", title: "Location" },
    { name: "details", title: "Details" },
    { name: "media", title: "Media" },
    { name: "internal", title: "Internal" },
  ],
  fields: [
    defineField({ name: "title", type: "string", group: "basics", validation: (rule) => rule.required() }),
    defineField({
      name: "slug",
      type: "slug",
      group: "basics",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      type: "string",
      group: "basics",
      description:
        "Public listings get their own page. Off-market and members-only listings appear on the site only as locked cards showing the area.",
      options: {
        list: [
          { title: "Public", value: "public" },
          { title: "Off-market", value: "off_market" },
          { title: "Members only", value: "members_only" },
        ],
        layout: "radio",
      },
      initialValue: "public",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "vertical",
      type: "string",
      group: "basics",
      options: {
        list: [
          { title: "Residential", value: "residential" },
          { title: "Land", value: "land" },
          { title: "Commercial", value: "commercial" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "isFeatured", title: "Featured", type: "boolean", group: "basics", initialValue: false }),
    defineField({
      name: "price",
      type: "object",
      group: "basics",
      options: { columns: 3 },
      validation: (rule) => rule.required(),
      fields: [
        defineField({ name: "amount", type: "number", validation: (rule) => rule.required().positive() }),
        defineField({
          name: "currency",
          type: "string",
          options: { list: ["KES", "USD"] },
          initialValue: "KES",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "period",
          type: "string",
          options: {
            list: [
              { title: "For sale", value: "sale" },
              { title: "Per month", value: "month" },
            ],
          },
          initialValue: "sale",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "location",
      type: "object",
      group: "location",
      validation: (rule) => rule.required(),
      fields: [
        defineField({
          name: "area",
          type: "string",
          description: "Shown publicly, including on locked cards.",
          options: { list: ["Karen", "Runda", "Kilimani", "Rosslyn", "Lavington", "Muthaiga"] },
          validation: (rule) => rule.required(),
        }),
        defineField({ name: "subArea", title: "Sub-area", type: "string" }),
        defineField({ name: "coords", title: "Exact location", type: "geopoint" }),
        defineField({
          name: "isExactPublic",
          title: "Show the sub-area and exact location publicly",
          type: "boolean",
          description: "Leave off to share them only in the group.",
          initialValue: false,
        }),
      ],
    }),
    defineField({ name: "description", type: "text", rows: 6, group: "details" }),
    defineField({
      name: "specs",
      type: "object",
      group: "details",
      options: { columns: 2 },
      fields: [
        defineField({ name: "beds", title: "Bedrooms", type: "number" }),
        defineField({ name: "baths", title: "Bathrooms", type: "number" }),
        defineField({ name: "acreage", type: "number" }),
        defineField({ name: "sqm", title: "Square metres", type: "number" }),
        defineField({
          name: "titleStatus",
          type: "string",
          options: { list: ["freehold", "leasehold"] },
        }),
        defineField({ name: "zoning", type: "string" }),
      ],
    }),
    defineField({
      name: "features",
      type: "array",
      group: "details",
      of: [defineArrayMember({ type: "string" })],
    }),
    defineField({
      name: "media",
      type: "object",
      group: "media",
      fields: [
        defineField({ name: "hero", ...imageWithAlt }),
        defineField({
          name: "gallery",
          type: "array",
          of: [defineArrayMember(imageWithAlt)],
        }),
        defineField({ name: "matterportId", title: "Matterport ID", type: "string" }),
        defineField({ name: "splineSceneUrl", title: "Spline scene URL", type: "url" }),
      ],
    }),
    defineField({
      name: "ownerContact",
      type: "text",
      rows: 3,
      group: "internal",
      description: "Never shown on the website. For sharing in the group.",
    }),
  ],
  preview: {
    select: { title: "title", area: "location.area", status: "status", media: "media.hero" },
    prepare: ({ title, area, status, media }) => ({
      title,
      subtitle: [area, status].filter(Boolean).join(" · "),
      media,
    }),
  },
});

const whyJoinCard = defineType({
  name: "whyJoinCard",
  title: "Why join card",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "icon",
      type: "string",
      options: { list: ["clock", "shield", "map", "phone", "scale", "users"] },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "problem", type: "text", rows: 2, validation: (rule) => rule.required() }),
    defineField({ name: "solution", type: "text", rows: 2, validation: (rule) => rule.required() }),
    defineField({ name: "ctaLabel", title: "Button label", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "ctaSource",
      title: "Analytics name",
      type: "string",
      description: "Unique, lowercase, underscores only. Example: first_look",
      validation: (rule) => rule.required().regex(/^[a-z_]+$/),
    }),
    defineField({
      name: "order",
      type: "number",
      description: "Lower numbers appear first. The homepage shows the first four.",
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [{ title: "Order", name: "order", by: [{ field: "order", direction: "asc" }] }],
});

const testimonial = defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "document",
  fields: [
    defineField({
      name: "quote",
      type: "text",
      rows: 3,
      description: "Real member quotes only, used with their permission.",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "name", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "role", type: "string", validation: (rule) => rule.required() }),
  ],
});

export const schemaTypes = [listing, whyJoinCard, testimonial];
