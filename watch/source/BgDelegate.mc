//-----------------------------------------------------------------------------------
//
// Chăm Sóc Ba Mẹ - background service.
//
// Runs every `interval_min` minutes (min 5) via Background.registerForTemporalEvent(),
// even when the app is closed. Collects data (Payload.build()), POSTs it through the
// phone, and hands the HTTP/Communications result to the foreground with
// Background.exit({"code" => <code>, "ts" => <epoch>}) -> ChamSocApp.onBackgroundData().
//
// Pattern from house-of-abbey/GarminHomeAssistant (MIT), BackgroundServiceDelegate.mc.
//
//-----------------------------------------------------------------------------------

using Toybox.Background;
using Toybox.Communications;
using Toybox.Lang;
using Toybox.System;
using Toybox.Time;

(:background)
class BgDelegate extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        if (!Payload.isConfigured()) {
            Background.exit(null);
            return;
        }
        if (!System.getDeviceSettings().phoneConnected) {
            // -104 = Communications.BLE_CONNECTION_UNAVAILABLE (no phone / Bluetooth off)
            Background.exit({ "code" => -104, "ts" => Time.now().value() });
            return;
        }
        Communications.makeWebRequest(
            Payload.endpoint(),
            Payload.build(),
            Payload.options(),
            method(:onResponse)
        );
    }

    //! makeWebRequest callback. responseCode: HTTP status (200, 401, ...) or a
    //! negative Communications error code (-104 no BLE, -300 timeout, ...).
    function onResponse(responseCode as Lang.Number, data as Null or Lang.Dictionary or Lang.String) as Void {
        Background.exit({ "code" => responseCode, "ts" => Time.now().value() });
    }
}
