import type { AppCapability } from "./roles";

export function hasCapability(userCapabilities: AppCapability[], expectedCapability: AppCapability) {
  return userCapabilities.includes(expectedCapability);
}

export function hasAnyCapability(
  userCapabilities: AppCapability[],
  expectedCapabilities: AppCapability[]
) {
  return expectedCapabilities.some((capability) => hasCapability(userCapabilities, capability));
}
