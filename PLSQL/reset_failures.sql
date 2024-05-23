
DECLARE
   CURSOR c_job_list
   IS
      SELECT owner, job_name
        FROM dba_scheduler_jobs
       WHERE failure_count > 0; 

   l_owner      dba_scheduler_jobs.owner%TYPE;
   l_job_name   dba_scheduler_jobs.job_name%TYPE;
BEGIN
   OPEN c_job_list; 

   LOOP
      FETCH c_job_list
       INTO l_owner, l_job_name; 

      EXIT WHEN c_job_list%NOTFOUND;
      DBMS_SCHEDULER.DISABLE (NAME       => l_owner || '.' || l_job_name,
                              FORCE      => TRUE
                             );
      DBMS_SCHEDULER.ENABLE (NAME => l_owner || '.' || l_job_name);
   END LOOP;
END;
/

SELECT owner, job_name, max_failures, failure_count
  FROM dba_scheduler_jobs
 WHERE failure_count > 0;