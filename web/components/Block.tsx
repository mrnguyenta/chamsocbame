import { IconChevron } from "./icons";

/**
 * Khối lớn thu gọn / mở rộng được (bấm tiêu đề). `id` để nhảy tới bằng #id; xem OpenOnHash.
 * Các khối cùng `group` chỉ mở một khối một lúc (mở khối này thì khối kia đóng).
 */
export default function Block({ id, icon, tile, title, sub, open, group, children }: {
  id?: string; icon: React.ReactNode; tile: string; title: string; sub?: React.ReactNode; open?: boolean; group?: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="block" open={open} name={group}>
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
