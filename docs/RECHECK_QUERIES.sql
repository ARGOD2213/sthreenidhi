-- READ-ONLY queries to run in the office query tool against SNBSAP. They only look; they change nothing.
-- Paste the results back (first 30 rows are enough). Run one block at a time.

-- 1. Which columns could hold overdue / instalment / EMI / demand information?
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%OVERDUE%' OR COLUMN_NAME LIKE '%ARREAR%' OR COLUMN_NAME LIKE '%DEMAND%'
   OR COLUMN_NAME LIKE '%INSTAL%' OR COLUMN_NAME LIKE '%EMI%' OR COLUMN_NAME LIKE '%DUE_DATE%'
   OR COLUMN_NAME LIKE '%TENURE%' OR COLUMN_NAME LIKE '%OUTSTAND%' OR COLUMN_NAME LIKE '%NPA%'
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 2. Which tables could be a repayment schedule?
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%SCHEDULE%' OR TABLE_NAME LIKE '%INSTAL%' OR TABLE_NAME LIKE '%DEMAND%'
   OR TABLE_NAME LIKE '%EMI%' OR TABLE_NAME LIKE '%REPAY%'
ORDER BY TABLE_NAME;

-- 3. Which values does the loan status take, and how many loans each?
--    The dashboard table is SHG_MEMBER_MCP_INFO. The dashboard counts only OPEN and CLOSED,
--    so any other status shown here is NOT in the dashboard today.
SELECT LOAN_STATUS, COUNT(*) AS LOANS, SUM(LOAN_AMOUNT_ISSUED) AS AMOUNT_ISSUED
FROM SHG_MEMBER_MCP_INFO WITH (NOLOCK)
GROUP BY LOAN_STATUS
ORDER BY LOANS DESC;

-- 4. Where is the target stored, and how big are the values?
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%TARGET%' ORDER BY TABLE_NAME, COLUMN_NAME;


-- =====================  BATCH 2  (after the first results)  =====================
-- Run each block alone. All read-only. TOP keeps the answers small.

-- 5. All columns of the overdue candidates, with the table type (BASE TABLE or VIEW)
SELECT C.TABLE_NAME, T.TABLE_TYPE, C.ORDINAL_POSITION, C.COLUMN_NAME, C.DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS C
JOIN INFORMATION_SCHEMA.TABLES T ON T.TABLE_NAME = C.TABLE_NAME
WHERE C.TABLE_NAME IN ('SHG_MEMBER_DCB_VIEW','SHG_MEMBER_LOAN_DEMAND_STATUS','SHG_MEMBER_LOAN_STATUS_NEW',
                       'SHG_DEMAND_LEDGER','shg_demand_calculated','SHG_OVER_DUES')
ORDER BY C.TABLE_NAME, C.ORDINAL_POSITION;

-- 6. How the DCB view is built (shows which tables feed it and how "overdue" is computed)
EXEC sp_helptext 'SHG_MEMBER_DCB_VIEW';

-- 7. A few real rows (member and loan ids are fine to paste; no names)
SELECT TOP 5 * FROM SHG_MEMBER_DCB_VIEW WITH (NOLOCK);
SELECT TOP 5 * FROM SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);

-- 8. How big and how fresh are they?
SELECT 'DCB_VIEW' AS SRC, COUNT(*) AS ROWS_, MAX(DUE_DATE) AS LATEST_DUE_DATE FROM SHG_MEMBER_DCB_VIEW WITH (NOLOCK);
SELECT 'DEMAND_STATUS' AS SRC, COUNT(*) AS ROWS_, MAX(OVERDUE_SINCE) AS LATEST_OVERDUE_SINCE FROM SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);

-- 9. TARGET: the table the dashboard uses today
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'LIVELIHOOD_MANDALWISE_TARGET_FY18' ORDER BY ORDINAL_POSITION;
SELECT TOP 10 * FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 WITH (NOLOCK);
SELECT COUNT(*) AS ROWS_, SUM(TARGET_AMOUNT) AS SUM_TARGET_AMOUNT, MAX(TARGET_AMOUNT) AS MAX_ONE_ROW
FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 WITH (NOLOCK);

