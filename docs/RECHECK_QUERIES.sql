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
