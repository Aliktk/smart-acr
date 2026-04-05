import { redirect } from "next/navigation";

export default function PriorityPage() {
  redirect("/queue?priority=true");
}
