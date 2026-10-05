//-----------------------------------------------------------------------------------
//
// Chăm Sóc Người Thân - input handling. Select button or a screen tap = send now.
// Back button keeps the default behaviour (exit app; background keeps running).
//
//-----------------------------------------------------------------------------------

using Toybox.Lang;
using Toybox.WatchUi;

class MainDelegate extends WatchUi.BehaviorDelegate {

    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onSelect() as Lang.Boolean {
        getChamSocApp().sendNow();
        return true;
    }

    //! Touch screens: handle the tap here and return true so no extra
    //! onSelect() is generated for the same touch.
    function onTap(evt as WatchUi.ClickEvent) as Lang.Boolean {
        getChamSocApp().sendNow();
        return true;
    }
}
