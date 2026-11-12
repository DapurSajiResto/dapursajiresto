// Seed database dengan data demo
// Run: pnpm tsx prisma/seed.ts
//
// Membuat:
// - 1 tenant demo (status TRIAL)
// - 1 user owner (email: demo@resto.id / password: demo123)
// - Kategori & menu items contoh

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      namaResto: "Warung Demo Bahagia",
      subdomain: "demo",
      ownerName: "Budi Demo",
      email: "demo@resto.id",
      phone: "08123456789",
      alamat: "Jl. Contoh No. 123, Jakarta",
      status: "TRIAL",
      trialEndsAt,
      strukHeader: "Terima kasih telah berkunjung",
      strukFooter: "Selamat menikmati!",
      strukWidth: 58,
    },
  });

  // User owner
  await prisma.user.upsert({
    where: { email: "demo@resto.id" },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "demo@resto.id",
      passwordHash,
      name: "Budi Demo",
      role: "OWNER",
    },
  });

  // Subscription
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      plan: "basic",
      harga: 10000,
      status: "TRIALING",
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
    },
  });

  // Categories
  const makanan = await prisma.menuCategory.create({
    data: { tenantId: tenant.id, nama: "Makanan", urutan: 1 },
  });
  const minuman = await prisma.menuCategory.create({
    data: { tenantId: tenant.id, nama: "Minuman", urutan: 2 },
  });
  const snack = await prisma.menuCategory.create({
    data: { tenantId: tenant.id, nama: "Snack", urutan: 3 },
  });

  // Menu items
  const items = [
    { cat: makanan.id, nama: "Nasi Goreng Spesial", harga: 18000, deskripsi: "Nasi goreng dengan telur, ayam, dan sayuran" },
    { cat: makanan.id, nama: "Mie Goreng", harga: 15000, deskripsi: "Mie goreng ala Indonesia" },
    { cat: makanan.id, nama: "Ayam Bakar", harga: 25000, deskripsi: "Ayam bakar bumbu kecap" },
    { cat: makanan.id, nama: "Nasi Putih", harga: 5000, deskripsi: "Nasi putih hangat" },
    { cat: minuman.id, nama: "Es Teh Manis", harga: 5000, deskripsi: "Teh manis dingin" },
    { cat: minuman.id, nama: "Teh Hangat", harga: 4000, deskripsi: "Teh hangat" },
    { cat: minuman.id, nama: "Air Mineral", harga: 3000, deskripsi: "Botol 600ml" },
    { cat: minuman.id, nama: "Kopi Hitam", harga: 8000, deskripsi: "Kopi tubruk" },
    { cat: snack.id, nama: "Pisang Goreng", harga: 10000, deskripsi: "4 potong pisang goreng crispy" },
    { cat: snack.id, nama: "Tahu Isi", harga: 8000, deskripsi: "5 potong tahu isi" },
  ];

  for (const item of items) {
    await prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        categoryId: item.cat,
        nama: item.nama,
        deskripsi: item.deskripsi,
        harga: item.harga,
        isAvailable: true,
        stock: 100,
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log("");
  console.log("Demo account:");
  console.log("  Email:    demo@resto.id");
  console.log("  Password: demo123");
  console.log("  Tenant:   demo (subdomain)");
  console.log("");
  console.log(`  Login URL: http://localhost:3000/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
