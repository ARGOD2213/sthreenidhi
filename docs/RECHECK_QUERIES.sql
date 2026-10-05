-- READ-ONLY queries for the office query tool (database SNBSAP). They only look; nothing is changed.
-- Run the WHOLE file at once. Every query that reads a table is wrapped in EXEC('...'), so one failing
-- query (missing table, broken view) is reported on its own and the rest still run.
-- Paste all results back in order. Before pasting sample rows, hide any names or phone numbers.
-- NOTE: SN.SHG_MEMBER_DCB_VIEW is broken (it uses a table SHG_LDEMAND that does not exist), so it is not queried.

-- 5. Columns of the overdue candidates, with table type (BASE TABLE or VIEW) - any schema
SELECT C.TABLE_SCHEMA, C.TABLE_NAME, T.TABLE_TYPE, C.ORDINAL_POSITION, C.COLUMN_NAME, C.DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS C
JOIN INFORMATION_SCHEMA.TABLES T ON T.TABLE_SCHEMA = C.TABLE_SCHEMA AND T.TABLE_NAME = C.TABLE_NAME
WHERE C.TABLE_NAME IN ('SHG_MEMBER_LOAN_DEMAND_STATUS','SHG_MEMBER_LOAN_STATUS_NEW','SHG_OVER_DUES','SHG_DEMAND_LEDGER','SHG_WISE_OVERDUE_STATUS','SN_SHG_WISE_OVERDUE_STATUS')
ORDER BY C.TABLE_SCHEMA, C.TABLE_NAME, C.ORDINAL_POSITION;

-- 6. What the broken DCB view was built from (definition only, nothing is run)
EXEC('EXEC sp_helptext ''SN.SHG_MEMBER_DCB_VIEW''');

-- 7. Sample rows: demand status table
EXEC('SELECT TOP 5 * FROM SN.SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK)');

-- 8. Sample rows: SHG-wise overdue status
EXEC('SELECT TOP 5 * FROM SHG_WISE_OVERDUE_STATUS WITH (NOLOCK)');

-- 9. Sample rows: loan status (due date, EMI, outstanding)
EXEC('SELECT TOP 5 * FROM SN.SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK)');

-- 10. Sample rows: SHG over dues
EXEC('SELECT TOP 5 * FROM SHG_OVER_DUES WITH (NOLOCK)');

-- 11. Sample rows: demand ledger
EXEC('SELECT TOP 5 * FROM SHG_DEMAND_LEDGER WITH (NOLOCK)');

-- 12. Size and freshness: demand status
EXEC('SELECT COUNT(*) AS ROWS_, MAX(OVERDUE_SINCE) AS LATEST_OVERDUE_SINCE, MIN(OVERDUE_SINCE) AS EARLIEST_OVERDUE_SINCE FROM SN.SHG_MEMBER_LOAN_DEMAND_STATUS WITH (NOLOCK)');

-- 13. Size and freshness: loan status
EXEC('SELECT COUNT(*) AS ROWS_, MAX(DUE_DATE) AS LATEST_DUE_DATE, MIN(DUE_DATE) AS EARLIEST_DUE_DATE FROM SN.SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK)');

-- 14. TARGET table the dashboard uses today: columns
SELECT TABLE_SCHEMA, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'LIVELIHOOD_MANDALWISE_TARGET_FY18' ORDER BY ORDINAL_POSITION;

-- 15. TARGET table: sample rows
EXEC('SELECT TOP 10 * FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 WITH (NOLOCK)');

-- 16. TARGET table: size and totals
EXEC('SELECT COUNT(*) AS ROWS_, SUM(TARGET_AMOUNT) AS SUM_TARGET_AMOUNT, MAX(TARGET_AMOUNT) AS MAX_ONE_ROW FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 WITH (NOLOCK)');

-- 17. Other target tables for 2025-26 / 2026-27
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%TARGET%' OR TABLE_NAME LIKE '%FY25%' OR TABLE_NAME LIKE '%FY26%' OR TABLE_NAME LIKE '%FY27%'
   OR TABLE_NAME LIKE '%2025_26%' OR TABLE_NAME LIKE '%2026_27%'
ORDER BY TABLE_NAME;

-- 18. Open loans in the table the dashboard already uses
EXEC('SELECT TOP 5 SHG_MEMBER_LOAN_ACCNO, LOAN_STATUS, LOAN_AMOUNT_ISSUED, OUTSTANDING, EMI, INSTALLMENTS FROM SN.SHG_MEMBER_MCP_INFO WITH (NOLOCK) WHERE LOAN_STATUS = ''OPEN''');

-- 19. Where the overdue / demand objects live
SELECT S.name AS SCHEMA_NAME, O.name AS OBJECT_NAME, O.type_desc, O.create_date, O.modify_date
FROM sys.objects O JOIN sys.schemas S ON S.schema_id = O.schema_id
WHERE O.name LIKE '%DCB%' OR O.name LIKE '%DEMAND%' OR O.name LIKE '%OVER_DUES%' OR O.name LIKE '%OVERDUE%'
ORDER BY O.name;

-- 20. Can this login see definitions?
SELECT DB_NAME() AS DB, SUSER_NAME() AS LOGIN_NAME, USER_NAME() AS DB_USER,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DEFINITION') AS CAN_VIEW_DEFINITION;
