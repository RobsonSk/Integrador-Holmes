BEGIN
  DBMS_SCHEDULER.create_job(
    job_name        => 'QUERY_FMC_ADHOLMES',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN PROC_INS_DESP_HOLMES; END;',
    start_date      => SYSTIMESTAMP,
    repeat_interval => 'FREQ=MINUTELY; BYHOUR=7,8,9,10,11,12,13,14,15,16,17,18,19; BYSECOND=0',
    enabled         => TRUE
  );
END;
/

BEGIN
  DBMS_SCHEDULER.create_job(
    job_name        => 'QUERY_VP_ADHOLMES',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN PROC_INS_FAT_HOLMES; END;',
    start_date      => SYSTIMESTAMP,
    repeat_interval => 'FREQ=MINUTELY; BYHOUR=7,8,9,10,11,12,13,14,15,16,17,18,19; BYSECOND=30',
    enabled         => TRUE
  );
END;
/