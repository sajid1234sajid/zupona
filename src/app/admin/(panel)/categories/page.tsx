import { FolderTree, Layers, Package } from "lucide-react";
import { listCategoryTree, type AdminCategory } from "@/lib/adminData";
import CategoryManager from "@/components/admin/CategoryManager";
import { PageHeader, StatCard } from "@/components/admin/ui";

export const metadata = { title: "Categories" };

function flatten(nodes: AdminCategory[]): AdminCategory[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export default async function CategoriesPage() {
  const tree = await listCategoryTree();

  // The tree is three levels deep now, so both figures are counted by walking
  // it rather than by looking one level down.
  const flat = flatten(tree);
  const subcategoryCount = flat.filter((node) => node.depth > 1).length;
  const productCount = flat.reduce((sum, node) => sum + node.productCount, 0);

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Organise your catalog so shoppers can find things"
        breadcrumb={["Categories"]}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 lg:gap-4">
        <StatCard label="Departments" value={String(tree.length)} icon={FolderTree} tone="green" />
        <StatCard label="Subcategories" value={String(subcategoryCount)} icon={Layers} tone="blue" />
        <StatCard label="Categorised Products" value={String(productCount)} icon={Package} tone="orange" />
      </div>

      <CategoryManager tree={tree} />
    </>
  );
}
