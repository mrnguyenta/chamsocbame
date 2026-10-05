import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { fmtAgo } from "@/lib/format";
import { deleteDevice, deleteMed, deleteRule } from "./actions";
import { AddMedForm, AddRuleForm, ConditionsForm, FamilyForm, RuleForm, WatchKeyForm } from "./forms";

export const dynamic = "force-dynamic";

const GARMIN_STATUS: Record<string, string> = {
  ok: "Đang kết nối", needs_relogin: "Cần đăng nhập lại (chạy link_garmin)", error: "Lỗi tạm thời",
};

export default async function SettingsPage() {
  const session = await requireSession();
  const data = await getSettings(session.familyId);

  return (
    <main className="container">
      <h1 style={{ fontSize: 26 }}>Cài đặt</h1>
      {!session.isAdmin && (
        <div className="banner info">Bạn đang xem. Chỉ người quản trị gia đình mới sửa được cài đặt.</div>
      )}

      <div className="split">
        <div className="main-col">
          {data.elders.map((e, i) => (
            <section key={e.id} className="card" aria-labelledby={`h-${e.id}`}>
              <h2 id={`h-${e.id}`} style={{ fontSize: 20 }}>{e.name}</h2>

              <h3 style={{ fontSize: 15, margin: "8px 0" }}>Bệnh nền</h3>
              <ConditionsForm elderId={e.id} conditions={e.conditions} />

              <h3 style={{ fontSize: 15, margin: "18px 0 4px" }}>Ngưỡng cảnh báo</h3>
              <div className="muted">Bỏ chọn ô đầu dòng để tắt. Mức Cao/Khẩn cấp sẽ leo thang nếu không ai nhận xử lý.</div>
              {e.rules.map((r) => (
                <div key={r.id} className="row" style={{ flexWrap: "nowrap", gap: 6, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}><RuleForm rule={r} /></div>
                  <form action={deleteRule} style={{ paddingTop: 14 }}>
                    <input type="hidden" name="rule_id" value={r.id} />
                    <button className="btn small" type="submit" aria-label="Xoá ngưỡng">Xoá</button>
                  </form>
                </div>
              ))}
              <AddRuleForm elderId={e.id} />

              <h3 id={i === 0 ? "thuoc" : undefined} style={{ fontSize: 15, margin: "18px 0 4px" }}>Lịch uống thuốc</h3>
              {e.meds.length === 0 && <div className="muted">Chưa có.</div>}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {e.meds.map((m) => (
                  <li key={m.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                    <span><strong>{m.times.join(", ")}</strong> · {m.name}{m.note ? <span className="muted"> · {m.note}</span> : null}</span>
                    <form action={deleteMed}>
                      <input type="hidden" name="med_id" value={m.id} />
                      <button className="btn small" type="submit">Xoá</button>
                    </form>
                  </li>
                ))}
              </ul>
              <AddMedForm elderId={e.id} />

              <h3 style={{ fontSize: 15, margin: "18px 0 4px" }}>Thiết bị</h3>
              <div style={{ fontSize: 14 }}>
                Garmin Connect: {e.garmin ? (
                  <>{GARMIN_STATUS[e.garmin.status] ?? e.garmin.status} · đồng bộ {fmtAgo(e.garmin.lastSyncAt)}</>
                ) : "chưa kết nối"}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                {e.devices.map((d) => (
                  <li key={d.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                    <span>Ứng dụng đồng hồ <strong>{d.label ?? "không tên"}</strong>
                      <span className="muted"> · gửi {fmtAgo(d.lastSeenAt)}{d.battery != null ? ` · pin ${d.battery}%` : ""}</span></span>
                    <form action={deleteDevice}>
                      <input type="hidden" name="device_id" value={d.id} />
                      <button className="btn small" type="submit">Thu hồi mã</button>
                    </form>
                  </li>
                ))}
              </ul>
              <div className="row" style={{ marginTop: 10 }}>
                <a className="btn primary small" href={`/ket-noi-dong-ho?nguoi=${e.id}`}>Kết nối đồng hồ bằng mã 6 số</a>
              </div>
              <details style={{ marginTop: 8 }}>
                <summary className="muted" style={{ cursor: "pointer" }}>Cách thủ công: tạo mã dài để dán vào Garmin Connect</summary>
                <WatchKeyForm elderId={e.id} />
              </details>
            </section>
          ))}
        </div>

        <aside className="side-col">
          <section className="card">
            <h2>Telegram & báo cáo</h2>
            <div className={`chip ${data.family.hasTelegramGroup ? "tone-ok" : "tone-warn"}`} style={{ marginBottom: 12 }}>
              {data.family.hasTelegramGroup ? "Đã nối nhóm gia đình" : "Chưa nối nhóm Telegram"}
            </div>
            <FamilyForm f={data.family} />
          </section>
          <section className="card">
            <h2>Gọi điện tự động</h2>
            <span className="chip tone-neutral">Đã để sẵn · chưa bật</span>
            <p className="muted" style={{ marginBottom: 0 }}>
              Sau 20 phút không ai bấm “Tôi xử lý”, hệ thống sẽ gọi cho người có số điện thoại.
              Cần tích hợp nhà cung cấp gọi (Stringee/Twilio) rồi đặt CALL_PROVIDER.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
