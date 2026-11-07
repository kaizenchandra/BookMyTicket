import pg from 'pg';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const password=readFileSync('/run/secrets/postgres_password','utf8').trim();
const client=new pg.Client({host:'database',user:'bookmyticket',password,database:'postgres'});
await client.connect();
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='bookmyticket_test'")).rowCount)await client.query('CREATE DATABASE bookmyticket_test');
await client.end();
// Only this isolated database receives fixtures. The credential stays in process memory.
const env={...process.env,DATABASE_URL:`postgresql://bookmyticket:${encodeURIComponent(password)}@database:5432/bookmyticket_test`};
delete env.PGPASSWORD_FILE;
const result=spawnSync('npm',['test'],{env,stdio:'inherit'});
process.exit(result.status??1);
