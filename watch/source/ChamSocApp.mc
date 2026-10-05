//-----------------------------------------------------------------------------------
//
// Chăm Sóc Ba Mẹ - application entry point.
//
// - Registers the background temporal event (every interval_min minutes, min 5).
//   The registration persists after the app is closed.
// - Receives background results in onBackgroundData() and stores them in
//   Application.Storage ("last_status", "last_sent", "last_try") for the UI.
// - sendNow(): immediate send from the foreground (select button / tap).
//
// Structure follows house-of-abbey/GarminHomeAssistant (MIT), HomeAssistantApp.mc
// and Settings.mc.
//
//-----------------------------------------------------------------------------------

using Toybox.Application;
using Toybox.Application.Properties;
using Toybox.Application.Storage;
using Toybox.Background;
using Toybox.Communications;
using Toybox.Lang;
using Toybox.System;
using Toybox.Time;
using Toybox.WatchUi;

(:background)
class ChamSocApp extends Application.AppBase {

    private var mIsForeground as Lang.Boolean = false;
    private var mSending      as Lang.Boolean = false;
    private var mPairing      as Pairing?;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Lang.Dictionary?) as Void {
        AppBase.onStart(state);
    }

    function onStop(state as Lang.Dictionary?) as Void {
        AppBase.onStop(state);
    }

    //! Only called for the foreground app (never in the background process).
    function getInitialView() as [ WatchUi.Views ] or [ WatchUi.Views, WatchUi.InputDelegates ] {
        mIsForeground = true;
        mPairing = new Pairing();
        registerBackground();
        return [new MainView(), new MainDelegate()];
    }

    //! Called each time the temporal event fires; object lives only for that run.
    function getServiceDelegate() as [ System.ServiceDelegate ] {
        return [new BgDelegate()];
    }

    //! Receives the value passed to Background.exit(). If the app was not running,
    //! the system delivers the (latest) data the next time the app starts.
    function onBackgroundData(data as Application.PersistableType) as Void {
        if (data instanceof Lang.Dictionary) {
            var d    = data as Lang.Dictionary;
            var code = d.get("code");
            var ts   = d.get("ts");
            if (code instanceof Lang.Number) {
                var when = Time.now().value();
                if (ts instanceof Lang.Number) {
                    when = ts as Lang.Number;
                }
                recordResult(code as Lang.Number, when);
            }
        }
    }

    //! Settings changed from the phone while the app is open.
    function onSettingsChanged() as Void {
        if (mIsForeground) {
            registerBackground();
            WatchUi.requestUpdate();
        }
    }

    function isSending() as Lang.Boolean {
        return mSending;
    }

    //! Ghép bằng mã 6 số (chỉ có khi ứng dụng đang mở).
    function pairing() as Pairing? {
        return mPairing;
    }

    //! Website vừa nhận mã: bật dịch vụ nền và gửi ngay lần đầu.
    function onPaired() as Void {
        registerBackground();
        sendNow();
    }

    //! Immediate send from the foreground, same payload as the background service.
    function sendNow() as Void {
        if (mSending) {
            return;
        }
        if (!Payload.isConfigured()) {
            var p = mPairing;
            if (p != null) {
                p.onSelect();
            }
            WatchUi.requestUpdate();
            return;
        }
        if (!System.getDeviceSettings().phoneConnected) {
            recordResult(-104, Time.now().value());
            return;
        }
        mSending = true;
        WatchUi.requestUpdate();
        Communications.makeWebRequest(
            Payload.endpoint(),
            Payload.build(),
            Payload.options(),
            method(:onSendResponse)
        );
    }

    function onSendResponse(responseCode as Lang.Number, data as Null or Lang.Dictionary or Lang.String) as Void {
        mSending = false;
        recordResult(responseCode, Time.now().value());
    }

    //! Persist the latest result for the UI.
    //!   last_status : Number, HTTP status or negative Communications error
    //!   last_try    : Number, epoch seconds of the latest attempt
    //!   last_sent   : Number, epoch seconds of the latest successful (200) send
    function recordResult(code as Lang.Number, ts as Lang.Number) as Void {
        Storage.setValue("last_status", code);
        Storage.setValue("last_try", ts);
        if (code == 200) {
            Storage.setValue("last_sent", ts);
        } else if (code == 401) {
            // Website đã thu hồi mã của đồng hồ này: xoá khoá để hiện mã ghép mới.
            Properties.setValue("device_key", "");
            Storage.deleteValue("paired_to");
            registerBackground();
        }
        if (mIsForeground) {
            WatchUi.requestUpdate();
        }
    }

    //! (Re)register or remove the background temporal event depending on settings.
    //! Must only be called from the foreground app.
    private function registerBackground() as Void {
        if (!(Toybox has :Background)) {
            return;
        }
        try {
            var registered = Background.getTemporalEventRegisteredTime();
            if (Payload.isConfigured()) {
                var secs = Payload.intervalMin() * 60;
                if ((registered == null) || (registered.value() != secs)) {
                    Background.registerForTemporalEvent(new Time.Duration(secs));
                }
            } else if (registered != null) {
                Background.deleteTemporalEvent();
            }
        } catch (e instanceof Lang.Exception) {
            // e.g. InvalidBackgroundTimeException; ignore, UI still works.
        }
    }
}

//! Global accessor for the application object.
(:background)
function getChamSocApp() as ChamSocApp {
    return Application.getApp() as ChamSocApp;
}
