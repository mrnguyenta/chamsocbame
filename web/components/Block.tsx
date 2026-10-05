import { IconChevron } from "./icons";

/** Khối lớn thu gọn / mở rộng được (bấm tiêu đề). `id` để nhảy tới bằng #id; xem OpenOnHash. */
export default function Block({ id, icon, tile, title, sub, open, children }: {
  id?: string; icon: React.ReactNode; tile: string; title: string; sub?: React.ReactNode; open?: boolean; children: React.ReactNode;
}) {
  return (
    <details id={id} className="block" open={open}>
      <summary>
        <span className={`icon-tile ${tile}`}>{icon}</span>
        <span className="grow">
          <h2>{title}</h2>
          {sub && <span className="muted" style={{ fontSize: 13 }}>{sub}</span>}
        </span>
        <IconChevron size={20} className="chev" />
      </summary>
      <div className="block-body">{children}</div>
    </details>
  );
}
