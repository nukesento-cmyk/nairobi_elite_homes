// Real photos of the places, from Wikimedia Commons, with what their licences require.
// `caption` says what's actually shown: a photo near an area never claims to be of it.
export type PlaceImage = {
  src: string;
  alt: string;
  caption: string;
  author: string;
  licence: string;
  sourceUrl: string;
};

const place = (name: string, rest: Omit<PlaceImage, "src">): PlaceImage => ({
  src: `/images/places/${name}.webp`,
  ...rest,
});

export const placeImages: Record<string, PlaceImage> = {
  karen: place("karen", {
    alt: "The Karen Blixen Museum, a long stone house with a wide lawn, in Karen",
    caption: "Karen Blixen Museum, Karen",
    author: "Grenadille",
    licence: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Karen_Blixen_museum,_Karen,_Kenya.jpg",
  }),
  kilimani: place("kilimani", {
    alt: "Modern office and apartment buildings on Ring Road, Kilimani",
    caption: "Ring Road, Kilimani",
    author: "Queen Asali",
    licence: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kilimani-Ring_Road_Nairobi.jpg",
  }),
  rosslyn: place("rosslyn", {
    alt: "The Village Market's buildings lit up at night, near Rosslyn",
    caption: "The Village Market, near Rosslyn",
    author: "DesiBoy101",
    licence: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:The_Village_Market_buildings_at_night.jpg",
  }),
  muthaiga: place("muthaiga", {
    alt: "A green fairway lined with trees at Muthaiga Golf Club",
    caption: "Muthaiga Golf Club, Muthaiga",
    author: "Jeff Turner",
    licence: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Muthaiga_Golf_Club,_Nairobi.jpg",
  }),
  runda: place("runda", {
    alt: "Tall trees in Karura Forest, near Runda",
    caption: "Karura Forest, near Runda",
    author: "Ninara",
    licence: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Karura_Forest,_Nairobi_(53550853911).jpg",
  }),
  // No licensed photo of Lavington itself could be found. Replace this when there is one.
  lavington: place("lavington", {
    alt: "Office towers in central Nairobi under a blue sky",
    caption: "Central Nairobi, a short drive from Lavington",
    author: "Lmwangi",
    licence: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Nairobi_skyline_P1000020.jpg",
  }),
  land: place("land", {
    alt: "Green open land stretching towards the Ngong Hills under a bright sky",
    caption: "Towards the Ngong Hills",
    author: "Siegmund Kamau",
    licence: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ngong%27_Hills,_Nairobi,_Kenya.jpg",
  }),
  join: place("join", {
    alt: "The Nairobi skyline seen across the savannah of Nairobi National Park",
    caption: "Nairobi from Nairobi National Park",
    author: "Timothy A. Gonsalves",
    licence: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Nairobi_Skyline_Savannah_Kenya_May19_R1600687.jpg",
  }),
  areas: place("areas", {
    alt: "Office towers on the Nairobi skyline, seen from Upper Hill",
    caption: "Nairobi from Upper Hill",
    author: "Lmwangi",
    licence: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Nairobi_skyline_P1000019.jpg",
  }),
};
