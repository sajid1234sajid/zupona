import { FolderTree, Layers, Package } from "lucide-react";
import { listCategoryTree } from "@/lib/adminData";
import CategoryManager from "@/components/admin/CategoryManager";
import { PageHeader, StatCard } from "@/components/admin/ui";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const tree = await listCategoryTree();

  const subcategoryCount = tree.reduce((sum, node) => sum + node.children.length, 0);
  const productCount = tree.reduce(
    (sum, node) =>
      sum + node.productCount + node.children.reduce((inner, child) => inner + child.productCount, 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Organise your catalog so shoppers can find things"
        breadcrumb={["Categories"]}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 lg:gap-4">
        <StatCard label="Categories" value={String(tree.length)} icon={FolderTree} tone="green" />
        <StatCard label="Subcategories" value={String(subcategoryCount)} icon={Layers} tone="blue" />
        <StatCard label="Categorised Products" value={String(productCount)} icon={Package} tone="orange" />
      </div>

      <CategoryManager tree={tree} />
    </>
  );
}
