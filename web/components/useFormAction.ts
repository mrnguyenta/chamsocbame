"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";


/**
 * Gửi form bằng onSubmit thay cho prop action, để React không xoá chữ đã gõ khi máy chủ báo lỗi.
 * Thành công thì xoá các ô mật khẩu.
 */
export function useFormAction<S extends { ok: boolean; message: string }>(fn: (s: S, f: FormData) => Promise<S>, init: S) {
  const [state, action, pending] = useActionState<S, FormData>(
    fn as (s: Awaited<S>, f: FormData) => Promise<S>, init as Awaited<S>);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.querySelectorAll<HTMLInputElement>("input[type=password]").forEach((i) => { i.value = ""; });
  }, [state]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Kèm giá trị của nút đã bấm (form có nhiều nút, ví dụ "Lưu" và "Tắt").
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(fd));
  };
  return { state, pending, ref, onSubmit };
}
