import { redirect } from "next/navigation";

export default function OverduePage() {
  redirect("/queue?status=Overdue");
}
