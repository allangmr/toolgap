import { redirect } from "next/navigation";

export default function SessionsPage() {
  redirect("/traffic?tab=sessions");
}
