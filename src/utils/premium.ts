import { UserProfile } from "../types";
import { safeStorage } from "./storage";

export function isPremiumUser(user?: UserProfile | null): boolean {
  if (!user) {
    return (
      safeStorage.getItem("nexa_is_premium") === "true" ||
      safeStorage.getItem("nexa_user_plan") === "premium" ||
      safeStorage.getItem("nexa_premium_waitlist_joined") === "true"
    );
  }
  if (user.isPremium || user.plan?.toLowerCase() === "premium") {
    return true;
  }
  return (
    safeStorage.getItem("nexa_is_premium") === "true" ||
    safeStorage.getItem("nexa_user_plan") === "premium" ||
    safeStorage.getItem("nexa_premium_waitlist_joined") === "true"
  );
}

export function setPremiumStatus(isPremium: boolean) {
  if (isPremium) {
    safeStorage.setItem("nexa_is_premium", "true");
    safeStorage.setItem("nexa_user_plan", "premium");
    safeStorage.setItem("nexa_premium_waitlist_joined", "true");
  } else {
    safeStorage.removeItem("nexa_is_premium");
    safeStorage.removeItem("nexa_user_plan");
    safeStorage.removeItem("nexa_premium_waitlist_joined");
  }
}
