import type { Metadata } from "next";
import { CategoriesView } from "@/components/settings/views/CategoriesView";

export const metadata: Metadata = { title: "Categories" };

export default function Page() {
  return <CategoriesView />;
}
