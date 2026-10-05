"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Tải lại dữ liệu trang định kỳ (không tải lại cả trang), dừng khi tab bị ẩn. */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
