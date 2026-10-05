//-----------------------------------------------------------------------------------
//
// Chăm Sóc Người Thân - the single foreground screen (large text for elderly users).
//
//   Chăm Sóc Người Thân
//        72            <- current heart rate
//   nhịp tim / phút
//     Đã kết nối       <- status of the latest send
//   Gửi lúc 07:35      <- latest successful send
//   Bấm để gửi ngay
//
//-----------------------------------------------------------------------------------

using Toybox.Application.Storage;
using Toybox.Graphics;
using Toybox.Lang;
using Toybox.System;
using Toybox.Time;
using Toybox.Time.Gregorian;
using Toybox.Timer;
using Toybox.WatchUi;

class MainView extends WatchUi.View {

    private var mTimer as Timer.Timer?;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        // Refresh heart rate on screen every 5 seconds while visible.
        var t = new Timer.Timer();
        t.start(method(:onTick), 5000, true);
        mTimer = t;
        onTick();
    }

    function onHide() as Void {
        var t = mTimer;
        if (t != null) {
            t.stop();
        }
        mTimer = null;
    }

    function onTick() as Void {
        if (!Payload.isConfigured()) {
            var p = getChamSocApp().pairing();
            if (p != null) {
                p.tick();
            }
        }
        WatchUi.requestUpdate();
    }

    private function str(id) as Lang.String {
        return WatchUi.loadResource(id) as Lang.String;
    }

    //! "07:35" for today, "07:35 3/10" for another day.
    private function formatTime(ts as Lang.Number) as Lang.String {
        var info  = Gregorian.info(new Time.Moment(ts), Time.FORMAT_SHORT);
        var today = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        var s = (info.hour as Lang.Number).format("%02d") + ":" + (info.min as Lang.Number).format("%02d");
        if ((info.day != today.day) || (info.month != today.month)) {
            s = s + " " + info.day + "/" + info.month;
        }
        return s;
    }

    private function drawPairing(dc as Graphics.Dc, cx as Lang.Number, h as Lang.Number, center as Lang.Number) as Void {
        var p    = getChamSocApp().pairing();
        var code = (p != null) ? p.displayCode() : null;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        if (Payload.serverUrl().length() == 0) {
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_SMALL, str(Rez.Strings.StatusNoServer), center);
        } else if (code != null) {
            dc.drawText(cx, h * 32 / 100, Graphics.FONT_SMALL, str(Rez.Strings.PairTitle), center);
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_NUMBER_MEDIUM, code, center);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 66 / 100, Graphics.FONT_XTINY, str(Rez.Strings.PairHint), center);
            dc.drawText(cx, h * 76 / 100, Graphics.FONT_XTINY, str(Rez.Strings.PairHint2), center);
        } else if (!System.getDeviceSettings().phoneConnected) {
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_SMALL, str(Rez.Strings.StatusNoPhone), center);
        } else {
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_SMALL, str(Rez.Strings.PairWaiting), center);
        }
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w  = dc.getWidth();
        var h  = dc.getHeight();
        var cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();

        // Title
        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        // FONT_TINY: "Chăm Sóc Người Thân" phải vừa dây cung màn hình tròn nhỏ (Fenix 7S, 240 px).
        dc.drawText(cx, h * 17 / 100, Graphics.FONT_TINY, str(Rez.Strings.Title), center);

        // Chưa ghép với website: hiện mã 6 số to giữa màn hình.
        if (!Payload.isConfigured()) {
            drawPairing(dc, cx, h, center);
            return;
        }

        // Heart rate
        var hr = Payload.currentHr();
        var hrText = "--";
        if (hr != null) {
            hrText = hr.toString();
        }
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 36 / 100, Graphics.FONT_NUMBER_MEDIUM, hrText, center);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 51 / 100, Graphics.FONT_XTINY, str(Rez.Strings.HrUnit), center);

        // Status of the latest send
        var status = "";
        var color  = Graphics.COLOR_WHITE;
        var app    = getChamSocApp();
        // Storage trả về kiểu chung; ép về Number để so sánh đúng kiểu.
        var raw     = Storage.getValue("last_status");
        var hasCode = raw instanceof Lang.Number;
        var code    = hasCode ? raw as Lang.Number : 0;
        if (!Payload.isConfigured()) {
            status = str(Rez.Strings.StatusNotSet);
            color  = Graphics.COLOR_YELLOW;
        } else if (app.isSending()) {
            status = str(Rez.Strings.StatusSending);
            color  = Graphics.COLOR_WHITE;
        } else if (!hasCode) {
            status = str(Rez.Strings.StatusNever);
            color  = Graphics.COLOR_WHITE;
        } else if (code == 200) {
            status = str(Rez.Strings.StatusOk);
            color  = Graphics.COLOR_GREEN;
        } else if (code == 401) {
            status = str(Rez.Strings.StatusBadKey);
            color  = Graphics.COLOR_RED;
        } else if (code == -104) {
            status = str(Rez.Strings.StatusNoPhone);
            color  = Graphics.COLOR_ORANGE;
        } else {
            status = str(Rez.Strings.StatusError) + " " + code;
            color  = Graphics.COLOR_RED;
        }
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 65 / 100, Graphics.FONT_MEDIUM, status, center);

        // Latest successful send time
        var lastSent = Storage.getValue("last_sent");
        var sentText = str(Rez.Strings.NeverSent);
        if (lastSent instanceof Lang.Number) {
            sentText = str(Rez.Strings.SentAt) + " " + formatTime(lastSent as Lang.Number);
        }
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 78 / 100, Graphics.FONT_SMALL, sentText, center);

        // Hint
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 89 / 100, Graphics.FONT_XTINY, str(Rez.Strings.TapHint), center);
    }
}
