import type { Metadata } from "next";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import CategoryBrowser from "@/components/category/CategoryBrowser";
import { categoryOverviews } from "@/lib/categories";

export const metadata: Metadata = {
  title: "All Categories — Zupona",
  description: "Browse every Zupona department, from fashion and electronics to baby care.",
};

export default async function CategoriesPage() {
  const categories = await categoryOverviews();

  return (
    // h-screen (not min-h-screen): the two panes scroll independently inside
    // the shell, which is the whole point of the rail staying put.
    <div className="mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden bg-white pb-16">
      <ProductHeader />
      <div className="shrink-0 border-b border-neutral-100 px-4 py-2.5">
        <h1 className="text-base font-bold text-neutral-800">All Categories</h1>
        <p className="text-[10px] text-neutral-400">
          {categories.length} departments ·{" "}
          {categories.reduce((total, category) => total + category.productCount, 0)} products
        </p>
      </div>
      <CategoryBrowser categories={categories} />
      <BottomNav />
    </div>
  );
}
