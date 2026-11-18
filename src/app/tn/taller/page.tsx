import type { Metadata } from "next";

import StoreWorkshop from "@/components/StoreWorkshop";

export const metadata: Metadata = { title: "Hoja de taller" };

export default function StoreWorkshopPage() {
  return <StoreWorkshop />;
}
