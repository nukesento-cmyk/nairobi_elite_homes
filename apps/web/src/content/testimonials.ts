export type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

// Real member quotes only, added with the member's permission.
// The /join section stays hidden while this is empty.
export const testimonials: Testimonial[] = [];
