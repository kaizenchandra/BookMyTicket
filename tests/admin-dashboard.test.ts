import {dashboardPage} from "../src/modules/reporting/adapters/dashboard-schema.ts";
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {pool} from '../src/shared/database.ts';
import {migrate} from '../scripts/migrate.ts';
import {buildApp} from '../src/app.ts';
import {hashToken} from '../src/modules/identity/adapters/postgres.ts';
import {dashboardPeriod} from '../src/modules/reporting/application/dashboard.ts';
import {dashboardMoney} from '../web/features/admin-dashboard.tsx';
if(new URL(process.env.DATABASE_URL??'http://invalid').pathname!=='/bookmyticket_test')throw Error('Requires isolated test database');
before(migrate);after(()=>pool.end());
test('Dashboard calendar periods use IST and preserve exact financial totals',()=>{
 assert.deepEqual(dashboardPeriod(2028,'month',2),{from:'2028-01-31T18:30:00.000Z',until:'2028-02-29T18:30:00.000Z'});
 assert.deepEqual(dashboardPeriod(2026,'quarter',4),{from:'2026-09-30T18:30:00.000Z',until:'2026-12-31T18:30:00.000Z'});
 assert.deepEqual(dashboardPeriod(2026,'year',1),{from:'2025-12-31T18:30:00.000Z',until:'2026-12-31T18:30:00.000Z'});
 assert.equal(dashboardMoney('900719925474099101'),'₹9,00,71,99,25,47,40,991.01');
});
async function account(grant=true,mfa=true){const id=randomUUID(),token=randomBytes(32).toString('hex');
 await pool.query('INSERT INTO identity.accounts(id,contact) VALUES($1,$2)',[id,`${id}@fixture.invalid`]);
 await pool.query("INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",[hashToken(token),id,mfa]);
 if(grant)await pool.query("INSERT INTO identity.grants VALUES($1,'finance','platform')",[id]);
 return {id,headers:{cookie:`session=${token}`}};
}
test('Dashboard HTTP enforces finance/MFA, reports confirmed cohorts without cash duplication and audits reads',async()=>{
 const app=await buildApp(),staff=await account(),customer=await account(false),weak=await account(true,false);
 const url='/api/v1/admin/dashboard?year=2073&group=month&index=5';
 const read=()=>app.inject({method:'GET',url,headers:staff.headers});
 try{
 assert.equal((await app.inject({method:'GET',url})).statusCode,401);
 for(const who of [customer,weak])assert.equal((await app.inject({method:'GET',url,headers:who.headers})).statusCode,403);
 assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/dashboard?year=2073&group=quarter&index=5',headers:staff.headers})).statusCode,422);
 const first=await read();assert.equal(first.statusCode,200,first.body);const before=first.json();
 const ids:string[]=[];
 for(const [state,confirmed,amount,time] of [['confirmed',true,12345,'2073-05-01T00:00:00+05:30'],['cancelled',true,5000,'2073-05-15T00:00:00+05:30'],['pending_payment',false,9000,'2073-05-20T00:00:00+05:30'],['confirmed',true,99999,'2073-06-01T00:00:00+05:30']] as const){
  const id=randomUUID(),reservation=randomUUID();ids.push(id);
  await pool.query("INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'fixture','active',now()+interval '1 hour')",[reservation,staff.id,reservation]);
  await pool.query("INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at,confirmed_at) VALUES($1,$2,$3,$4,'INR','fixture',$5,$6,$7,CASE WHEN $8 THEN $7::timestamptz ELSE NULL END)",[id,staff.id,reservation,amount,state,{occurrences:[{title:'Dashboard fixture',isDemo:true}],private:'PRIVATE-DATA'},time,confirmed]);
 }
 await pool.query("INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency,captured_at) VALUES($1,$2,12345,'INR','2073-05-04')",[randomUUID(),ids[0]]);
 await pool.query("INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise,created_at) VALUES($1,$2,$3,'late',9000,'2073-05-04')",[randomUUID(),ids[2],randomUUID()]);
 const response=await read();assert.equal(response.statusCode,200,response.body);const result=dashboardPage.parse(response.json());
 assert.equal(response.headers['cache-control'],'no-store');assert.ok(!response.body.includes('PRIVATE-DATA'));assert.ok(!response.body.includes(staff.id));
 assert.equal(BigInt(result.bookings.gbv),BigInt(before.bookings.gbv)+17345n);
 assert.equal(BigInt(result.bookings.bookings),BigInt(before.bookings.bookings)+3n);
 assert.equal(BigInt(result.bookings.cancelled),BigInt(before.bookings.cancelled)+1n);
 assert.equal(BigInt(result.bookings.repeat_customers),BigInt(before.bookings.repeat_customers)+1n);
 assert.equal(BigInt(result.payments.captured_paise),BigInt(before.payments.captured_paise)+12345n);
 assert.equal(result.verticals.reduce((sum:bigint,v:any)=>sum+BigInt(v.gbv),0n),BigInt(result.bookings.gbv));
 assert.ok(result.bookings.latest.every((r:any)=>r.id!==ids[3]));
 assert.ok((await pool.query("SELECT 1 FROM reporting.audit WHERE actor_id=$1 AND action='dashboard.read'",[staff.id])).rowCount);
 await pool.query("DELETE FROM identity.grants WHERE account_id=$1",[staff.id]);assert.equal((await read()).statusCode,403);
 }finally{await app.close()}
});
test('Inventory dashboard excludes expired holds and counts pooled allocation once',async()=>{
 const {InventoryDashboard}=await import('../src/modules/inventory/adapters/dashboard.ts');
 const tx=await pool.connect();await tx.query('BEGIN');
 try{
 const period=dashboardPeriod(2074,'month',7),source=new InventoryDashboard(),before=await source.read(tx,period);
 const owner=randomUUID(),org=randomUUID(),listing=randomUUID(),occurrence=randomUUID();
 await tx.query('INSERT INTO identity.accounts(id,contact) VALUES($1,$2)',[owner,`${owner}@fixture.invalid`]);
 await tx.query("INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Dashboard','event','approved')",[org,owner]);
 await tx.query("INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'Dashboard','event','Test','Fixture','published')",[listing,org]);
 await tx.query("INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'Test','Asia/Kolkata','2074-07-05','2074-07-06',now(), '2074-07-04')",[occurrence,listing,org]);
 await tx.query("INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,sold,price_paise) VALUES($1,'pool','pool','Test',10,2,100)",[occurrence]);
 for(const expired of [false,true]){const reservation=randomUUID();
 await tx.query("INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'fixture','active',now()+CASE WHEN $4 THEN interval '-1 hour' ELSE interval '1 hour' END)",[reservation,owner,reservation,expired]);
 await tx.query("INSERT INTO inventory.reservation_items(reservation_id,occurrence_id,resource_id,quantity,unit_price_paise) VALUES($1,$2,'pool',3,100)",[reservation,occurrence]);
 }
 const result=await source.read(tx,period);
 for(const [key,delta] of [['capacity',10n],['sold',2n],['held',3n],['unallocated',5n]] as const)assert.equal(BigInt(result[key]),BigInt(before[key])+delta);
 }finally{await tx.query('ROLLBACK');tx.release()}
});
