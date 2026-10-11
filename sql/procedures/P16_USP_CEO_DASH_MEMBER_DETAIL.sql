/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MEMBER_DETAIL
   Java      : CeoLoanIntelligenceDAOImpl.getMemberDetail()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMemberDetail() used to run
   Runs      : woman popup (then cached)
   Returns   : three result sets: MEMBER (profile, mobile last 4 digits only), LOAN rows, REPAYMENT rows (max 3000)

   The woman's own list shows every payment she made (not only credited / closed
   ones), on REPAYMENT_DATE, with the mode from VO_CREDIT_INFO - same as the inline
   version.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MEMBER_DETAIL @MemberId = '<member id>', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MEMBER_DETAIL
    @MemberId VARCHAR(40),
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. profile
    SELECT 'MEMBER' AS ROW_TYPE, SM.MEMBER_ID, MAX(SM.MEMBER_NAME) AS MEMBER_NAME, MAX(SM.SHG_ID) AS SHG_ID,
           MAX(SM.MEMBER_SURNAME) AS MEMBER_SURNAME, MAX(SM.FATHER_HUSBAND_NAME) AS FH_NAME,
           MAX(SM.FATHER_HUSBAND_SUR_NAME) AS FH_SURNAME, MAX(YEAR(SM.DOB)) AS BIRTH_YEAR,
           MAX(SM.MARITIAL_STATUS) AS MARITAL_STATUS, MAX(SM.CATAGORY) AS CATEGORY, MAX(SM.EDUCATION) AS EDUCATION,
           MAX(SM.WELLBEING_STATUS) AS WELLBEING, MAX(SM.HABITATION_NAME) AS VILLAGE,
           CONVERT(CHAR(10), MAX(SM.REGISTRATION_DATE), 120) AS REGISTERED, MAX(SM.IS_DISABLED) AS IS_DISABLED,
           MAX(CASE WHEN LEN(LTRIM(RTRIM(SM.MOBILE_NUM))) >= 4 THEN RIGHT(LTRIM(RTRIM(SM.MOBILE_NUM)), 4) END) AS MOBILE_LAST4
      FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
     WHERE SM.MEMBER_ID = @MemberId AND SM.IS_MEM_ACTIVE = 'Y'
     GROUP BY SM.MEMBER_ID;

    -- 2. her valid loans
    SELECT 'LOAN' AS ROW_TYPE, L.SHG_MEMBER_LOAN_ACCNO, L.SHG_LOAN_ACCNO, L.PROJECT_TYPE, PT.PROJECT_NAME,
           L.PURPOSE, L.LOAN_AMOUNT_ISSUED, L.LOAN_STATUS, CONVERT(CHAR(10), L.ISSUED_DATE, 120) AS ISSUED_DATE
      FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)
      LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                   FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                  WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                  GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = L.PROJECT_TYPE
     WHERE L.MEMBER_LONG_CODE = @MemberId
       AND L.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(L.MEMBER_LONG_CODE)) <> ''
       AND LEN(L.MEMBER_LONG_CODE) >= 20
       AND L.ISSUED_DATE IS NOT NULL
       AND L.ISSUED_DATE > '2000-01-01'
       AND L.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR L.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
     ORDER BY L.ISSUED_DATE
    OPTION (RECOMPILE);

    -- 3. every repayment on those loans, with its payment mode
    SELECT TOP 3000 'REPAYMENT' AS ROW_TYPE, SCI.SHG_CREDIT_ID, SCI.SHG_MEMBER_LOAN_ACCNO,
           CONVERT(CHAR(10), SCI.REPAYMENT_DATE, 120) AS REPAYMENT_DATE, SCI.REPAID_AMOUNT, SCI.REPAY_STATUS,
           SCI.IS_PROCESSED, SCI.Adjust_Type AS ADJUST_TYPE, CONVERT(CHAR(10), SCI.CREDITED_DATE, 120) AS CREDITED_DATE,
           CASE WHEN @PayModes = 1 THEN
                CASE PM.MODE_CODE WHEN 3 THEN 'POS' WHEN 2 THEN 'UPI' WHEN 1 THEN 'AUTO' ELSE 'MANUAL' END
           END AS PAY_MODE
      FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
      LEFT JOIN (SELECT VC.BANK_REF_NO,
                        MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE'  THEN 3
                                 WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE'    THEN 2
                                 WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE
                   FROM VO_CREDIT_INFO VC WITH (NOLOCK)
                  WHERE VC.BANK_REF_NO IS NOT NULL
                  GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO
     WHERE SCI.SHG_MEMBER_LOAN_ACCNO IN (SELECT L.SHG_MEMBER_LOAN_ACCNO
                                           FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)
                                          WHERE L.MEMBER_LONG_CODE = @MemberId
                                                AND L.MEMBER_LONG_CODE IS NOT NULL
                                                AND LTRIM(RTRIM(L.MEMBER_LONG_CODE)) <> ''
                                                AND LEN(L.MEMBER_LONG_CODE) >= 20
                                                AND L.ISSUED_DATE IS NOT NULL
                                                AND L.ISSUED_DATE > '2000-01-01'
                                                AND L.LOAN_STATUS IN ('OPEN', 'CLOSED')
                                                AND (@SnOnly = 0 OR L.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                                                         WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN')))
     ORDER BY SCI.REPAYMENT_DATE
    OPTION (RECOMPILE);
END
