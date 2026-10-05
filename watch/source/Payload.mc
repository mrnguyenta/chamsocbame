//-----------------------------------------------------------------------------------
//
// Chăm Sóc Ba Mẹ - shared settings + payload builder.
//
// Used by BOTH the background service (BgDelegate) and the foreground app
// ("send now" button), hence annotated (:background). Keep it small: the
// background process has roughly 32 KB of memory on many devices.
//
// API usage patterns follow house-of-abbey/GarminHomeAssistant (MIT licence),
// source/BackgroundServiceDelegate.mc and source/Settings.mc.
//
//-----------------------------------------------------------------------------------

using Toybox.Lang;
using Toybox.Time;
using Toybox.System;
using Toybox.Activity;
using Toybox.ActivityMonitor;
using Toybox.SensorHistory;
using Toybox.UserProfile;
using Toybox.Communications;
using Toybox.Application.Properties;

(:background)
class Payload {

    //! Server base URL from settings, without trailing "/". "" if not set.
    static function serverUrl() as Lang.String {
        var v = Properties.getValue("server_url");
        if (!(v instanceof Lang.String)) {
            return "";
        }
        var s = v as Lang.String;
        while ((s.length() > 0) && s.substring(s.length() - 1, s.length()).equals("/")) {
            s = s.substring(0, s.length() - 1) as Lang.String;
        }
        return s;
    }

    //! Device key from settings. "" if not set.
    static function deviceKey() as Lang.String {
        var v = Properties.getValue("device_key");
        if (v instanceof Lang.String) {
            return v as Lang.String;
        }
        return "";
    }

    //! Send interval in minutes, clamped to [5, 60] (5 = Connect IQ minimum).
    static function intervalMin() as Lang.Number {
        var v = Properties.getValue("interval_min");
        var n = 5;
        if (v instanceof Lang.Number) {
            n = v as Lang.Number;
        } else if (v instanceof Lang.Float) {
            n = (v as Lang.Float).toNumber();
        }
        if (n < 5) {
            n = 5;
        }
        if (n > 60) {
            n = 60;
        }
        return n;
    }

    static function isConfigured() as Lang.Boolean {
        return (serverUrl().length() > 0) && (deviceKey().length() > 0);
    }

    static function endpoint() as Lang.String {
        return serverUrl() + "/api/watch/push";
    }

