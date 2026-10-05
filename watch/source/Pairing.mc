//-----------------------------------------------------------------------------------
//
// Chăm Sóc Ba Mẹ - ghép đồng hồ với website bằng mã 6 số (giống ghép TV với tài khoản).
//
// Chỉ chạy khi ứng dụng đang mở và đồng hồ chưa có khoá (device_key rỗng):
//   1. POST {server_url}/api/watch/pair/start  -> {"code": "482917", "key": "...", "expires_in": 900}
//      Đồng hồ hiện mã, giữ khoá bí mật trong Storage.
//   2. Con cháu nhập mã trên website và chọn người thân.
//   3. Mỗi 5 giây: GET {server_url}/api/watch/pair/status (Bearer khoá)
//      -> {"status": "paired", "elder": "Ba Hùng"}: lưu khoá vào device_key, bắt đầu gửi dữ liệu.
//      -> 410/404: mã hết hạn, xin mã mới.
//
//-----------------------------------------------------------------------------------

using Toybox.Application.Properties;
using Toybox.Application.Storage;
using Toybox.Communications;
using Toybox.Lang;
using Toybox.System;
using Toybox.Time;
using Toybox.WatchUi;

class Pairing {

    private var mBusy as Lang.Boolean = false;

    function initialize() {
    }

    //! Mã 6 số đang chờ nhập trên website, hoặc null nếu chưa có / đã hết hạn.
    function code() as Lang.String or Null {
        var c   = Storage.getValue("pair_code");
        var exp = Storage.getValue("pair_exp");
        if ((c instanceof Lang.String) && (exp instanceof Lang.Number) && ((exp as Lang.Number) > Time.now().value())) {
            return c as Lang.String;
        }
        return null;
    }

    //! "482917" -> "482 917" cho dễ đọc.
    function displayCode() as Lang.String or Null {
        var c = code();
        if ((c == null) || (c.length() != 6)) {
            return c;
        }
        return c.substring(0, 3) + " " + c.substring(3, 6);
    }

    //! Gọi mỗi 5 giây khi màn hình đang mở và đồng hồ chưa có khoá.
    function tick() as Void {
        if (mBusy || (Payload.serverUrl().length() == 0) || !System.getDeviceSettings().phoneConnected) {
            return;
        }
        mBusy = true;
        if (code() == null) {
            var body = {};
            var ds = System.getDeviceSettings();
            if ((ds has :partNumber) && (ds.partNumber != null)) {
                body["device"] = ds.partNumber;
            }
            Communications.makeWebRequest(
                Payload.serverUrl() + "/api/watch/pair/start",
                body,
                {
                    :method       => Communications.HTTP_REQUEST_METHOD_POST,
                    :headers      => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
                },
                method(:onStart)
            );
        } else {
            Communications.makeWebRequest(
                Payload.serverUrl() + "/api/watch/pair/status",
                null,
                {
                    :method       => Communications.HTTP_REQUEST_METHOD_GET,
                    :headers      => { "Authorization" => "Bearer " + (Storage.getValue("pair_key") as Lang.String) },
                    :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
                },
                method(:onStatus)
            );
        }
    }

    function onStart(responseCode as Lang.Number, data as Null or Lang.Dictionary or Lang.String) as Void {
        mBusy = false;
        if ((responseCode == 200) && (data instanceof Lang.Dictionary)) {
            var d   = data as Lang.Dictionary;
            var c   = d.get("code");
            var k   = d.get("key");
            var ttl = d.get("expires_in");
            if ((c instanceof Lang.String) && (k instanceof Lang.String)) {
                var secs = 900;
                if (ttl instanceof Lang.Number) {
                    secs = ttl as Lang.Number;
                }
                Storage.setValue("pair_code", c as Lang.String);
                Storage.setValue("pair_key", k as Lang.String);
                // Trừ 30 giây để không hiện mã sắp hết hạn.
                Storage.setValue("pair_exp", Time.now().value() + secs - 30);
            }
        }
        WatchUi.requestUpdate();
    }

    function onStatus(responseCode as Lang.Number, data as Null or Lang.Dictionary or Lang.String) as Void {
        mBusy = false;
        if ((responseCode == 200) && (data instanceof Lang.Dictionary)) {
            var d = data as Lang.Dictionary;
            if ("paired".equals(d.get("status"))) {
                var key = Storage.getValue("pair_key");
                if (key instanceof Lang.String) {
                    Properties.setValue("device_key", key as Lang.String);
                    var elder = d.get("elder");
                    if (elder instanceof Lang.String) {
                        Storage.setValue("paired_to", elder as Lang.String);
                    }
                    clear();
                    getChamSocApp().onPaired();
                }
            }
        } else if ((responseCode == 404) || (responseCode == 410)) {
            clear(); // mã hết hạn hoặc không còn: lần sau xin mã mới
        }
        WatchUi.requestUpdate();
    }

    function clear() as Void {
        Storage.deleteValue("pair_code");
        Storage.deleteValue("pair_key");
        Storage.deleteValue("pair_exp");
    }
}
