"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMissingSupabaseEnv } from "@/lib/supabase/env";
import type { AuthFormState } from "@/lib/types";
import {
  readString,
  safeNextPath,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateRole,
} from "@/server/validation";

const NOT_CONNECTED =
  "This preview is not connected to a database yet. Add the Supabase settings from .env.example and restart the site.";

function authFailure(error: unknown): AuthFormState | null {
  if (isMissingSupabaseEnv(error)) {
    return { error: NOT_CONNECTED };
  }
  return null;
}

export async function signIn(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readString(formData.get("email"));
  const password = readString(formData.get("password"));
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);

  if (emailError || passwordError) {
    return { fieldErrors: { email: emailError ?? undefined, password: passwordError ?? undefined } };
  }

  let destination = "/account";

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "Email or password is incorrect." };
    }

    destination = safeNextPath(formData.get("next")) ?? "/account";
  } catch (error) {
    const failure = authFailure(error);
    if (failure) {
      return failure;
    }
    throw error;
  }

  redirect(destination);
}

export async function signUp(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readString(formData.get("email"));
  const password = readString(formData.get("password"));
  const displayName = readString(formData.get("displayName"));
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const nameError = validateDisplayName(displayName);

  if (emailError || passwordError || nameError) {
    return {
      fieldErrors: {
        email: emailError ?? undefined,
        password: passwordError ?? undefined,
        displayName: nameError ?? undefined,
      },
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      const already =
        error.message.toLowerCase().includes("already") ||
        error.code === "user_already_exists";
      return {
        error: already
          ? "An account with that email already exists. Try signing in."
          : "The account could not be created. Check the email and password and try again.",
      };
    }

    if (!data.session) {
      return {
        message:
          "Account created. Confirm the email before signing in. This preview does not send prize or payment messages.",
      };
    }
  } catch (error) {
    const failure = authFailure(error);
    if (failure) {
      return failure;
    }
    throw error;
  }

  redirect("/account");
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    if (!isMissingSupabaseEnv(error)) {
      throw error;
    }
  }

  redirect("/");
}

export async function updateDisplayName(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const displayName = readString(formData.get("displayName"));
  const nameError = validateDisplayName(displayName);

  if (nameError) {
    return { fieldErrors: { displayName: nameError } };
  }

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return { error: "Sign in again to update your name." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userData.user.id);

    if (error) {
      return { error: "The name could not be saved." };
    }
  } catch (error) {
    const failure = authFailure(error);
    if (failure) {
      return failure;
    }
    throw error;
  }

  revalidatePath("/account");
  return { message: "Name saved." };
}

export async function changeUserRole(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const userId = readString(formData.get("userId"));
  const role = validateRole(readString(formData.get("role")));

  if (!userId || !role) {
    return { error: "Choose a person and a valid role." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: userId,
      new_role: role,
    });

    if (error) {
      return { error: friendlyRoleError(error.message) };
    }
  } catch (error) {
    const failure = authFailure(error);
    if (failure) {
      return failure;
    }
    throw error;
  }

  revalidatePath("/admin");
  return { message: "Role saved. The change is in the activity log." };
}

function friendlyRoleError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("last admin")) {
    return "That would remove the last administrator. Add another administrator first.";
  }
  if (lower.includes("only an admin")) {
    return "Only an administrator can change roles.";
  }
  if (lower.includes("not found")) {
    return "That person no longer has an account.";
  }
  if (lower.includes("invalid role")) {
    return "That role is not valid.";
  }
  return "The role could not be changed.";
}
