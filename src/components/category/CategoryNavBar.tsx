import CategoryMegaMenu from "./CategoryMegaMenu";
import { getNavigationCategories } from "@/lib/categoryService";

/** Reads the navigation tree on the server and hands it to the desktop mega
 * menu. Mounted by both storefront headers so every page carries the same
 * navigation, and rendered from the cached tree so it costs no extra query. */
export default async function CategoryNavBar() {
  const categories = await getNavigationCategories();
  return <CategoryMegaMenu categories={categories} />;
}
