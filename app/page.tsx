import { redirect } from "next/navigation";

// Redirect to /login at request time: the root layout reads the locale cookie.
export const instant = false;

export default function RootPage() {
  redirect("/login");
}
