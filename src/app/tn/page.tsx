import type { Metadata } from "next";

import StoreConfigurator from "@/components/StoreConfigurator";

export const metadata: Metadata = { title: "Configurador" };

export default function StorePage() {
  return <StoreConfigurator />;
}
