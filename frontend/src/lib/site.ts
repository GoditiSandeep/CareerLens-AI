// Public site + owner configuration.
// These values are safe to ship to the browser. Never add passwords, tokens,
// API keys, or the administrator password here — those live only on the server.
export const SITE = {
  name: "CareerLens AI",
  tagline: "Discover. Prepare. Grow. Get Career-Ready.",
  ownerName: "Godithi Kiran Sri Sai Sandeep",
  adminDisplayName: "Godithi Sandeep",
  email: "goditisandeep@gmail.com",
  phone: "8247336510",
} as const;

export const OWNER = {
  name: SITE.ownerName,
  email: SITE.email,
  phone: SITE.phone,
} as const;
