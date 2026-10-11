/* =====================================================================
   CEO Loan Intelligence Dashboard - permissions for the procedures
   Designed and architected by CHINTALA MAHINDRA

   Replace <app login user> with the database user of the SNBSAP_DS data
   source in JBoss. The procedures are owned by dbo and read dbo tables, so
   EXECUTE on them is enough for those tables. The overdue procedures also read
   SN.SHG_MEMBER_LOAN_STATUS_NEW, so that login must keep SELECT on that table.
   ===================================================================== */
GRANT EXECUTE ON dbo.USP_CEO_DASH_ACTIVE_MANDALS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_OFFICER_MAPPING TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_DISTRICT_ROLLUP TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_DAILY_LOANS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_DISTRICT_PROJECTS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_LOANS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_TARGETS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_LOAN_CUBE TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_PURPOSES TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_PROJECT_NAMES TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_REPAYMENT_CUBE TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_CASH_KEYED_BY TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_DRILL_AREA TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_DRILL_SCOPE TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MEMBER_DETAIL TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_SHG_INFO TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_SHG_MEMBER_LOANS TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_MANDAL_OVERDUE TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_OVERDUE_BY_UNIT TO [<app login user>];
GRANT EXECUTE ON dbo.USP_CEO_DASH_OVERDUE_BY_LOAN TO [<app login user>];
