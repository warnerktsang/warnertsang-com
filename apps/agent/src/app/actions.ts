"use server";
import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/admin" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
