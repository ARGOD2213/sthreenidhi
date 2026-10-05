/*
 * Sthreenidhi platform - small string helper shared by all dashboards.
 */
package in.gov.ap.serp.sthreenidhi.platform.util;

public final class Text {
    private Text() { }

    // null -> "", anything else -> its toString()
    public static String checkNullObj(Object o) {
        return o == null ? "" : o.toString();
    }
}
