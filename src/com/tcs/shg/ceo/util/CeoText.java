/*
 * CEO Loan Intelligence Dashboard
 * Small string helper (replaces the office CommonUtility.checkNullObj so the project stands alone).
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.util;

public final class CeoText {
    private CeoText() { }

    // null -> "", anything else -> its toString()
    public static String checkNullObj(Object o) {
        return o == null ? "" : o.toString();
    }
}
