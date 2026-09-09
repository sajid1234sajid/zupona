import type { Category } from "@/types";

/** The category tree behind the two-pane browser at /categories.
 *
 * The shape follows Daraz and Alibaba's mobile taxonomy: a small set of
 * top-level departments, each split into a handful of concrete subcategories.
 * Depth stops at two levels on purpose — a third level tests worse on a phone
 * than a chip row does, because a shopper cannot see where they are.
 *
 * `id` doubles as the URL slug (/category/electronics), so ids are kebab-case
 * and must stay stable: products reference them, and so does db/seed.sql.
 *
 * Images are reused from the product catalog so every tile resolves against
 * the `images.unsplash.com` remote pattern in next.config.ts.
 */
export const categories: Category[] = [
  {
    id: "mens-fashion",
    name: "Men's Fashion",
    subtitle: "Style with Comfort",
    accent: "#3b5998",
    image:
      "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "shirts-tshirts",
        name: "Shirts & T-Shirts",
        image:
          "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "jackets",
        name: "Jackets",
        image:
          "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "mens-footwear",
        name: "Footwear",
        image:
          "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "panjabi",
        name: "Panjabi",
        image:
          "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "womens-fashion",
    name: "Women's Fashion",
    subtitle: "Trendy & Traditional",
    accent: "#e8a0b0",
    image:
      "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "dresses",
        name: "Dresses",
        image:
          "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "kurti-salwar",
        name: "Kurti & Salwar",
        image:
          "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "sarees",
        name: "Sarees",
        image:
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "womens-footwear",
        name: "Footwear",
        image:
          "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "mens-accessories",
    name: "Men's Accessories",
    subtitle: "Bags, Belt & More",
    accent: "#6b4423",
    image:
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "wallets-belts",
        name: "Wallets & Belts",
        image:
          "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "mens-watches",
        name: "Watches",
        image:
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "bags-backpacks",
        name: "Bags & Backpacks",
        image:
          "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "womens-accessories",
    name: "Women's Accessories",
    subtitle: "Bangles & Traditional",
    accent: "#b8860b",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "bangles-jewellery",
        name: "Bangles & Jewellery",
        image:
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "handbags",
        name: "Handbags",
        image:
          "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "womens-watches",
        name: "Watches",
        image:
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "baby-products",
    name: "Baby Products",
    subtitle: "Everything for little ones",
    accent: "#f5e6a0",
    image:
      "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "baby-clothing",
        name: "Baby Clothing",
        image:
          "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "baby-care",
        name: "Baby Care",
        image:
          "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "toys",
        name: "Toys",
        image:
          "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "health-beauty",
    name: "Health & Beauty",
    subtitle: "Care, Skin & Beauty",
    accent: "#e8909f",
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "skincare",
        name: "Skin Care",
        image:
          "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "haircare",
        name: "Hair Care",
        image:
          "https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "makeup",
        name: "Makeup",
        image:
          "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "wellness",
        name: "Wellness",
        image:
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    subtitle: "Smart Gadget & Tech",
    accent: "#3b6fd6",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "audio",
        name: "Audio",
        image:
          "https://images.unsplash.com/photo-1560243563-062bfc001d68?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "wearables",
        name: "Wearables",
        image:
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "mobile-accessories",
        name: "Mobile Accessories",
        image:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "home-appliances",
        name: "Home Appliances",
        image:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
  {
    id: "body-bath",
    name: "Body & Bath",
    subtitle: "Skincare, Hygiene & Care",
    accent: "#a0e8c4",
    image:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=200&q=70",
    subcategories: [
      {
        id: "body-care",
        name: "Body Care",
        image:
          "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "bath-essentials",
        name: "Bath Essentials",
        image:
          "https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=200&q=70",
      },
      {
        id: "fragrance",
        name: "Fragrance",
        image:
          "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=200&q=70",
      },
    ],
  },
];
