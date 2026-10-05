-- NEXT checks (SELECT-only, read-only). Run the whole file; paste results back.

-- 1. Indexes on the loan status table (is a join by loan number fast?)
SELECT I.name AS INDEX_NAME, I.type_desc, I.is_unique, C.key_ordinal, COL.name AS COLUMN_NAME
FROM sys.indexes I
JOIN sys.index_columns C ON C.object_id = I.object_id AND C.index_id = I.index_id
JOIN sys.columns COL ON COL.object_id = C.object_id AND COL.column_id = C.column_id
WHERE I.object_id = OBJECT_ID('SN.SHG_MEMBER_LOAN_STATUS_NEW')
ORDER BY I.name, C.key_ordinal;

-- 2. Same for the loan table the dashboard reads
SELECT I.name AS INDEX_NAME, I.type_desc, I.is_unique, C.key_ordinal, COL.name AS COLUMN_NAME
FROM sys.indexes I
JOIN sys.index_columns C ON C.object_id = I.object_id AND C.index_id = I.index_id
JOIN sys.columns COL ON COL.object_id = C.object_id AND COL.column_id = C.column_id
WHERE I.object_id = OBJECT_ID('dbo.SHG_MEMBER_MCP_INFO')
ORDER BY I.name, C.key_ordinal;

-- 3. When was the status table last refreshed? (latest update stamp for open and closed loans)
SELECT IS_CLOSED, MAX(IS_CLOSED_UPDATE_TIME) AS LAST_UPDATE, COUNT(*) AS ROWS_
FROM SN.SHG_MEMBER_LOAN_STATUS_NEW WITH (NOLOCK) GROUP BY IS_CLOSED;

-- 4. How many open Stree Nidhi loans have arrears of the "no EMI left" kind (past term)?
SELECT COUNT(*) AS LOANS, SUM(S.LOAN_DUE) AS ARREARS, SUM(S.OUTSTANDING) AS OUTSTANDING
FROM SHG_MEMBER_MCP_INFO M WITH (NOLOCK)
JOIN SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK) ON S.SHG_MEMBER_LOAN_ACCNO = M.SHG_MEMBER_LOAN_ACCNO
WHERE M.LOAN_STATUS = 'OPEN' AND S.IS_CLOSED = 0 AND ISNULL(S.LOAN_EMI, 0) <= 0 AND ISNULL(S.LOAN_DUE, 0) > 0
  AND M.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK) WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN');
