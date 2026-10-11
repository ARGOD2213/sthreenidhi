CEO dashboard stored procedures (run on SNBSAP, owner dbo)

DEPLOY ORDER - the Java in this repo calls these procedures, so:
  1. Check the tables are all in schema dbo (see the schema query in the review notes / ask the DB team).
  2. Run P00_ALL_PROCEDURES.sql in SSMS (or each P01..P21 file on its own).
  3. Run P99_GRANT_EXECUTE.sql with the app login (SNBSAP_DS user).
  4. Test with P98_TEST_CALLS.sql, one EXEC at a time (P03-P12 take minutes; run outside office hours).
  5. Only then deploy the EAR. Rollback: redeploy the previous EAR (it has the inline SQL).