-- 10. Tables with a FINANCIAL YEAR target for 2025-26 / 2026-27 (names with FY25 / FY26 / FY27)
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%TARGET%' OR TABLE_NAME LIKE '%FY25%' OR TABLE_NAME LIKE '%FY26%' OR TABLE_NAME LIKE '%FY27%'
   OR TABLE_NAME LIKE '%2025_26%' OR TABLE_NAME LIKE '%2026_27%'
ORDER BY TABLE_NAME;


-- =====================  BATCH 3  (the DCB view was not found by name)  =====================
-- Safe to run everything at once. Each query is independent: if one fails, the next still runs
-- (run them as separate statements / result sets in the query tool).

-- 11. Where do the overdue / demand objects really live (any schema), and what type are they?
SELECT S.name AS SCHEMA_NAME, O.name AS OBJECT_NAME, O.type_desc, O.create_date, O.modify_date
FROM sys.objects O
JOIN sys.schemas S ON S.schema_id = O.schema_id
WHERE O.name LIKE '%DCB%' OR O.name LIKE '%DEMAND_STATUS%' OR O.name LIKE '%OVER_DUES%' OR O.name LIKE '%OVERDUE%'
ORDER BY O.name;

-- 12. Same objects as INFORMATION_SCHEMA sees them (shows schema + table type)
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%DCB%' OR TABLE_NAME LIKE '%DEMAND_STATUS%' OR TABLE_NAME LIKE '%OVER_DUES%'
ORDER BY TABLE_NAME;

-- 13. Does this login have permission to see view definitions?
SELECT DB_NAME() AS DB, SUSER_NAME() AS LOGIN_NAME, USER_NAME() AS DB_USER,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DEFINITION') AS CAN_VIEW_DEFINITION;

-- 14. Sample rows without naming the schema (works if the object is reachable by the default schema)
SELECT TOP 5 * FROM SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);
SELECT TOP 5 * FROM SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK);
SELECT TOP 5 * FROM SHG_OVER_DUES WITH (NOLOCK);
SELECT TOP 5 * FROM SHG_DEMAND_LEDGER WITH (NOLOCK);

-- 15. Freshness of the demand-status table (is it current?)
SELECT COUNT(*) AS ROWS_, MAX(OVERDUE_SINCE) AS LATEST_OVERDUE_SINCE FROM SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);
SELECT COUNT(*) AS ROWS_, MAX(DUE_DATE) AS LATEST_DUE_DATE FROM SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK);


-- =====================  BATCH 4  (the objects are in schema SN)  =====================
-- Run all. Hide names / phone numbers in sample rows before pasting.

-- 16. How the old DCB view calculates overdue (created 2012)
EXEC sp_helptext 'SN.SHG_MEMBER_DCB_VIEW';

-- 17. Columns of the demand-status table and the view
SELECT TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'SN' AND TABLE_NAME IN ('SHG_MEMBER_LOAN_DEMAND_STATUS','SHG_MEMBER_DCB_VIEW','SHG_MEMBER_LOAN_STATUS_NEW','SHG_OVER_DUES','SHG_DEMAND_LEDGER')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 18. Sample rows
SELECT TOP 5 * FROM SN.SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);
SELECT TOP 5 * FROM SN.SHG_MEMBER_DCB_VIEW WITH (NOLOCK);
SELECT TOP 5 * FROM SN.SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK);

-- 19. Size and freshness of the real data (the table's modify_date only tracks structure changes)
SELECT COUNT(*) AS ROWS_, MAX(OVERDUE_SINCE) AS LATEST_OVERDUE_SINCE, MIN(OVERDUE_SINCE) AS EARLIEST_OVERDUE_SINCE
FROM SN.SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK);

-- 20. Does the demand-status table join to the loans the dashboard uses?
--     (loan key in the dashboard is SHG_MEMBER_LOAN_ACCNO on SN.SHG_MEMBER_MCP_INFO)
SELECT TOP 5 M.SHG_MEMBER_LOAN_ACCNO, M.LOAN_STATUS, M.LOAN_AMOUNT_ISSUED, M.OUTSTANDING, M.EMI, M.INSTALLMENTS
FROM SN.SHG_MEMBER_MCP_INFO M WITH (NOLOCK)
WHERE M.LOAN_STATUS = 'OPEN';