    //! Options for Communications.makeWebRequest(). Return type deliberately
    //! not annotated so it is accepted by the typed `options` parameter.
    static function options() {
        return {
            :method       => Communications.HTTP_REQUEST_METHOD_POST,
            :headers      => {
                "Content-Type"  => Communications.REQUEST_CONTENT_TYPE_JSON,
                "Authorization" => "Bearer " + deviceKey()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
    }

    //! Walk a SensorHistory iterator (newest first) and return the first value
    //! that lies in [minV, maxV], or null.
    static function latestValue(it, minV as Lang.Number, maxV as Lang.Number) as Lang.Number or Null {
        if (it == null) {
            return null;
        }
        var s = it.next();
        var n = 0;
        while ((s != null) && (n < 60)) {
            var d = s.data;
            if (d != null) {
                var v = d.toNumber();
                if ((v >= minV) && (v <= maxV)) {
                    return v;
                }
            }
            s = it.next();
            n++;
        }
        return null;
    }

    //! Current heart rate: live sensor value, else newest valid SensorHistory sample (last 30 min).
    static function currentHr() as Lang.Number or Null {
        if (Activity has :getActivityInfo) {
            var ai = Activity.getActivityInfo();
            if ((ai != null) && (ai.currentHeartRate != null)) {
                return ai.currentHeartRate;
            }
        }
        if ((Toybox has :SensorHistory) && (SensorHistory has :getHeartRateHistory)) {
            // ActivityMonitor.INVALID_HR_SAMPLE is 255, so cap valid range below that.
            return latestValue(SensorHistory.getHeartRateHistory({
                :period => new Time.Duration(1800),
                :order  => SensorHistory.ORDER_NEWEST_FIRST
            }), 1, 250);
        }
        return null;
    }

    //! Build the JSON body for POST {server_url}/api/watch/push (contract v1).
    static function build() {
        var body = {};
        body["v"]  = 1;
        body["ts"] = Time.now().value();

        // --- Heart rate samples over the last interval, max 30, oldest first ---
        var hrSamples = [];
        if ((Toybox has :SensorHistory) && (SensorHistory has :getHeartRateHistory)) {
            var it = SensorHistory.getHeartRateHistory({
                :period => new Time.Duration(intervalMin() * 60),
                :order  => SensorHistory.ORDER_NEWEST_FIRST
            });
            if (it != null) {
                var newestFirst = [];
                var s = it.next();
                var guard = 0;
                while ((s != null) && (newestFirst.size() < 30) && (guard < 300)) {
                    var d = s.data;
                    var w = s.when;
                    if ((d != null) && (w != null)) {
                        var bpm = d.toNumber();
                        if ((bpm > 0) && (bpm < 255)) {
                            newestFirst.add([w.value(), bpm]);
                        }
                    }
                    s = it.next();
                    guard++;
                }
                for (var i = newestFirst.size() - 1; i >= 0; i--) {
                    hrSamples.add(newestFirst[i]);
                }
            }
        }
        body["hr"]         = currentHr();
        body["hr_samples"] = hrSamples;

        // --- Resting heart rate ---
        var rhr = null;
        if (Toybox has :UserProfile) {
            var p = UserProfile.getProfile();
            if ((p != null) && (p has :restingHeartRate)) {
                rhr = p.restingHeartRate;
            }
        }
        body["resting_hr"] = rhr;

        // --- Steps + respiration (ActivityMonitor) ---
        var steps = null;
        var resp  = null;
        var info  = ActivityMonitor.getInfo();
        if (info != null) {
            steps = info.steps;
            if (ActivityMonitor.Info has :respirationRate) {
                var r = info.respirationRate;
                if (r != null) {
                    resp = r.toNumber();
                }
            }
        }
        body["steps"]       = steps;
        body["respiration"] = resp;

        // --- Stress / Body Battery / SpO2: latest SensorHistory sample ---
        var stress = null;
        var bb     = null;
        var spo2   = null;
        if (Toybox has :SensorHistory) {
            if (SensorHistory has :getStressHistory) {
                stress = latestValue(SensorHistory.getStressHistory({
                    :period => new Time.Duration(3600),
                    :order  => SensorHistory.ORDER_NEWEST_FIRST
                }), 0, 100);
            }
            if (SensorHistory has :getBodyBatteryHistory) {
                bb = latestValue(SensorHistory.getBodyBatteryHistory({
                    :period => new Time.Duration(3600),
                    :order  => SensorHistory.ORDER_NEWEST_FIRST
                }), 0, 100);
            }
            if (SensorHistory has :getOxygenSaturationHistory) {
                spo2 = latestValue(SensorHistory.getOxygenSaturationHistory({
                    :period => new Time.Duration(4 * 3600),
                    :order  => SensorHistory.ORDER_NEWEST_FIRST
                }), 50, 100);
            }
        }
        body["stress"]       = stress;
        body["body_battery"] = bb;
        body["spo2"]         = spo2;

        // --- Watch battery ---
        var stats = System.getSystemStats();
        body["battery"] = (stats.battery + 0.5).toNumber();
        var charging = false;
        if (stats has :charging) {
            charging = stats.charging;
        }
        body["charging"] = charging;

        // --- Device part number (cheap, optional) ---
        var ds = System.getDeviceSettings();
        if ((ds has :partNumber) && (ds.partNumber != null)) {
            body["device"] = ds.partNumber;
        }

        return body;
    }
}
