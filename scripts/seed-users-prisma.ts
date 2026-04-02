/**
 * Seed internal users and roles into the database.
 * Works with any DATABASE_URL — local or production.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-users-prisma.ts
 *
 * Or with .env loaded:
 *   npx tsx --env-file=.env scripts/seed-users-prisma.ts
 */
import { hashPassword } from "@bgc-alpha/auth/passwords";
import { prisma } from "@bgc-alpha/db";

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";

const PASSWORD_HASH = hashPassword(SEED_PASSWORD);

const roles = [
  { id: "role_founder", key: "founder", label: "Founder" },
  { id: "role_analyst", key: "analyst", label: "Analyst" },
  { id: "role_product", key: "product", label: "Product" },
  { id: "role_engineering", key: "engineering", label: "Engineering" },
  { id: "role_admin", key: "admin", label: "Admin" },
];

const users = [
  { id: "user_founder", name: "Founder User", email: "founder@bgc.local", roleId: "role_founder" },
  { id: "user_analyst", name: "Analyst User", email: "analyst@bgc.local", roleId: "role_analyst" },
  { id: "user_product", name: "Product User", email: "product@bgc.local", roleId: "role_product" },
  { id: "user_engineering", name: "Engineering User", email: "engineering@bgc.local", roleId: "role_engineering" },
  { id: "user_admin", name: "Admin User", email: "admin@bgc.local", roleId: "role_admin" },
];

async function main() {
  console.log("Seeding roles...");
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { label: role.label },
      create: role,
    });
  }
  console.log(`  ✓ ${roles.length} roles upserted.`);

  console.log("Seeding users...");
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash: PASSWORD_HASH,
        status: "ACTIVE",
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: PASSWORD_HASH,
        status: "ACTIVE",
      },
    });

    // Upsert UserRole
    const userRoleId = `userrole_${user.id.replace("user_", "")}_${user.roleId.replace("role_", "")}`;
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: user.roleId,
        },
      },
      update: {},
      create: {
        id: userRoleId,
        userId: user.id,
        roleId: user.roleId,
      },
    });
  }
  console.log(`  ✓ ${users.length} users upserted with password "${SEED_PASSWORD}".`);

  console.log("\nDone! You can now sign in with any of the seeded users.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
