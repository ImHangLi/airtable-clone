"use client";

import { useState } from "react";
import { TopNav } from "./TopNav";

export function TopNavClient() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return <TopNav sidebarOpen={sidebarOpen} setsidebarOpen={setSidebarOpen} />;
}
