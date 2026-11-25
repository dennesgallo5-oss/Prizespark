import "server-only";

import { isUserRole, type UserRole } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(email: string): string | null {
  if (!email) {
    return "Enter an email address.";
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return "Enter a password.";
  }
  if (password.length < 8) {
    return "Use at least 8 characters.";
  }
  if (password.length > 72) {
    return "Use 72 characters or fewer.";
  }
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name) {
    return "Enter a name.";
  }
  if (name.length > 80) {
    return "Use 80 characters or fewer.";
  }
  if ([...name].some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  })) {
    return "Name cannot include control characters.";
  }
  return null;
}

export function validateRole(value: string): UserRole | null {
  return isUserRole(value) ? value : null;
}

export function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}
