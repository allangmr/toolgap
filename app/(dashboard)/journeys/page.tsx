import { redirect } from "next/navigation";

export default function JourneysPage() {
  redirect("/traffic?tab=journeys");
}
