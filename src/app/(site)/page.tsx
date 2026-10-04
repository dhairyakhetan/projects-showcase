import { redirect } from "next/navigation";

/** Every panel is a real route; "/" is just the way in. */
export default function RootPage() {
  redirect("/home");
}
