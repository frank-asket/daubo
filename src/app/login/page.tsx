import { redirect } from "next/navigation";

export default function LoginRouteRollout() {
  redirect("/auth/sign-in");
}
